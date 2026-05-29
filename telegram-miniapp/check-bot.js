const token = "8707174381:AAEMPvzE-j123z1bETTZEDDtJCURiE--yiI";

async function run() {
  try {
    console.log("Fetching updates...");
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    console.log("Updates:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
