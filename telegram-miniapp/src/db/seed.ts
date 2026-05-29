import { db } from "./index";
import { users, ownedBusinesses } from "./schema";

async function seed() {
  console.log("Seeding database...");

  // Create a default owner user for the businesses
  const [owner] = await db.insert(users).values({
    telegramId: "system_owner",
    firstName: "System",
    lastName: "Owner",
    username: "system_owner",
  }).onConflictDoNothing().returning();

  const mockOwnerId = owner ? owner.id : (await db.query.users.findFirst({ where: (users, { eq }) => eq(users.telegramId, "system_owner") }))?.id;

  if (!mockOwnerId) {
    throw new Error("Could not create or find owner user");
  }

  // Insert mock businesses
  await db.insert(ownedBusinesses).values([
    {
      ownerId: mockOwnerId,
      name: "Kukara",
      category: "Restaurant",
      description: "Restaurante y Bar",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.756226,
      lng: -105.341038,
      rewardPercentage: 15,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    },
    {
      ownerId: mockOwnerId,
      name: "626 Cafe",
      category: "Cafe",
      description: "Cafetería de especialidad",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.753218,
      lng: -105.335402,
      rewardPercentage: 10,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    }
  ]).onConflictDoNothing();

  console.log("Database seeded successfully!");
}

seed().catch(console.error);
