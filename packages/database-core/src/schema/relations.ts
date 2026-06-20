import { relations } from "drizzle-orm";
import {
  users,
  webSessions,
  ownedBusinesses,
  transactions,
  pendingVaults,
  levels,
  hatTricks,
  userHatTricks,
  achievements,
  userAchievements,
  referrals,
  notifications,
  conversations,
  messages,
  qrSessions,
  reservations,
  passkeys,
  trustedSessions,
} from "./index";

export const usersRelations = relations(users, ({ many, one }) => ({
  webSessions: many(webSessions),
  ownedBusinesses: many(ownedBusinesses),
  transactions: many(transactions),
  userHatTricks: many(userHatTricks),
  userAchievements: many(userAchievements),
  referralsAsInviter: many(referrals, { relationName: "inviter" }),
  referralsAsInvited: many(referrals, { relationName: "invited" }),
  notifications: many(notifications),
  qrSessions: many(qrSessions),
  reservations: many(reservations),
  passkeys: many(passkeys),
  trustedSessions: many(trustedSessions),
  level: one(levels, { fields: [users.levelId], references: [levels.id] }),
}));

export const webSessionsRelations = relations(webSessions, ({ one }) => ({
  user: one(users, { fields: [webSessions.userId], references: [users.id] }),
}));

export const ownedBusinessesRelations = relations(ownedBusinesses, ({ one, many }) => ({
  owner: one(users, { fields: [ownedBusinesses.ownerId], references: [users.id] }),
  transactions: many(transactions),
  pendingVaults: many(pendingVaults),
  reservations: many(reservations),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  business: one(ownedBusinesses, { fields: [transactions.businessId], references: [ownedBusinesses.id] }),
}));

export const pendingVaultsRelations = relations(pendingVaults, ({ one }) => ({
  business: one(ownedBusinesses, { fields: [pendingVaults.businessId], references: [ownedBusinesses.id] }),
}));

export const levelsRelations = relations(levels, ({ many }) => ({
  users: many(users),
}));

export const hatTricksRelations = relations(hatTricks, ({ many }) => ({
  userHatTricks: many(userHatTricks),
}));

export const userHatTricksRelations = relations(userHatTricks, ({ one }) => ({
  user: one(users, { fields: [userHatTricks.userId], references: [users.id] }),
  trick: one(hatTricks, { fields: [userHatTricks.trickId], references: [hatTricks.id] }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  inviter: one(users, { fields: [referrals.inviterId], references: [users.id], relationName: "inviter" }),
  invited: one(users, { fields: [referrals.invitedId], references: [users.id], relationName: "invited" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
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

export const passkeysRelations = relations(passkeys, ({ one }) => ({
  user: one(users, { fields: [passkeys.userId], references: [users.id] }),
}));

export const trustedSessionsRelations = relations(trustedSessions, ({ one }) => ({
  user: one(users, { fields: [trustedSessions.userId], references: [users.id] }),
}));
