import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * ── Rabbitty Score F1 · Checklist de aceptación (integración DB) ──
 * Requiere TEST_DATABASE_URL apuntando a una base NO productiva.
 * Sin esa variable el archivo se salta (nunca toca prod).
 * CI ya excluye *.integration.test.ts.
 *
 * Todo corre dentro de UNA transacción que se ROLLBACK al final.
 */

const TEST_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_URL ? describe : describe.skip;

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 12)}`;

describeIfDb("Rabbitty Score F1 — invariantes de DB (#1, #4, #7, #9)", () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(TEST_URL!, { max: 1, prepare: false });
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  it("doble submit: UNIQUE(orderId) acepta solo una evaluación por orden", async () => {
    const ROLLBACK = new Error("__ROLLBACK__");
    await expect(sql.begin(async (tx) => {
      const restaurantId = rid("rest");
      const branchId = rid("br");
      const orderId = rid("ord");
      await tx`INSERT INTO restaurants (id, "businessId", name, slug) VALUES (${restaurantId}, ${rid("biz")}, 'Test R', ${rid("slug")})`;
      await tx`INSERT INTO branches (id, "restaurantId", name) VALUES (${branchId}, ${restaurantId}, 'Test B')`;
      await tx`INSERT INTO orders (id, "branchId", status, subtotal, tax, discount, tip, total) VALUES (${orderId}, ${branchId}, 'COMPLETED', 0, 0, 0, 0, 100)`;

      await tx`INSERT INTO order_ratings (id, "orderId", "branchId", "customerUserId", stars)
               VALUES (${rid("rt")}, ${orderId}, ${branchId}, 'usr_test', 5)`;

      let duplicateRejected = false;
      try {
        await tx`INSERT INTO order_ratings (id, "orderId", "branchId", "customerUserId", stars)
                 VALUES (${rid("rt")}, ${orderId}, ${branchId}, 'usr_test', 1)`;
      } catch {
        duplicateRejected = true;
      }
      expect(duplicateRejected).toBe(true);
      throw ROLLBACK;
    })).rejects.toThrow("__ROLLBACK__");
  });

  it("anulación inmediata (#4): invalidar deja el rating fuera de agregados al instante", async () => {
    const ROLLBACK = new Error("__ROLLBACK__");
    await expect(sql.begin(async (tx) => {
      const restaurantId = rid("rest");
      const branchId = rid("br");
      const orderId = rid("ord");
      await tx`INSERT INTO restaurants (id, "businessId", name, slug) VALUES (${restaurantId}, ${rid("biz")}, 'Test R', ${rid("slug")})`;
      await tx`INSERT INTO branches (id, "restaurantId", name) VALUES (${branchId}, ${restaurantId}, 'Test B')`;
      await tx`INSERT INTO orders (id, "branchId", status, subtotal, tax, discount, tip, total) VALUES (${orderId}, ${branchId}, 'COMPLETED', 0, 0, 0, 0, 100)`;
      await tx`INSERT INTO order_ratings (id, "orderId", "branchId", "customerUserId", stars)
               VALUES (${rid("rt")}, ${orderId}, ${branchId}, 'usr_test', 5)`;

      const before = await tx`SELECT COUNT(*)::int AS n FROM order_ratings
                              WHERE "branchId" = ${branchId} AND "isEligible" = true`;
      expect(Number(before[0]?.n ?? -1)).toBe(1);

      // Simula la transición a VOIDED → invalidación (misma sentencia que el helper)
      await tx`UPDATE order_ratings SET "isEligible" = false, "ineligibleReason" = 'ORDER_VOIDED'
               WHERE "orderId" = ${orderId} AND "isEligible" = true`;

      const after = await tx`SELECT COUNT(*)::int AS n FROM order_ratings
                             WHERE "branchId" = ${branchId} AND "isEligible" = true`;
      expect(Number(after[0]?.n ?? -1)).toBe(0);
      throw ROLLBACK;
    })).rejects.toThrow("__ROLLBACK__");
  });

  it("comentario reportado (#7): PENDING_REVIEW queda excluido del agregado público", async () => {
    const ROLLBACK = new Error("__ROLLBACK__");
    await expect(sql.begin(async (tx) => {
      const restaurantId = rid("rest");
      const branchId = rid("br");
      const makeOrder = async (stars: number, status: string) => {
        const orderId = rid("ord");
        await tx`INSERT INTO orders (id, "branchId", status, subtotal, tax, discount, tip, total) VALUES (${orderId}, ${branchId}, 'COMPLETED', 0, 0, 0, 0, 100)`;
        await tx`INSERT INTO order_ratings (id, "orderId", "branchId", "customerUserId", stars, comment, "moderationStatus")
                 VALUES (${rid("rt")}, ${orderId}, ${branchId}, 'usr_test', ${stars}, 'mismo texto', ${status})`;
      };
      await tx`INSERT INTO restaurants (id, "businessId", name, slug) VALUES (${restaurantId}, ${rid("biz")}, 'Test R', ${rid("slug")})`;
      await tx`INSERT INTO branches (id, "restaurantId", name) VALUES (${branchId}, ${restaurantId}, 'Test B')`;
      await makeOrder(5, "VISIBLE");
      await makeOrder(1, "PENDING_REVIEW");

      const agg = await tx`SELECT COUNT(*)::int AS n FROM order_ratings
                           WHERE "branchId" = ${branchId} AND "isEligible" = true
                             AND "moderationStatus" <> 'PENDING_REVIEW'`;
      expect(Number(agg[0]?.n ?? -1)).toBe(1); // solo la visible cuenta
      throw ROLLBACK;
    })).rejects.toThrow("__ROLLBACK__");
  });

  it("invariante económico (#9): crear/evaluar no altera ledger ni pagos", async () => {
    const ROLLBACK = new Error("__ROLLBACK__");
    await expect(sql.begin(async (tx) => {
      const ledgerBefore = await tx`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0) AS total FROM ledger_entries`;
      const paymentsBefore = await tx`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0) AS total FROM payments`;

      const restaurantId = rid("rest");
      const branchId = rid("br");
      const orderId = rid("ord");
      await tx`INSERT INTO restaurants (id, "businessId", name, slug) VALUES (${restaurantId}, ${rid("biz")}, 'Test R', ${rid("slug")})`;
      await tx`INSERT INTO branches (id, "restaurantId", name) VALUES (${branchId}, ${restaurantId}, 'Test B')`;
      await tx`INSERT INTO orders (id, "branchId", status, subtotal, tax, discount, tip, total) VALUES (${orderId}, ${branchId}, 'COMPLETED', 0, 0, 0, 0, 100)`;
      await tx`INSERT INTO order_ratings (id, "orderId", "branchId", "customerUserId", stars, comment)
               VALUES (${rid("rt")}, ${orderId}, ${branchId}, 'usr_test', 4, 'ok')`;
      await tx`INSERT INTO order_rating_events ("ratingId", "eventType", "actorRole")
               SELECT id, 'CREATED', 'AUTHOR' FROM order_ratings WHERE "orderId" = ${orderId}`;

      const ledgerAfter = await tx`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0) AS total FROM ledger_entries`;
      const paymentsAfter = await tx`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0) AS total FROM payments`;

      expect(Number(ledgerAfter[0]?.n ?? -1)).toBe(Number(ledgerBefore[0]?.n ?? -1));
      expect(Number(ledgerAfter[0]?.total ?? -1)).toBe(Number(ledgerBefore[0]?.total ?? -1));
      expect(Number(paymentsAfter[0]?.n ?? -1)).toBe(Number(paymentsBefore[0]?.n ?? -1));
      expect(Number(paymentsAfter[0]?.total ?? -1)).toBe(Number(paymentsBefore[0]?.total ?? -1));
      throw ROLLBACK;
    })).rejects.toThrow("__ROLLBACK__");
  });
});