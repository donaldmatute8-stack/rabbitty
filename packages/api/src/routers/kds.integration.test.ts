import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestContext, closeTestDb } from "../test/setup";
import { kdsRouter } from "./kds";

describe("KDS Router — Integration", () => {
  let caller: ReturnType<typeof kdsRouter.createCaller>;

  beforeAll(async () => {
    const ctx = await createTestContext();
    caller = kdsRouter.createCaller(ctx);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("getOrders", () => {
    it("returns all orders for branch", async () => {
      const orders = await caller.getOrders();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThanOrEqual(2);
      expect(orders[0]).toHaveProperty("id");
      expect(orders[0]).toHaveProperty("tableNumber");
      expect(orders[0]).toHaveProperty("items");
    });

    it("returns orders filtered by status", async () => {
      const orders = await caller.getOrders({ status: "PENDING" });
      expect(Array.isArray(orders)).toBe(true);
      orders.forEach(order => {
        expect(order.status).toBe("PENDING");
      });
    });

    it("returns orders with items containing menu item names", async () => {
      const orders = await caller.getOrders();
      expect(orders.length).toBeGreaterThan(0);
      const orderWithItems = orders.find(o => o.items && o.items.length > 0);
      if (orderWithItems) {
        expect(orderWithItems.items[0]).toHaveProperty("name");
        expect(orderWithItems.items[0]).toHaveProperty("status");
      }
    });
  });
});
