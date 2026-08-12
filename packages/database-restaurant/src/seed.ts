import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { scryptSync, randomBytes } from "crypto";
import { pathToFileURL } from "url";
import {
  restaurants,
  branches,
  menuCategories,
  menuItems,
  staff,
  tables,
  orders,
  orderItems,
  payments,
} from "./schema";

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const connectionString = process.env.RESTAURANT_DATABASE_URL;
if (!connectionString) throw new Error("RESTAURANT_DATABASE_URL not set");

const client = postgres(connectionString);
const db = drizzle(client);

export async function seed() {
  await db.insert(restaurants).values({
    id: "r1",
    businessId: "b1",
    name: "Rabbitty Café",
    slug: "rabbitty-cafe",
    currency: "MXN",
    taxRate: 0.16,
    timezone: "America/Mexico_City",
    defaultRewardRate: 20,
    acceptsBunz: true,
    isActive: true,
  }).onConflictDoNothing();

  await db.insert(branches).values([
    { id: "b1", restaurantId: "r1", name: "Sucursal Centro", address: "Av. Principal 123, Centro", phone: "555-0101", lat: 19.4326, lng: -99.1332, isActive: true },
    { id: "b2", restaurantId: "r1", name: "Sucursal Condesa", address: "Av. Ámsterdam 456, Condesa", phone: "555-0102", lat: 19.4150, lng: -99.1720, isActive: true },
  ]).onConflictDoNothing();

  await db.insert(menuCategories).values([
    { id: "c1", branchId: "b1", name: "Bebidas Calientes", description: "Cafés y tés calientes", sortOrder: 1, isActive: true },
    { id: "c2", branchId: "b1", name: "Bebidas Frías", description: "Jugos y refrescos", sortOrder: 2, isActive: true },
    { id: "c3", branchId: "b1", name: "Desayunos", description: "Desayunos tradicionales", sortOrder: 3, isActive: true },
    { id: "c4", branchId: "b1", name: "Platillos", description: "Comida en general", sortOrder: 4, isActive: true },
  ]).onConflictDoNothing();

  await db.insert(menuItems).values([
    { id: "m1", categoryId: "c1", branchId: "b1", name: "Café Americano", description: "Café negro americano", price: 45, cost: 10, imageUrl: null, sku: "CAFE-001", isActive: true, isAvailable: true, sortOrder: 1 },
    { id: "m2", categoryId: "c1", branchId: "b1", name: "Café Latte", description: "Café con leche", price: 55, cost: 15, imageUrl: null, sku: "CAFE-002", isActive: true, isAvailable: true, sortOrder: 2 },
    { id: "m3", categoryId: "c1", branchId: "b1", name: "Cappuccino", description: "Café capuchino", price: 55, cost: 15, imageUrl: null, sku: "CAFE-003", isActive: true, isAvailable: true, sortOrder: 3 },
    { id: "m4", categoryId: "c1", branchId: "b1", name: "Té Chai", description: "Té chai latte", price: 50, cost: 12, imageUrl: null, sku: "TEA-001", isActive: true, isAvailable: true, sortOrder: 4 },
    { id: "m5", categoryId: "c2", branchId: "b1", name: "Jugo de Naranja", description: "Jugo natural", price: 60, cost: 20, imageUrl: null, sku: "JUG-001", isActive: true, isAvailable: true, sortOrder: 1 },
    { id: "m6", categoryId: "c2", branchId: "b1", name: "Limonada", description: "Limonada fresca", price: 45, cost: 10, imageUrl: null, sku: "JUG-002", isActive: true, isAvailable: true, sortOrder: 2 },
    { id: "m7", categoryId: "c2", branchId: "b1", name: "Agua Mineral", description: "Agua mineral 500ml", price: 25, cost: 8, imageUrl: null, sku: "BEB-001", isActive: true, isAvailable: true, sortOrder: 3 },
    { id: "m8", categoryId: "c2", branchId: "b1", name: "Smoothie de Mango", description: "Smoothie natural de mango", price: 75, cost: 25, imageUrl: null, sku: "BEB-002", isActive: true, isAvailable: true, sortOrder: 4 },
    { id: "m9", categoryId: "c3", branchId: "b1", name: "Huevos Rancheros", description: "Huevos estilo ranchero", price: 95, cost: 30, imageUrl: null, sku: "DES-001", isActive: true, isAvailable: true, sortOrder: 1 },
    { id: "m10", categoryId: "c3", branchId: "b1", name: "Chilaquiles", description: "Chilaquiles verdes o rojos", price: 110, cost: 35, imageUrl: null, sku: "DES-002", isActive: true, isAvailable: true, sortOrder: 2 },
    { id: "m11", categoryId: "c3", branchId: "b1", name: "Hot Cakes", description: "Hot cakes con miel y fruta", price: 85, cost: 25, imageUrl: null, sku: "DES-003", isActive: true, isAvailable: true, sortOrder: 3 },
    { id: "m12", categoryId: "c4", branchId: "b1", name: "Sandwich Club", description: "Sandwich club con papas", price: 105, cost: 35, imageUrl: null, sku: "PLA-001", isActive: true, isAvailable: true, sortOrder: 1 },
    { id: "m13", categoryId: "c4", branchId: "b1", name: "Ensalada Caesar", description: "Ensalada César con pollo", price: 115, cost: 40, imageUrl: null, sku: "PLA-002", isActive: true, isAvailable: true, sortOrder: 2 },
    { id: "m14", categoryId: "c4", branchId: "b1", name: "Burger Clásica", description: "Hamburguesa con papas", price: 130, cost: 45, imageUrl: null, sku: "PLA-003", isActive: true, isAvailable: true, sortOrder: 3 },
    { id: "m15", categoryId: "c4", branchId: "b1", name: "Nachos Supreme", description: "Nachos con carne, queso y guacamole", price: 120, cost: 40, imageUrl: null, sku: "PLA-004", isActive: true, isAvailable: false, sortOrder: 4 },
  ]).onConflictDoNothing();

  await db.insert(staff).values([
    { id: "s1", userId: "u1", branchId: "b1", name: "María García", email: "maria@rabbitty.me", role: "admin", pinCode: hashPin("1234"), isActive: true },
    { id: "s2", userId: "u2", branchId: "b1", name: "Juan Pérez", email: "juan@rabbitty.me", role: "cook", pinCode: hashPin("5678"), isActive: true },
    { id: "s3", userId: "u3", branchId: "b1", name: "Ana López", email: "ana@rabbitty.me", role: "waiter", pinCode: hashPin("9012"), isActive: true },
  ]).onConflictDoNothing();

  await db.insert(tables).values([
    { id: "t1", branchId: "b1", number: 1, capacity: 2, location: "interior", qrCode: "qr-t1", isActive: true },
    { id: "t2", branchId: "b1", number: 2, capacity: 4, location: "interior", qrCode: "qr-t2", isActive: true },
    { id: "t3", branchId: "b1", number: 3, capacity: 4, location: "terraza", qrCode: "qr-t3", isActive: true },
    { id: "t4", branchId: "b1", number: 4, capacity: 6, location: "interior", qrCode: "qr-t4", isActive: true },
    { id: "t5", branchId: "b1", number: 5, capacity: 2, location: "terraza", qrCode: "qr-t5", isActive: true },
    { id: "t6", branchId: "b1", number: 6, capacity: 4, location: "interior", qrCode: "qr-t6", isActive: true },
    { id: "t7", branchId: "b1", number: 7, capacity: 8, location: "interior", qrCode: "qr-t7", isActive: true },
    { id: "t8", branchId: "b1", number: 8, capacity: 2, location: "barra", qrCode: "qr-t8", isActive: true },
    { id: "t9", branchId: "b1", number: 9, capacity: 4, location: "terraza", qrCode: "qr-t9", isActive: true },
    { id: "t10", branchId: "b1", number: 10, capacity: 6, location: "terraza", qrCode: "qr-t10", isActive: true },
    { id: "t11", branchId: "b1", number: 11, capacity: 2, location: "barra", qrCode: "qr-t11", isActive: true },
    { id: "t12", branchId: "b1", number: 12, capacity: 4, location: "interior", qrCode: "qr-t12", isActive: true },
  ]).onConflictDoNothing();

  await db.insert(orders).values([
    { id: "o1", branchId: "b1", tableId: "t2", staffId: "s3", orderType: "DINE_IN", status: "PENDING", subtotal: 185, tax: 29.6, discount: 0, tip: 0, total: 214.6, bunzReward: 37, bunzPaid: 0, notes: null, voidReason: null },
    { id: "o2", branchId: "b1", tableId: "t9", staffId: "s3", orderType: "DINE_IN", status: "PENDING", subtotal: 60, tax: 9.6, discount: 0, tip: 0, total: 69.6, bunzReward: 12, bunzPaid: 0, notes: null, voidReason: null },
  ]).onConflictDoNothing();

  await db.insert(orderItems).values([
    { id: "oi1", orderId: "o1", menuItemId: "m1", quantity: 2, unitPrice: 45, totalPrice: 90, modifiers: null, notes: null, status: "PENDING", sortOrder: 1 },
    { id: "oi2", orderId: "o1", menuItemId: "m9", quantity: 1, unitPrice: 95, totalPrice: 95, modifiers: null, notes: "Bien cocidos", status: "PENDING", sortOrder: 2 },
    { id: "oi3", orderId: "o2", menuItemId: "m5", quantity: 1, unitPrice: 60, totalPrice: 60, modifiers: null, notes: null, status: "PENDING", sortOrder: 1 },
  ]).onConflictDoNothing();

  await db.insert(payments).values([
    { id: "p1", orderId: "o1", method: "cash", amount: 214.6, reference: null, status: "COMPLETED" },
  ]).onConflictDoNothing();

  console.log("Restaurant DB seeded successfully");
  await client.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  });
}
