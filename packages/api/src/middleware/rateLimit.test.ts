import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, requestCounts } from "./rateLimit";
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
    const WINDOW_MS = 60_000;
    const now = Date.now();
    
    await rateLimit("user3");
    
    // Simulate setting entry directly to reset time
    requestCounts.set("user3", { 
      count: 60, 
      resetAt: now - 1000 // expired
    });
    
    await expect(rateLimit("user3")).resolves.not.toThrow();
    const entry = requestCounts.get("user3");
    expect(entry!.count).toBe(1);
  });

  it("throws error when limit exceeded", async () => {
    await expect((async () => {
      for (let i = 0; i < 65; i++) {
        await rateLimit("user4");
      }
    })()).rejects.toThrow(TRPCError);
  });

  it("handles anonymous users", async () => {
    await expect(rateLimit(null)).resolves.not.toThrow();
    await expect(rateLimit(undefined)).resolves.not.toThrow();
  });
});
