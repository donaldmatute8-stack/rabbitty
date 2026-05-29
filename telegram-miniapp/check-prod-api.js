async function run() {
  const host = "https://telegram-miniapp-lyart-gamma.vercel.app";
  try {
    console.log("Fetching /api/feed...");
    const res1 = await fetch(`${host}/api/feed`);
    const data1 = await res1.text();
    console.log("Feed response length:", data1.length);
    console.log("Feed response preview:", data1.slice(0, 1000));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
