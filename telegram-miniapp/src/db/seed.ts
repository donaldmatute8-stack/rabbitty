import { db } from "./index";
import { users, ownedBusinesses } from "./schema";
import { eq } from "drizzle-orm";

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

  // Clear existing mock data to allow re-seeding
  await db.delete(ownedBusinesses).where(eq(ownedBusinesses.ownerId, mockOwnerId));

  // Insert mock businesses
  await db.insert(ownedBusinesses).values([
    {
      ownerId: mockOwnerId,
      name: "Kukara",
      category: "Restaurante",
      description: "Restaurante y Bar",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.756226,
      lng: -105.341038,
      rewardPercentage: 15,
      rarity: "legendary",
      givesBunz: true,
      acceptsBunz: true,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    },
    {
      ownerId: mockOwnerId,
      name: "626 Cafe",
      category: "Cafetería",
      description: "Cafetería de especialidad",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.753218,
      lng: -105.335402,
      rewardPercentage: 10,
      rarity: "epic",
      givesBunz: true,
      acceptsBunz: true,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    },
    {
      ownerId: mockOwnerId,
      name: "Pizza Napoli",
      category: "Restaurante",
      description: "La mejor pizza de la bahía",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.754500,
      lng: -105.338000,
      rewardPercentage: 7,
      rarity: "rare",
      givesBunz: true,
      acceptsBunz: false,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    },
    {
      ownerId: mockOwnerId,
      name: "TechZone",
      category: "Servicios Digitales",
      description: "Electrónica y accesorios",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.752000,
      lng: -105.336000,
      rewardPercentage: 3,
      rarity: "common",
      givesBunz: true,
      acceptsBunz: false,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1550009158-9effb6ce1764?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    },
    {
      ownerId: mockOwnerId,
      name: "Rabbitty Store",
      category: "Otros",
      description: "Mercancía oficial",
      address: "Bucerías, Bahía de Banderas, Nayarit",
      lat: 20.755500,
      lng: -105.339500,
      rewardPercentage: 0,
      rarity: "common",
      givesBunz: false,
      acceptsBunz: true,
      gallery: JSON.stringify(["https://images.unsplash.com/photo-1521566652839-697aa473761a?auto=format&fit=crop&w=800&q=80"]),
      logoUrl: "",
      status: "APPROVED"
    }
  ]).onConflictDoNothing();

  console.log("Database seeded successfully!");
}

seed().catch(console.error);
