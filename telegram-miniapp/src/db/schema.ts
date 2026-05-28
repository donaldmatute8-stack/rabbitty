import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  telegramId: text("telegramId").notNull().unique(),
  username: text("username"),
  firstName: text("firstName"),
  lastName: text("lastName"),
  tonWalletAddress: text("tonWalletAddress").unique(),
  totalBunzEarned: integer("totalBunzEarned").default(0).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).$defaultFn(() => new Date()), // simplified auto-update
});

export const webSessions = sqliteTable("webSessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jwtToken: text("jwtToken").notNull().unique(),
  userId: text("userId").references(() => users.id),
  expiresAt: integer("expiresAt", { mode: 'timestamp' }).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const ownedBusinesses = sqliteTable("ownedBusinesses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("ownerId").notNull().references(() => users.id),
  
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  
  logoUrl: text("logoUrl"),
  gallery: text("gallery").default("[]").notNull(), // JSON string of URLs
  
  rewardPercentage: integer("rewardPercentage").default(10).notNull(), // e.g. 15%
  
  createdAt: integer("createdAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  
  status: text("status").default("PENDING_VERIFICATION").notNull(), // PENDING_VERIFICATION, APPROVED, REJECTED
  verificationMethod: text("verificationMethod"),
  verificationData: text("verificationData"),

  activeDays: text("activeDays").default("[1,2,3,4,5,6,7]").notNull(), // JSON string of ints
  startTime: text("startTime").default("00:00").notNull(),
  endTime: text("endTime").default("23:59").notNull(),
  timezone: text("timezone").default("America/Mexico_City").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id),
  
  fiatAmount: real("fiatAmount").notNull(),
  bunzMinted: integer("bunzMinted").notNull(),
  
  status: text("status").default("PENDING").notNull(), // PENDING, MINTED, FAILED
  txHash: text("txHash"),
  errorMessage: text("errorMessage"),
  ticketUrl: text("ticketUrl"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  participant1: text("participant1").notNull(),
  participant2: text("participant2").notNull(),
  
  createdAt: integer("createdAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  
  senderId: text("senderId").notNull(),
  content: text("content").notNull(),
  
  createdAt: integer("createdAt", { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(ownedBusinesses),
  transactions: many(transactions),
  sessions: many(webSessions),
}));

export const webSessionsRelations = relations(webSessions, ({ one }) => ({
  user: one(users, {
    fields: [webSessions.userId],
    references: [users.id],
  }),
}));

export const ownedBusinessesRelations = relations(ownedBusinesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [ownedBusinesses.ownerId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  business: one(ownedBusinesses, {
    fields: [transactions.businessId],
    references: [ownedBusinesses.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
