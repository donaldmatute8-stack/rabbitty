import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, rateLimitKey, requestCounts } from "./rateLimit";
import { TRPCError } from "@trpc/server";

describe("rateLimit middleware", () => {
  beforeEach(() => {
    requestCounts.clear();
  });

  it("allows request below limit", async () => {
    await expect(rateLimit("user1")).resolves.not.toThrow();
  });

  it("increments request count", async () => {
    await rateLimit("user2");
    await rateLimit("user2");
    const entry = requestCounts.get("user2");
    expect(entry).toBeDefined();
    expect(entry!.count).toBe(2);
  });

  it("resets rate limit after window", async () => {
    const now = Date.now();

    await rateLimit("user3");

    // Simular una entrada vencida
    requestCounts.set("user3", {
      count: 400,
      resetAt: now - 1000,
    });

    await expect(rateLimit("user3")).resolves.not.toThrow();
    const entry = requestCounts.get("user3");
    expect(entry!.count).toBe(1);
  });

  it("throws error when limit exceeded", async () => {
    // Tope explícito pequeño para no depender del valor por defecto.
    await expect(
      (async () => {
        for (let i = 0; i < 6; i++) {
          await rateLimit("user4", 5);
        }
      })(),
    ).rejects.toThrow(TRPCError);
  });

  it("uses one bucket per user and one per terminal", async () => {
    expect(rateLimitKey({ userId: "u1" })).toBe("u1");
    expect(rateLimitKey({ posAuth: { method: "terminal", sessionId: "s1" } })).toBe("terminal:s1");
    // Sin sesión de usuario ni terminal: cubo compartido, no revienta
    expect(rateLimitKey({})).toBe("anonymous");
  });

  it("handles anonymous users", async () => {
    await expect(rateLimit(rateLimitKey({}))).resolves.not.toThrow();
  });
});
