import { bus, EventTypes } from "@rabbitty/events";

export const dynamic = "force-dynamic";

const ALL_EVENTS = [
  EventTypes.KDS_ITEM_UPDATED,
  EventTypes.ORDER_CREATED,
  EventTypes.ORDER_PAID,
] as const;

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      const unsubs = ALL_EVENTS.map((event) =>
        bus.on(event, (data) => {
          const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        })
      );
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);
      req.signal.addEventListener("abort", () => {
        unsubs.forEach((fn) => fn());
        clearInterval(keepAlive);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
