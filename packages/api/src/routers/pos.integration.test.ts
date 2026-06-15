import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, closeTestDb } from "../test/setup";
import { posRouter } from "./pos";

describe("POS Router — Integration", () => {
  let caller: ReturnType<typeof posRouter.createCaller>;

  beforeAll(async () => {
    const ctx = await createTestContext();
    caller = posRouter.createCaller(ctx);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("getTables", () => {
    it("returns all tables for branch", async () => {
      const tables = await caller.getTables();
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThanOrEqual(12);
      expect(tables[0]).toHaveProperty("id");
      expect(tables[0]).toHaveProperty("number");
      expect(tables[0]).toHaveProperty("capacity");
    });
  });

  describe("getTable", () => {
    it("returns a single table by id", async () => {
      const tables = await caller.getTables();
      expect(tables.length).toBeGreaterThan(0);
      const first = tables[0]!;
      const result = await caller.getTable({ id: first.id });
      expect(result[0]!.id).toBe(first.id);
      expect(result[0]!.number).toBe(first.number);
    });
  });

  describe("getCategories", () => {
    it("returns menu categories", async () => {
      const categories = await caller.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(4);
      expect(categories[0]).toHaveProperty("name");
    });
  });

  describe("getMenuItems", () => {
    it("returns all items when no category filter", async () => {
      const items = await caller.getMenuItems({});
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(14);
      expect(items[0]).toHaveProperty("name");
      expect(items[0]).toHaveProperty("price");
    });

    it("returns items filtered by category", async () => {
      const items = await caller.getMenuItems({ categoryId: "c1" });
      expect(items.length).toBeGreaterThanOrEqual(4);
      items.forEach(item => {
        expect(item.categoryId).toBe("c1");
      });
    });
  });

  describe("getOrders", () => {
    it("returns orders for a table", async () => {
      const orders = await caller.getOrders({ tableId: "t2" });
      expect(Array.isArray(orders)).toBe(true);
    });

    it("returns orders filtered by status", async () => {
      const orders = await caller.getOrders({ status: "PENDING" });
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("getModifiers", () => {
    it("returns modifiers for a menu item", async () => {
      const modifiers = await caller.getModifiers({ itemId: "m1" });
      expect(Array.isArray(modifiers)).toBe(true);
    });
  });
});
