import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (!secretToken || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secretToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await req.json();
    console.log("Telegram webhook update received:", JSON.stringify(update));

    const message = update.message;
    if (message && message.chat && message.text) {
      const chatId = message.chat.id;
      const text = message.text;

      if (text.startsWith("/start")) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.error("TELEGRAM_BOT_TOKEN is not defined in environment variables.");
          return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
        }

        let appUrl = process.env.RABBITTY_APP_URL;
        if (!appUrl) {
          const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL;
          if (envUrl) {
            let cleanUrl = envUrl.trim();
            if (cleanUrl.endsWith("/api")) {
              cleanUrl = cleanUrl.substring(0, cleanUrl.length - 4);
            } else if (cleanUrl.endsWith("/api/bot/webhook")) {
              cleanUrl = cleanUrl.replace("/api/bot/webhook", "");
            }
            if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
              cleanUrl = "https://" + cleanUrl;
            }
            appUrl = cleanUrl;
          }
        }
        if (!appUrl) {
          console.error("RABBITTY_APP_URL is not defined and could not be inferred from environment.");
          return NextResponse.json({ error: "App URL not configured" }, { status: 500 });
        }

        console.log(`Responding to /start. ChatID: ${chatId}, WebAppURL: ${appUrl}`);

        // 1. Send a quick message to remove any old custom reply keyboard
        try {
          const clearRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: "🐰 Iniciando Rabbitty...",
              reply_markup: {
                remove_keyboard: true
              }
            })
          });
          const clearData = await clearRes.json();
          console.log("Keyboard clear response:", clearData);
        } catch (clearErr) {
          console.error("Error clearing reply keyboard:", clearErr);
        }

        // Update the menu button for this chat to point to the correct URL
        try {
          const menuRes = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: chatId,
              menu_button: {
                type: "web_app",
                text: "🐰 Abrir Rabbitty",
                web_app: {
                  url: appUrl
                }
              }
            })
          });
          const menuData = await menuRes.json();
          console.log("setChatMenuButton response:", menuData);
        } catch (menuErr) {
          console.error("Error setting chat menu button:", menuErr);
        }

        // Send the welcome message
        const welcomeText = `🐰 *¡Bienvenido a Rabbitty!* \n\nCon Rabbitty puedes visitar negocios locales afiliados, escanear códigos QR y ganar recompensas en tokens *Bunz*.\n\nHaz clic en el botón de abajo para abrir la aplicación y comenzar a explorar.`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🐰 Abrir Rabbitty",
                web_app: {
                  url: appUrl
                }
              }
            ]
          ]
        };

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: "Markdown",
            reply_markup: keyboard
          })
        });

        const resData = await res.json();
        console.log("sendMessage response:", resData);
      } else {
        // ── RESPUESTA DIRECTA DESDE TELEGRAM (AFILIADO -> RABBITTER) ──
        try {
          const fromTelegramId = String(message.from?.id || chatId);
          const replyTo = message.reply_to_message;
          const { db } = await import("@/db");
          const { users, ownedBusinesses, conversations, messages: chatMessages } = await import("@/db/schema");
          const { eq, or, desc, and, like } = await import("drizzle-orm");
          const { sendEcosystemNotification } = await import("@/lib/push/notify");

          // 1. Identificar si el remitente en Telegram es dueño de un comercio afiliado
          const senderUser = await db.query.users.findFirst({
            where: eq(users.telegramId, fromTelegramId),
          });

          if (senderUser) {
            const biz = await db.query.ownedBusinesses.findFirst({
              where: eq(ownedBusinesses.ownerId, senderUser.id),
            });

            if (biz) {
              // 2. Resolución de la conversación objetivo:
              //    a) Si el dueño responde con Reply a la alerta del bot, la alerta trae "(ref: conv-xxxxxxxxxx)"
              //    b) Fallback: la conversación más reciente del comercio
              let targetConv = null;
              const refPrefix = /^\(ref: conv-([A-Za-z0-9]+)\)/m.exec(replyTo?.text || '')?.[1];

              let convWhere;
              if (refPrefix) {
                convWhere = and(
                  or(
                    eq(conversations.participant1, biz.id),
                    eq(conversations.participant2, biz.id)
                  ),
                  like(conversations.id, `${refPrefix}%`)
                );
              } else {
                convWhere = or(
                  eq(conversations.participant1, biz.id),
                  eq(conversations.participant2, biz.id)
                );
              }

              // Si es un reply directo a un mensaje del bot que notificaba un chat, priorizar
              // la referencia exacta embebida; si no hay ref o no matchea, caer a la más reciente.
              targetConv = await db.query.conversations.findFirst({
                where: convWhere,
                orderBy: [desc(conversations.lastMessageAt)],
              });

              if (refPrefix && !targetConv) {
                // La ref no encontró match exacto: fallback seguro a la más reciente
                targetConv = await db.query.conversations.findFirst({
                  where: or(
                    eq(conversations.participant1, biz.id),
                    eq(conversations.participant2, biz.id)
                  ),
                  orderBy: [desc(conversations.lastMessageAt)],
                });
              }

              if (targetConv) {
                const customerId =
                  targetConv.participant1 === biz.id
                    ? targetConv.participant2
                    : targetConv.participant1;

                // 3. Insertar el mensaje en Rabbitty como proveniente del comercio
                const [newMsg] = await db
                  .insert(chatMessages)
                  .values({
                    conversationId: targetConv.id,
                    senderId: biz.id,
                    content: text.trim(),
                    type: "TEXT",
                  })
                  .returning();

                await db
                  .update(conversations)
                  .set({ lastMessageAt: new Date(), updatedAt: new Date() })
                  .where(eq(conversations.id, targetConv.id));

                // 4. Notificar al cliente (Rabbitter) en su app
                await sendEcosystemNotification({
                  userId: customerId,
                  title: `💬 ${biz.name}`,
                  message: text.trim(),
                  type: "CHAT",
                  route: `/chat/${biz.id}`,
                  threadId: "chat",
                });

                // 5. Confirmar al afiliado en Telegram que su respuesta fue entregada
                const botToken = process.env.TELEGRAM_BOT_TOKEN;
                if (botToken) {
                  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `✅ Mensaje enviado a tu cliente en Rabbitty.`,
                      reply_to_message_id: message.message_id,
                    }),
                  });
                }
              }
            }
          }
        } catch (chatReplyErr) {
          console.error("Error processing affiliate telegram reply:", chatReplyErr);
        }
      }
    }

    // ── TELEGRAM INLINE CALLBACK QUERIES (APROBACIONES REMOTAS) ──
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data;
      const fromId = String(cb.from?.id);
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim()).filter(Boolean);

      if (data && (data.startsWith("approve_biz_") || data.startsWith("reject_biz_"))) {
        const isApprovedAction = data.startsWith("approve_biz_");
        const businessId = isApprovedAction ? data.replace("approve_biz_", "") : data.replace("reject_biz_", "");

        if (!ADMIN_TELEGRAM_IDS.includes(fromId)) {
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: cb.id,
                text: "⛔ No tienes permisos de administrador para realizar esta acción.",
                show_alert: true,
              }),
            });
          }
          return NextResponse.json({ ok: true });
        }

        try {
          const { db } = await import("@/db");
          const { ownedBusinesses, users, webSessions } = await import("@/db/schema");
          const { eq } = await import("drizzle-orm");
          const crypto = await import("crypto");

          const [business] = await db.select().from(ownedBusinesses).where(eq(ownedBusinesses.id, businessId));

          if (!business) {
            if (botToken) {
              await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: "❌ Negocio no encontrado.",
                  show_alert: true,
                }),
              });
            }
            return NextResponse.json({ ok: true });
          }

          const newStatus = isApprovedAction ? "APPROVED" : "REJECTED";
          await db.update(ownedBusinesses)
            .set({
              status: newStatus,
              verificationMethod: "telegram_remote_approve",
              verificationData: JSON.stringify({
                verifiedAt: new Date().toISOString(),
                approvedByTelegramId: fromId,
              }),
            })
            .where(eq(ownedBusinesses.id, businessId));

          // Notificar al dueño
          const [owner] = await db.select().from(users).where(eq(users.id, business.ownerId));

          if (isApprovedAction) {
            // Actualizar rol del usuario si era USER
            if (owner && owner.role === "USER") {
              await db.update(users).set({ role: "AFFILIATE" }).where(eq(users.id, owner.id));
            }

            // Generar magic link de acceso al Admin Dashboard
            let magicUrl = "https://admin.rabbitty.me/login";
            if (owner?.id) {
              const qrToken = crypto.randomBytes(32).toString("hex");
              const tokenHash = crypto.createHash("sha256").update(qrToken).digest("hex");
              const [session] = await db.insert(webSessions).values({
                id: crypto.randomUUID(),
                jwtToken: tokenHash,
                userId: owner.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              }).returning();
              magicUrl = `https://admin.rabbitty.me/magic?token=${qrToken}&sid=${session.id}`;
            }

            // Notificación Push & In-App al dueño del negocio
            if (owner?.id) {
              const { sendEcosystemNotification } = await import("@/lib/push/notify");
              await sendEcosystemNotification({
                userId: owner.id,
                title: `🎉 ¡Negocio Aprobado: ${business.name}!`,
                message: `Tu comercio ya está activo en Rabbitty. Tus clientes ya pueden escanear y ganar Bunz.`,
                type: "AFFILIATE",
                route: "/business",
                pushData: { businessId: business.id, status: "APPROVED" },
                threadId: "business_status",
              });
            }

            if (owner?.telegramId && botToken) {
              const msg =
                `🎉 *¡Felicidades! Tu negocio ${business.name} ha sido APROBADO.*\n\n` +
                `Ya estás activo en Rabbitty. Tus clientes pueden escanear y ganar Bunz en tu establecimiento.\n\n` +
                `🔗 *Panel de Administración:*\n` +
                `https://admin.rabbitty.me/login\n\n` +
                `🔑 *Tu enlace mágico de 1 solo clic:*\n` +
                `${magicUrl}\n\n` +
                `🐰 — Rabbitty Team`;
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: owner.telegramId, text: msg, parse_mode: "Markdown", disable_web_page_preview: true }),
              });
            }
          } else {
            // Notificación Push & In-App de rechazo
            if (owner?.id) {
              const { sendEcosystemNotification } = await import("@/lib/push/notify");
              await sendEcosystemNotification({
                userId: owner.id,
                title: `⚠️ Solicitud de Negocio: ${business.name}`,
                message: `Tu solicitud necesita ajustes para ser aprobada. Revisa los detalles con soporte.`,
                type: "AFFILIATE",
                route: "/support",
                pushData: { businessId: business.id, status: "REJECTED" },
                threadId: "business_status",
              });
            }

            if (owner?.telegramId && botToken) {
              const msg = `❌ *Solicitud de Negocio no aprobada para ${business.name}*\n\nTu registro ha sido revisado y no cumple con los requisitos actuales. Contacta a soporte para más detalles.`;
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: owner.telegramId, text: msg, parse_mode: "Markdown" }),
              });
            }
          }

          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: cb.id,
                text: isApprovedAction ? `✅ Negocio "${business.name}" aprobado exitosamente.` : `❌ Negocio "${business.name}" rechazado.`,
              }),
            });

            // Actualizar el mensaje original del chat para mostrar el veredicto
            if (cb.message?.chat?.id && cb.message?.message_id) {
              const statusEmoji = isApprovedAction ? "✅ APROBADO" : "❌ RECHAZADO";
              await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: cb.message.chat.id,
                  message_id: cb.message.message_id,
                  text: `${cb.message.text}\n\n━━━━━━━━━━━━━━━━━━━━\n📌 *Dictamen:* ${statusEmoji} por @${cb.from?.username || fromId}`,
                  parse_mode: "Markdown",
                }),
              });
            }
          }
        } catch (approveErr) {
          console.error("Error processing telegram business approval callback:", approveErr);
        }
        return NextResponse.json({ ok: true });
      }
    }

    if (update.pre_checkout_query) {
      const queryId = update.pre_checkout_query.id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        // Aceptamos todos los pagos de Stars en este punto
        await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pre_checkout_query_id: queryId,
            ok: true
          })
        });
      }
    }

    if (message && message.successful_payment) {
      const payment = message.successful_payment;
      const payloadStr = payment.invoice_payload; // "order_123_amount_100_tip_10"
      
      let orderId = "";
      const amountPaid = payment.total_amount;
      
      if (payloadStr.startsWith("order_")) {
        const parts = payloadStr.split("_");
        orderId = parts[1];
      }

      if (orderId) {
        // En una app real de Next.js, deberías llamar a una función interna o servicio para registrar el pago en la DB
        // Como estamos en un route handler, podemos importar la DB directo
        try {
          const { restaurantDb } = await import('@/db/restaurant');
          const { orders, payments } = await import('@rabbitty/database-restaurant/schema');
          const { eq } = await import('drizzle-orm');

          await restaurantDb.insert(payments).values({
            orderId,
            method: "STARS",
            amount: amountPaid,
            reference: payment.provider_payment_charge_id,
            status: "COMPLETED"
          });

          const [orderAfter] = await restaurantDb.select().from(orders).where(eq(orders.id, orderId));
          const allPayments = await restaurantDb.select().from(payments).where(eq(payments.orderId, orderId));
          const sumPayments = allPayments.reduce((s: number, p: { amount: number }) => s + p.amount, 0);

          if (sumPayments >= orderAfter.total) {
            await restaurantDb.update(orders).set({ status: 'PAID' }).where(eq(orders.id, orderId));
          }

          // Enviar Recibo Digital por Telegram
          const botToken = process.env.TELEGRAM_BOT_TOKEN;
          if (botToken && message.chat) {
            const receiptText = `🧾 *Recibo Digital - Rabbitty*\n\nOrden #${orderId.slice(0, 8).toUpperCase()}\nMonto Pagado: ${amountPaid} Stars ⭐️\n\n_¡Gracias por tu visita! Te esperamos pronto._`;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: message.chat.id,
                text: receiptText,
                parse_mode: "Markdown"
              })
            });
          }

        } catch (dbErr) {
          console.error("Error processing successful payment:", dbErr);
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
