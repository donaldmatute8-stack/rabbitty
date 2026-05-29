import { db } from "./src/db";
import { ownedBusinesses } from "./src/db/schema";

async function run() {
  try {
    console.log("Fetching businesses...");
    const businesses = await db.query.ownedBusinesses.findMany({
      limit: 20
    });
    console.log("Success! Raw businesses count:", businesses.length);
    
    const feedItems = businesses.map(b => ({
      id: b.id,
      user: b.name,
      device: b.category,
      time: 'Reciente',
      label: 'Cerca', 
      bunz: b.rewardPercentage,
      reward_percentage: b.rewardPercentage,
      distance: 0, 
      imageUrl: b.gallery.length > 0 ? JSON.parse(b.gallery)[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
      logo_base64: b.logoUrl,
      lat: b.lat,
      lng: b.lng,
      activeDays: JSON.parse(b.activeDays),
      startTime: b.startTime,
      endTime: b.endTime
    }));
    
    console.log("Mapped items:", feedItems);
  } catch (err) {
    console.error("Drizzle query/parse failed:", err);
  }
}

run();
