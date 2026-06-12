import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
