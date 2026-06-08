import { relations } from "drizzle-orm/pg-core";
import {
  restaurants,
  branches,
  menuCategories,
  menuItems,
  menuItemModifiers,
  tables,
  tableSessions,
  staff,
  staffShifts,
  orders,
  orderItems,
  payments,
  inventoryItems,
  inventoryMovements,
  events,
  reservations,
  webhooks,
} from "./index";

export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  branches: many(branches),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [branches.restaurantId], references: [restaurants.id] }),
  menuCategories: many(menuCategories),
  menuItems: many(menuItems),
  tables: many(tables),
  tableSessions: many(tableSessions),
  staff: many(staff),
  staffShifts: many(staffShifts),
  orders: many(orders),
  inventoryItems: many(inventoryItems),
  inventoryMovements: many(inventoryMovements),
  events: many(events),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  branch: one(branches, { fields: [menuCategories.branchId], references: [branches.id] }),
  menuItems: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(menuCategories, { fields: [menuItems.categoryId], references: [menuCategories.id] }),
  branch: one(branches, { fields: [menuItems.branchId], references: [branches.id] }),
  modifiers: many(menuItemModifiers),
  orderItems: many(orderItems),
}));

export const menuItemModifiersRelations = relations(menuItemModifiers, ({ one }) => ({
  item: one(menuItems, { fields: [menuItemModifiers.itemId], references: [menuItems.id] }),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  branch: one(branches, { fields: [tables.branchId], references: [branches.id] }),
  tableSessions: many(tableSessions),
  orders: many(orders),
}));

export const tableSessionsRelations = relations(tableSessions, ({ one, many }) => ({
  table: one(tables, { fields: [tableSessions.tableId], references: [tables.id] }),
  branch: one(branches, { fields: [tableSessions.branchId], references: [branches.id] }),
  staff: one(staff, { fields: [tableSessions.staffId], references: [staff.id] }),
  orders: many(orders),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  branch: one(branches, { fields: [staff.branchId], references: [branches.id] }),
  shifts: many(staffShifts),
  tableSessions: many(tableSessions),
  orders: many(orders),
}));

export const staffShiftsRelations = relations(staffShifts, ({ one }) => ({
  staff: one(staff, { fields: [staffShifts.staffId], references: [staff.id] }),
  branch: one(branches, { fields: [staffShifts.branchId], references: [branches.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, { fields: [orders.branchId], references: [branches.id] }),
  table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
  tableSession: one(tableSessions, { fields: [orders.tableSessionId], references: [tableSessions.id] }),
  staff: one(staff, { fields: [orders.staffId], references: [staff.id] }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  branch: one(branches, { fields: [inventoryItems.branchId], references: [branches.id] }),
  movements: many(inventoryMovements),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  item: one(inventoryItems, { fields: [inventoryMovements.itemId], references: [inventoryItems.id] }),
  branch: one(branches, { fields: [inventoryMovements.branchId], references: [branches.id] }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  branch: one(branches, { fields: [events.branchId], references: [branches.id] }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  branch: one(branches, { fields: [reservations.branchId], references: [branches.id] }),
  table: one(tables, { fields: [reservations.tableId], references: [tables.id] }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  branch: one(branches, { fields: [webhooks.branchId], references: [branches.id] }),
}));
