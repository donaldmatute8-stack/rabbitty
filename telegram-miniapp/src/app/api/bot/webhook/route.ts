import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (secretToken && req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secretToken) {
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
      let amountPaid = payment.total_amount;
      
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
          const sumPayments = allPayments.reduce((s: number, p: any) => s + p.amount, 0);

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
