import { pgTable, text, integer, real, timestamp, boolean, uuid, jsonb, customType, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () => uuid("id").defaultRandom().$defaultFn(() => crypto.randomUUID()).primaryKey();
const fkId = (field: string) => uuid(field).notNull();
const fkIdOpt = (field: string) => uuid(field);
const timestamps = {
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
};

export const users = pgTable("users", {
  id: id(),
  telegramId: text("telegramId").unique(),
  username: text("username").unique(),
  phoneNumber: text("phoneNumber").unique(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: text("email").unique(),
  tonWalletAddress: text("tonWalletAddress").unique(),
  totalBunzEarned: integer("totalBunzEarned").default(0).notNull(),
  totalBunzSpent: integer("totalBunzSpent").default(0).notNull(),
  pendingDebtBunz: integer("pendingDebtBunz").default(0).notNull(), // Offline debt
  visitedBusinesses: integer("visitedBusinesses").default(0).notNull(),
  role: text("role").default("USER").notNull(),
  hasMadeFirstTransaction: boolean("hasMadeFirstTransaction").default(false).notNull(),
  hasEarnedFirstBunz: boolean("hasEarnedFirstBunz").default(false).notNull(),
  hops: integer("hops").default(0).notNull(),
  levelId: text("levelId"),
  supportWhatsApp: text("supportWhatsApp"),
  totpSecret: text("totpSecret"),
  totpEnabled: boolean("totpEnabled").default(false).notNull(),
  requireTotpForLogin: boolean("requireTotpForLogin").default(false).notNull(),
  twoFactorMethods: text("twoFactorMethods").default("[]").notNull(), // JSON: ["email","phone"] (OTP); TOTP se deriva de totpEnabled
  ...timestamps,
});

export const verificationTokens = pgTable("verificationTokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().primaryKey(),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const webSessions = pgTable("webSessions", {
  id: id(),
  jwtToken: text("jwtToken").notNull().unique(),
  userId: fkIdOpt("userId").references(() => users.id),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const auditEntries = pgTable("auditEntries", {
  id: id(),
  userId: text("userId"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resourceId"),
  details: text("details"),
  ipAddress: text("ipAddress"),
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
  package: text("package"), // Starter, Growth, Pro, Enterprise
  creditLimit: integer("creditLimit").default(0).notNull(), // Máximo de Bunz que puede mintear
  creditUsed: integer("creditUsed").default(0).notNull(),   // Bunz ya minteados
  givesBunz: boolean("givesBunz").default(true).notNull(),
  acceptsBunz: boolean("acceptsBunz").default(false).notNull(),
  bunzBalance: integer("bunzBalance").default(0).notNull(), // Inventario de Bunz del restaurante
  status: text("status").default("PENDING_VERIFICATION").notNull(),
  verificationMethod: text("verificationMethod"),
  verificationData: text("verificationData"),
  activeDays: text("activeDays").default("[1,2,3,4,5,6,7]").notNull(),
  startTime: text("startTime").default("00:00").notNull(),
  endTime: text("endTime").default("23:59").notNull(),
  timezone: text("timezone").default("America/Mexico_City").notNull(),
  slug: text("slug").unique(),
  chatReplyChannel: text("chatReplyChannel").default("hybrid").notNull(), // 'hybrid' | 'telegram' | 'admin' | 'mobile'
  hops: integer("hops").default(0).notNull(),
  savedCount: integer("savedCount").default(0).notNull(),
  sharedCount: integer("sharedCount").default(0).notNull(),
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
  participant1TypingAt: timestamp("participant1TypingAt"),
  participant2TypingAt: timestamp("participant2TypingAt"),
  lastMessageAt: timestamp("lastMessageAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const messages = pgTable("messages", {
  id: id(),
  conversationId: fkId("conversationId").references(() => conversations.id, { onDelete: "cascade" }),
  senderId: text("senderId").notNull(),
  content: text("content").notNull(),
  type: text("type").default("TEXT").notNull(),
  metadata: jsonb("metadata"),
  readAt: timestamp("readAt"),
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

export const billingProfiles = pgTable("billingProfiles", {
  id: id(),
  userId: fkId("userId").references(() => users.id),
  rfc: text("rfc").notNull(),
  legalName: text("legalName").notNull(),
  taxRegime: text("taxRegime").notNull(),
  zipCode: text("zipCode").notNull(),
  cfdiUse: text("cfdiUse").default("G03").notNull(),
  email: text("email").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  ...timestamps,
});

export const passkeys = pgTable("passkeys", {
  id: id(),
  userId: fkId("userId").references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credentialId").notNull().unique(),
  publicKey: text("publicKey").notNull(),
  counter: integer("counter").default(0).notNull(),
  transports: text("transports").default("[]").notNull(),
  deviceName: text("deviceName"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const systemSettings = pgTable("systemSettings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const treasury = pgTable("treasury", {
  id: id(),
  concept: text("concept").notNull(),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'fee', 'package_sale', 'transfer', etc.
  referenceId: text("referenceId"), // business ID, transaction ID
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const trustedSessions = pgTable("trustedSessions", {
  id: id(),
  userId: fkId("userId").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  deviceName: text("deviceName"),
  userAgent: text("userAgent"),
  ipAddress: text("ipAddress"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const pushDevices = pgTable("pushDevices", {
  id: id(),
  userId: fkId("userId").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: text("platform").default("unknown").notNull(), // 'ios' | 'android'
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

/**
 * Rabbitty Mood: Anonymous, aggregated environmental & sensory preferences
 * mood: 'calm' | 'energy' | 'focus' | 'celebration' | 'connection' | 'surprise'
 */
export const moodEvents = pgTable("moodEvents", {
  id: id(),
  userId: text("userId"), // Optional pseudonymized ID for personal recommendations
  businessId: text("businessId").references(() => ownedBusinesses.id, { onDelete: "set null" }),
  mood: text("mood").notNull(), // 'calm' | 'energy' | 'focus' | 'celebration' | 'connection' | 'surprise'
  source: text("source").default("checkin").notNull(), // 'checkin' | 'qr' | 'manual'
  rating: integer("rating"), // Optional 1-5 feedback after experience
  feedbackNote: text("feedbackNote"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Contextual campaigns run by affiliates based on atmosphere (e.g. "Pausa Tranquila" in slow hours)
 */
export const moodCampaigns = pgTable("moodCampaigns", {
  id: id(),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  targetMood: text("targetMood").notNull(), // Target mood
  rewardBunz: integer("rewardBunz").default(0).notNull(),
  startHour: integer("startHour").default(0).notNull(), // 0-23
  endHour: integer("endHour").default(23).notNull(),   // 0-23
  isActive: boolean("isActive").default(true).notNull(),
  ...timestamps,
});

/**
 * Proof of Atmosphere (PoA): Operational atmosphere recipe activations logged by staff/owner
 */
export const atmosphereInterventions = pgTable("atmosphereInterventions", {
  id: id(),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id, { onDelete: "cascade" }),
  recipeType: text("recipeType").notNull(), // 'calm' | 'energy' | 'focus' | 'celebration' | 'connection' | 'surprise'
  staffId: text("staffId"), // optional staff who activated it
  soundtrackApplied: text("soundtrackApplied"),
  lightingApplied: text("lightingApplied"),
  roomAction: text("roomAction"),
  notes: text("notes"),
  executedAt: timestamp("executedAt").defaultNow().notNull(),
});

/**
 * Rabbitty Vibe Passport: User stamps for completing stops along curated city routes
 */
export const vibePassportStamps = pgTable("vibePassportStamps", {
  id: id(),
  userId: text("userId").notNull(),
  routeId: text("routeId").notNull(), // e.g. 'deep-work-flow', 'golden-hour-social'
  stopOrder: integer("stopOrder").notNull(), // 1, 2, 3
  businessId: text("businessId").references(() => ownedBusinesses.id, { onDelete: "set null" }),
  vibe: text("vibe").notNull(), // 'focus', 'energy', 'calm', etc.
  transactionId: text("transactionId"), // optional link to verified payment transaction
  stampedAt: timestamp("stampedAt").defaultNow().notNull(),
});

// Custom pgvector type compatible with Neon PostgreSQL
const vectorType = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

/**
 * 🧠 Knowledge Chunks (RAG Semántico Aislado)
 * Fragmentos indexados con control estricto de ámbito y tenant/business.
 */
export const knowledgeChunks = pgTable(
  "knowledgeChunks",
  {
    id: id(),
    businessId: text("businessId").references(() => ownedBusinesses.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(), // 'GLOBAL' | 'AFFILIATE' | 'SUPPORT' | 'LEGAL'
    sourceType: text("sourceType").notNull(), // 'BUSINESS_PROFILE' | 'FAQ' | 'MENU_ITEM' | 'POLICY'
    sourceId: text("sourceId").notNull(),
    content: text("content").notNull(),
    contentHash: text("contentHash").notNull(),
    embedding: vectorType("embedding"),
    embeddingModel: text("embeddingModel").default("text-embedding-3-small").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("knowledge_chunks_source_uidx").on(table.sourceType, table.sourceId),
  ]
);

/**
 * 👤 User Memories (MAG Seguro y Controlado)
 * Preferencias declaradas o deducidas de los Rabbitters, con procedencia y expiración.
 */
export const userMemories = pgTable(
  "userMemories",
  {
    id: id(),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // e.g. 'dietary_vegan', 'favorite_drink', 'ambiance_preference'
    value: text("value").notNull(),
    confidenceScore: real("confidenceScore").default(1.0).notNull(), // 1.0 = Explícito, <0.8 = Inferencia
    source: text("source").default("EXPLICIT_USER_INPUT").notNull(), // 'EXPLICIT_USER_INPUT' | 'OBSERVED_BEHAVIOR'
    expiresAt: timestamp("expiresAt"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_memories_user_key_uidx").on(table.userId, table.key),
  ]
);

/**
 * 🏢 Business Learning Insights
 * Patrones comerciales agregados con muestra, periodo y confianza verificables.
 */
export const businessLearningInsights = pgTable("businessLearningInsights", {
  id: id(),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id, { onDelete: "cascade" }),
  insightType: text("insightType").notNull(), // 'OPTIMAL_REWARD_RATE' | 'PEAK_MOOD_HOURS' | 'ATMOSPHERE_LIFT'
  periodAnalyzed: text("periodAnalyzed").notNull(), // e.g. 'LAST_30_DAYS'
  sampleSize: integer("sampleSize").notNull(),
  confidenceScore: real("confidenceScore").notNull(),
  recommendation: text("recommendation").notNull(),
  metricsBasis: jsonb("metricsBasis").notNull(),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

/**
 * 📥 Memory Candidates
 * Búfer de extracción asíncrona para no bloquear latencia de chat ni llamadas al LLM.
 */
export const memoryCandidates = pgTable("memoryCandidates", {
  id: id(),
  userId: text("userId").references(() => users.id, { onDelete: "cascade" }),
  businessId: text("businessId").references(() => ownedBusinesses.id, { onDelete: "cascade" }),
  rawInput: text("rawInput").notNull(),
  extractedKey: text("extractedKey").notNull(),
  extractedValue: text("extractedValue").notNull(),
  status: text("status").default("PENDING").notNull(), // 'PENDING' | 'CONSOLIDATED' | 'DISCARDED'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * 🎯 Affiliate Growth Campaigns
 * Modelo persistente y financiero de campañas comerciales activadas por el afiliado.
 */
export const affiliateCampaigns = pgTable("affiliateCampaigns", {
  id: id(),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id, { onDelete: "cascade" }),
  createdBy: text("createdBy").notNull().references(() => users.id),
  approvedBy: text("approvedBy").references(() => users.id),
  title: text("title").notNull(),
  headline: text("headline").notNull(),
  message: text("message").notNull(),
  campaignType: text("campaignType").notNull(), // 'WINBACK_INACTIVE' | 'OFF_PEAK_BOOST' | 'VIP_LOYALTY' | 'FLASH_OFFER'
  targetSegment: text("targetSegment").notNull(), // 'INACTIVE_25D' | 'VIP_5_VISITS' | 'ALL_CUSTOMERS'
  rewardPercentage: integer("rewardPercentage").notNull(), // % de cashback en Bunz
  maxRewardPerUser: integer("maxRewardPerUser").default(50).notNull(), // Tope máximo de Bunz por usuario
  budgetBunz: integer("budgetBunz").notNull(), // Presupuesto total asignado a la campaña
  budgetSpent: integer("budgetSpent").default(0).notNull(), // Bunz redimidos
  redemptionCount: integer("redemptionCount").default(0).notNull(), // Clientes que redimieron
  startsAt: timestamp("startsAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  status: text("status").default("DRAFT").notNull(), // 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED'
  approvedAt: timestamp("approvedAt"),
  metadata: jsonb("metadata"), // Razón de Bunzy Co-Pilot, k-anonimato, condiciones
  ...timestamps,
});

/**
 * 🧾 Campaign Redemptions (Atribución y Auditoría ROI)
 * Registra cada redención real ligada a una transacción completada y al ledger.
 */
export const campaignRedemptions = pgTable("campaignRedemptions", {
  id: id(),
  campaignId: fkId("campaignId").references(() => affiliateCampaigns.id, { onDelete: "cascade" }),
  userId: text("userId").notNull().references(() => users.id),
  businessId: text("businessId").notNull().references(() => ownedBusinesses.id),
  transactionId: text("transactionId"), // Referencia a transactions o pos orderId
  bunzAwarded: integer("bunzAwarded").notNull(),
  fiatSpent: real("fiatSpent").default(0).notNull(), // Consumo en fiat que originó el cashback
  idempotencyKey: text("idempotencyKey").notNull().unique(), // Evita doble emisión en reintentos
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("campaign_tx_redemption_idx").on(table.campaignId, table.transactionId),
]);




