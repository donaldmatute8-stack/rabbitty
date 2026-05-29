const token = "8707174381:AAEMPvzE-j123z1bETTZEDDtJCURiE--yiI";
const webhookUrl = "https://telegram-miniapp-lyart-gamma.vercel.app/api/bot/webhook";

async function run() {
  try {
    console.log("Setting webhook...");
    const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const setData = await setRes.json();
    console.log("setWebhook response:", setData);

    console.log("Setting default menu button...");
    const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "🐰 Abrir Rabbitty",
          web_app: {
            url: "https://telegram-miniapp-lyart-gamma.vercel.app"
          }
        }
      })
    });
    const menuData = await menuRes.json();
    console.log("setChatMenuButton response:", menuData);

    console.log("Webhook info:");
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoData = await infoRes.json();
    console.log(infoData);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
