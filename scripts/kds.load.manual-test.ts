import { describe, it, expect } from "vitest";

const KDS_URL = process.env.KDS_URL || "http://localhost:3002";
const CONCURRENT_REQUESTS = 50;
const TOTAL_REQUESTS = 150;

interface Order {
  id: string;
  status: string;
  items: { name: string; status: string }[];
}

describe("KDS Load Test", () => {
  it(
    `should handle ${TOTAL_REQUESTS} concurrent order list requests`,
    async () => {
      const start = Date.now();
      const results = await Promise.allSettled(
        Array.from({ length: TOTAL_REQUESTS }, () =>
          fetch(`${KDS_URL}/api/trpc/kds.getOrders`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }).then((r) => r.json() as Promise<Order[]>),
        ),
      );

      const duration = Date.now() - start;
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(`\n=== KDS Load Test Results ===`);
      console.log(`Requests: ${TOTAL_REQUESTS}`);
      console.log(`Concurrency: ${CONCURRENT_REQUESTS}`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Succeeded: ${succeeded}`);
      console.log(`Failed: ${failed}`);
      console.log(`Avg: ${(duration / TOTAL_REQUESTS).toFixed(2)}ms/req`);
      console.log(`Throughput: ${((TOTAL_REQUESTS / duration) * 1000).toFixed(2)} req/s`);

      expect(succeeded).toBeGreaterThan(TOTAL_REQUESTS * 0.95);
    },
    { timeout: 60000 },
  );

  it(
    "should handle SSE stream under load",
    async () => {
      const connections = Array.from({ length: 20 }, () =>
        fetch(`${KDS_URL}/api/sse`, {
          headers: { Accept: "text/event-stream" },
        }),
      );

      const start = Date.now();
      const results = await Promise.allSettled(connections);
      const duration = Date.now() - start;
      const open = results.filter(
        (r) => r.status === "fulfilled" && (r.value as Response).ok,
      ).length;

      console.log(`\n=== KDS SSE Load Test ===`);
      console.log(`Connections: 20`);
      console.log(`Duration: ${duration}ms`);
      console.log(`Open connections: ${open}`);

      expect(open).toBeGreaterThan(15);
    },
    { timeout: 30000 },
  );
});
