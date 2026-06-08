import { pgTable, text, integer, real, timestamp, boolean, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () => uuid("id").defaultRandom().primaryKey();
const fkId = (field: string) => uuid(field).notNull();
const fkIdOpt = (field: string) => uuid(field);
const timestamps = {
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
};

export const users = pgTable("users", {
  id: id(),
  telegramId: text("telegramId").notNull().unique(),
  username: text("username"),
  phoneNumber: text("phoneNumber").unique(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: text("email").unique(),
  tonWalletAddress: text("tonWalletAddress").unique(),
  totalBunzEarned: integer("totalBunzEarned").default(0).notNull(),
  totalBunzSpent: integer("totalBunzSpent").default(0).notNull(),
  visitedBusinesses: integer("visitedBusinesses").default(0).notNull(),
  role: text("role").default("USER").notNull(),
  hasMadeFirstTransaction: boolean("hasMadeFirstTransaction").default(false).notNull(),
  hasEarnedFirstBunz: boolean("hasEarnedFirstBunz").default(false).notNull(),
  hops: integer("hops").default(0).notNull(),
  levelId: text("levelId"),
  ...timestamps,
});

export const webSessions = pgTable("webSessions", {
  id: id(),
  jwtToken: text("jwtToken").notNull().unique(),
  userId: fkIdOpt("userId").references(() => users.id),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const ownedBusinesses = pgTable("ownedBusinesses", {
  id: id(),
  ownerId: fkId("ownerId").references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  logoUrl: text("logoUrl"),
  gallery: text("gallery").default("[]").notNull(),
  rewardPercentage: integer("rewardPercentage").default(10).notNull(),
  rarity: text("rarity").default("common").notNull(),
  givesBunz: boolean("givesBunz").default(true).notNull(),
  acceptsBunz: boolean("acceptsBunz").default(false).notNull(),
  status: text("status").default("PENDING_VERIFICATION").notNull(),
  verificationMethod: text("verificationMethod"),
  verificationData: text("verificationData"),
  activeDays: text("activeDays").default("[1,2,3,4,5,6,7]").notNull(),
  startTime: text("startTime").default("00:00").notNull(),
  endTime: text("endTime").default("23:59").notNull(),
  timezone: text("timezone").default("America/Mexico_City").notNull(),
  ...timestamps,
});

export const transactions = pgTable("transactions", {
  id: id(),
  userId: fkId("userId").references(() => users.id),
  businessId: fkId("businessId").references(() => ownedBusinesses.id),
  fiatAmount: real("fiatAmount").notNull(),
  bunzMinted: integer("bunzMinted").notNull(),
  status: text("status").default("PENDING").notNull(),
  txHash: text("txHash"),
  errorMessage: text("errorMessage"),
  ticketUrl: text("ticketUrl"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const pendingVaults = pgTable("pendingVaults", {
  id: id(),
  phoneNumber: text("phoneNumber").notNull(),
  bunzAmount: integer("bunzAmount").notNull(),
  businessId: fkIdOpt("businessId").references(() => ownedBusinesses.id),
  orderId: text("orderId"),
  status: text("status").default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export const levels = pgTable("levels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  requiredHops: integer("requiredHops").notNull(),
  bunzMultiplier: real("bunzMultiplier").default(1.0).notNull(),
  premiumAccess: boolean("premiumAccess").default(false).notNull(),
});

export const hatTricks = pgTable("hat_tricks", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rewardHops: integer("rewardHops").default(0).notNull(),
  rewardBunz: integer("rewardBunz").default(0).notNull(),
  conditionType: text("conditionType").notNull(),
  conditionTarget: integer("conditionTarget").notNull(),
  conditionCategory: text("conditionCategory"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const userHatTricks = pgTable("user_hat_tricks", {
  id: id(),
  userId: fkId("userId").references(() => users.id),
  trickId: fkId("trickId").references(() => hatTricks.id),
  progressValue: integer("progressValue").default(0).notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
});

export const achievements = pgTable("achievements", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("iconUrl").notNull(),
  conditionType: text("conditionType").notNull(),
  conditionTarget: integer("conditionTarget").notNull(),
});

export const userAchievements = pgTable("user_achievements", {
  id: id(),
  userId: fkId("userId").references(() => users.id),
  achievementId: fkId("achievementId").references(() => achievements.id),
  unlockedAt: timestamp("unlockedAt").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: id(),
  inviterId: fkId("inviterId").references(() => users.id),
  invitedId: fkId("invitedId").references(() => users.id),
  status: text("status").default("PENDING").notNull(),
  rewardAmount: integer("rewardAmount").default(50).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: id(),
  userId: fkId("userId").references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  type: text("type").default("SYSTEM").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: id(),
  participant1: text("participant1").notNull(),
  participant2: text("participant2").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const messages = pgTable("messages", {
  id: id(),
  conversationId: fkId("conversationId").references(() => conversations.id, { onDelete: "cascade" }),
  senderId: text("senderId").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const qrSessions = pgTable("qrSessions", {
  id: id(),
  token: text("token").notNull().unique(),
  userId: fkIdOpt("userId").references(() => users.id),
  status: text("status").default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export const reservations = pgTable("reservations", {
  id: id(),
  userId: fkId("userId").references(() => users.id),
  businessId: fkId("businessId").references(() => ownedBusinesses.id),
  title: text("title").notNull(),
  bunzCost: integer("bunzCost").notNull(),
  status: text("status").default("PENDING").notNull(),
  date: timestamp("date").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});
