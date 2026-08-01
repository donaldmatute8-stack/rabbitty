import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users,
  ownedBusinesses,
  levels,
  achievements,
  hatTricks,
} from "./schema";

const connectionString = process.env.CORE_DATABASE_URL;
if (!connectionString) throw new Error("CORE_DATABASE_URL not set");

const client = postgres(connectionString);
const db = drizzle(client);

export async function seed() {
  const sampleLevels = [
    { id: "l1", name: "Conejito", requiredHops: 0, bunzMultiplier: 1.0, premiumAccess: false },
    { id: "l2", name: "Liebre", requiredHops: 10, bunzMultiplier: 1.5, premiumAccess: false },
  ];

  for (const level of sampleLevels) {
    await db.insert(levels).values(level).onConflictDoNothing();
  }

  const sampleAchievements = [
    { id: "a1", name: "Primera Visita", description: "Realiza tu primera visita a un negocio", iconUrl: "/icons/first-visit.png", conditionType: "VISITS", conditionTarget: 1 },
    { id: "a2", name: "Coleccionista", description: "Visita 5 negocios diferentes", iconUrl: "/icons/collector.png", conditionType: "VISITS", conditionTarget: 5 },
    { id: "a3", name: "Bunz Master", description: "Acumula 1000 Bunz", iconUrl: "/icons/bunz-master.png", conditionType: "BUNZ_EARNED", conditionTarget: 1000 },
  ];

  for (const achievement of sampleAchievements) {
    await db.insert(achievements).values(achievement).onConflictDoNothing();
  }

  const sampleHatTricks = [
    { id: "ht1", title: "Racha de Café", description: "Visita 3 cafeterías en una semana", rewardHops: 5, rewardBunz: 50, conditionType: "VISIT_STREAK", conditionTarget: 3, conditionCategory: "cafe", isActive: true },
    { id: "ht2", title: "Fin de Semana", description: "Visita cualquier negocio sábado y domingo", rewardHops: 3, rewardBunz: 30, conditionType: "WEEKEND_VISITS", conditionTarget: 2, isActive: true },
  ];

  for (const trick of sampleHatTricks) {
    await db.insert(hatTricks).values(trick).onConflictDoNothing();
  }

  const u1Id = crypto.randomUUID();
  const u2Id = crypto.randomUUID();
  const u3Id = crypto.randomUUID();
  const u4Id = crypto.randomUUID();
  const u5Id = crypto.randomUUID();

  const sampleUsers = [
    { id: u1Id, telegramId: "100001", username: "alice", firstName: "Alice", lastName: "García", email: "alice@test.me", levelId: "l2", totalBunzEarned: 500, totalBunzSpent: 100, visitedBusinesses: 3, role: "USER", hasMadeFirstTransaction: true, hasEarnedFirstBunz: true, hops: 12 },
    { id: u2Id, telegramId: "100002", username: "bob", firstName: "Bob", lastName: "Pérez", email: "bob@test.me", levelId: "l1", totalBunzEarned: 200, totalBunzSpent: 50, visitedBusinesses: 2, role: "USER", hasMadeFirstTransaction: true, hasEarnedFirstBunz: true, hops: 5 },
    { id: u3Id, telegramId: "100003", username: "carol", firstName: "Carol", lastName: "López", email: "carol@test.me", levelId: "l1", totalBunzEarned: 50, totalBunzSpent: 0, visitedBusinesses: 1, role: "USER", hasMadeFirstTransaction: false, hasEarnedFirstBunz: true, hops: 2 },
    { id: u4Id, telegramId: "100004", username: "dave", firstName: "Dave", lastName: "Martínez", email: "dave@test.me", levelId: "l1", totalBunzEarned: 0, totalBunzSpent: 0, visitedBusinesses: 0, role: "USER", hasMadeFirstTransaction: false, hasEarnedFirstBunz: false, hops: 0 },
    { id: u5Id, telegramId: "100005", username: "eve", firstName: "Eve", lastName: "Rodríguez", email: "eve@test.me", levelId: "l2", totalBunzEarned: 1000, totalBunzSpent: 300, visitedBusinesses: 5, role: "USER", hasMadeFirstTransaction: true, hasEarnedFirstBunz: true, hops: 20 },
  ];

  for (const user of sampleUsers) {
    await db.insert(users).values(user).onConflictDoNothing();
  }
  const [firstUser] = await db.select().from(users).limit(1);
  const ownerId = firstUser ? firstUser.id : u1Id;

  const sampleBusinesses = [
    { id: crypto.randomUUID(), ownerId, name: "Café Rabbitty Centro", category: "cafe", description: "Cafetería de especialidad en el centro", address: "Av. Principal 123, Centro", lat: 19.4326, lng: -99.1332, logoUrl: "/logos/rabbitty-centro.png", rewardPercentage: 10, rarity: "common", givesBunz: true, acceptsBunz: true, status: "APPROVED", activeDays: "[1,2,3,4,5,6,7]", startTime: "07:00", endTime: "22:00", timezone: "America/Mexico_City" },
    { id: crypto.randomUUID(), ownerId, name: "Tacos El Conejo", category: "restaurant", description: "Taquería tradicional", address: "Calle Hidalgo 456, Colonia Centro", lat: 19.4330, lng: -99.1340, logoUrl: "/logos/tacos-conejo.png", rewardPercentage: 15, rarity: "uncommon", givesBunz: true, acceptsBunz: false, status: "APPROVED", activeDays: "[1,2,3,4,5,6]", startTime: "18:00", endTime: "02:00", timezone: "America/Mexico_City" },
    { id: crypto.randomUUID(), ownerId, name: "Bunz Store Condesa", category: "retail", description: "Tienda de productos exclusivos", address: "Av. Ámsterdam 789, Condesa", lat: 19.4150, lng: -99.1720, logoUrl: "/logos/bunz-store.png", rewardPercentage: 20, rarity: "rare", givesBunz: true, acceptsBunz: true, status: "APPROVED", activeDays: "[1,2,3,4,5,6,7]", startTime: "10:00", endTime: "20:00", timezone: "America/Mexico_City" },
  ];

  for (const business of sampleBusinesses) {
    await db.insert(ownedBusinesses).values(business).onConflictDoNothing();
  }

  console.log("Core DB seeded successfully");
  await client.end();
}
