import { pgTable, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  telegramId: text("telegramId").notNull().unique(),
  username: text("username"),
  firstName: text("firstName"),
  lastName: text("lastName"),
  tonWalletAddress: text("tonWalletAddress").unique(),
  totalBunzEarned: integer("totalBunzEarned").default(0).notNull(),
  visitedBusinesses: integer("visitedBusinesses").default(0).notNull(),
  role: text("role").default("USER").notNull(), // USER, AFFILIATE, ADMIN
  hasMadeFirstTransaction: boolean("hasMadeFirstTransaction").default(false).notNull(),
  hasEarnedFirstBunz: boolean("hasEarnedFirstBunz").default(false).notNull(),
  
  hops: integer("hops").default(0).notNull(),
  levelId: text("levelId"), // References levels.id
  
  
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const webSessions = pgTable("webSessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jwtToken: text("jwtToken").notNull().unique(),
  userId: text("userId").references(() => users.id),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const ownedBusinesses = pgTable("ownedBusinesses", {
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

  rewardPercentage: integer("rewardPercentage").default(10).notNull(),
  rarity: text("rarity").default("common").notNull(), // common, rare, epic, legendary

  givesBunz: boolean("givesBunz").default(true).notNull(),
  acceptsBunz: boolean("acceptsBunz").default(false).notNull(),

  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),

  status: text("status").default("PENDING_VERIFICATION").notNull(),
  verificationMethod: text("verificationMethod"),
  verificationData: text("verificationData"),

  activeDays: text("activeDays").default("[1,2,3,4,5,6,7]").notNull(),
  startTime: text("startTime").default("00:00").notNull(),
  endTime: text("endTime").default("23:59").notNull(),
  timezone: text("timezone").default("America/Mexico_City").notNull(),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id),

  fiatAmount: real("fiatAmount").notNull(),
  bunzMinted: integer("bunzMinted").notNull(),

  status: text("status").default("PENDING").notNull(), // PENDING, MINTED, FAILED
  txHash: text("txHash"),
  errorMessage: text("errorMessage"),
  ticketUrl: text("ticketUrl"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  participant1: text("participant1").notNull(),
  participant2: text("participant2").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversationId").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: text("senderId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

// ─── QR Login Sessions ─────────────────────────────────────────────
export const qrSessions = pgTable("qrSessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  userId: text("userId").references(() => users.id),
  status: text("status").default("PENDING").notNull(), // PENDING, APPROVED, EXPIRED
  createdAt: timestamp("createdAt").defaultNow(),
  expiresAt: timestamp("expiresAt").notNull(),
});

// ─── Rabbitty v2: Reservations, Referrals, Notifications ────────────

export const reservations = pgTable("reservations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id),
  title: text("title").notNull(),
  bunzCost: integer("bunzCost").notNull(),
  status: text("status").default("PENDING").notNull(), // PENDING, CONFIRMED, COMPLETED, REJECTED, CANCELLED
  date: timestamp("date").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  inviterId: text("inviterId").notNull().references(() => users.id),
  invitedId: text("invitedId").notNull().references(() => users.id),
  status: text("status").default("PENDING").notNull(), // PENDING, COMPLETED
  rewardAmount: integer("rewardAmount").default(50).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  type: text("type").default("SYSTEM").notNull(), // SYSTEM, REWARD, REFERRAL, RESERVATION
  createdAt: timestamp("createdAt").defaultNow(),
});

// ─── Gamification: Levels, Hat Tricks, Achievements ────────────────

export const levels = pgTable("levels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  requiredHops: integer("requiredHops").notNull(),
  bunzMultiplier: real("bunzMultiplier").default(1.0).notNull(), // e.g. 1.05 = +5% bunz
  premiumAccess: boolean("premiumAccess").default(false).notNull(),
});

export const hatTricks = pgTable("hat_tricks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rewardHops: integer("rewardHops").default(0).notNull(),
  rewardBunz: integer("rewardBunz").default(0).notNull(),
  conditionType: text("conditionType").notNull(), // TOTAL_VISITS, CATEGORY_VISITS, TIME_BASED_VISITS
  conditionTarget: integer("conditionTarget").notNull(),
  conditionCategory: text("conditionCategory"), // Optional, e.g. "Cafetería"
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const userHatTricks = pgTable("user_hat_tricks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id),
  trickId: text("trickId").notNull().references(() => hatTricks.id),
  progressValue: integer("progressValue").default(0).notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
});

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("iconUrl").notNull(),
  conditionType: text("conditionType").notNull(),
  conditionTarget: integer("conditionTarget").notNull(),
});

export const userAchievements = pgTable("user_achievements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull().references(() => users.id),
  achievementId: text("achievementId").notNull().references(() => achievements.id),
  unlockedAt: timestamp("unlockedAt").defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(ownedBusinesses),
  transactions: many(transactions),
  sessions: many(webSessions),
  reservations: many(reservations),
  notifications: many(notifications),
  referralsInvited: many(referrals, { relationName: "invitedRelation" }),
  referralsInvitedBy: many(referrals, { relationName: "inviterRelation" }),
  userHatTricks: many(userHatTricks),
  userAchievements: many(userAchievements),
}));

export const levelsRelations = relations(levels, ({ many }) => ({
  users: many(users),
}));

export const webSessionsRelations = relations(webSessions, ({ one }) => ({
  user: one(users, { fields: [webSessions.userId], references: [users.id] }),
}));

export const ownedBusinessesRelations = relations(ownedBusinesses, ({ one, many }) => ({
  owner: one(users, { fields: [ownedBusinesses.ownerId], references: [users.id] }),
  transactions: many(transactions),
  reservations: many(reservations),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  business: one(ownedBusinesses, { fields: [transactions.businessId], references: [ownedBusinesses.id] }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const qrSessionsRelations = relations(qrSessions, ({ one }) => ({
  user: one(users, { fields: [qrSessions.userId], references: [users.id] }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  user: one(users, { fields: [reservations.userId], references: [users.id] }),
  business: one(ownedBusinesses, { fields: [reservations.businessId], references: [ownedBusinesses.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  inviter: one(users, { fields: [referrals.inviterId], references: [users.id], relationName: "inviterRelation" }),
  invited: one(users, { fields: [referrals.invitedId], references: [users.id], relationName: "invitedRelation" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const userHatTricksRelations = relations(userHatTricks, ({ one }) => ({
  user: one(users, { fields: [userHatTricks.userId], references: [users.id] }),
  trick: one(hatTricks, { fields: [userHatTricks.trickId], references: [hatTricks.id] }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}));
