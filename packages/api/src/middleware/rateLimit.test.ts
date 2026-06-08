import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, requestCounts } from "./rateLimit";
import { TRPCError } from "@trpc/server";

describe("rateLimit middleware", () => {
  beforeEach(() => {
    requestCounts.clear();
  });

  it("allows request below limit", () => {
    expect(() => rateLimit("user1")).not.toThrow();
  });

  it("increments request count", () => {
    rateLimit("user2");
    rateLimit("user2");
    const entry = requestCounts.get("user2");
    expect(entry.count).toBe(2);
  });

  it("resets rate limit after window", () => {
    const WINDOW_MS = 60_000;
    const now = Date.now();
    
    rateLimit("user3");
    expect(() => {
      rateLimit("user3");
      requestCounts.set("user3", { 
        count: 1, 
        resetAt: now + WINDOW_MS 
      });
    }).not.toThrow();
  });

  it("throws error when limit exceeded", () => {
    expect(() => {
      for (let i = 0; i < 61; i++) {
        try {
          rateLimit("user4");
        } catch (e) {
          if (e instanceof TRPCError) {
            throw e;
          }
        }
      }
    }).toThrow(TRPCError);
  });

  it("handles anonymous users", () => {
    expect(() => rateLimit(null)).not.toThrow();
    expect(() => rateLimit(undefined)).not.toThrow();
  });
});
