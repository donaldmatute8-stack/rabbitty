import { describe, expect, it } from "vitest";
import {
  decodeChatCursor,
  encodeChatCursor,
  cursorFromMessage,
} from "@rabbitty/events";

/**
 * ── Mensajería Fase 0 · cursor compuesto (createdAt, id) ──
 * ← plan RABBITTY-MENSAJES-PLAN §4 Fase 0.2/0.3 (dictamen: cursor compuesto
 * con desempate por id; el bloque "último id" falla con uuid v4/empates).
 */
describe("chatCursor — cursor compuesto estable", () => {
  it("codifica y decodifica redondo (v1:epochMs:id)", () => {
    const c = { createdAt: "2026-11-03T17:11:19.676Z", id: "abc-123" };
    const enc = encodeChatCursor(c);
    expect(enc).toMatch(/^v1:\d+:abc-123$/);
    const dec = decodeChatCursor(enc);
    expect(dec).toEqual(c);
  });

  it("mismo createdAt, ids distintos → cursores distintos (desempate)", () => {
    const a = { createdAt: "2026-11-03T17:11:19.676Z", id: "aaa" };
    const b = { createdAt: "2026-11-03T17:11:19.676Z", id: "bbb" };
    expect(encodeChatCursor(a)).not.toBe(encodeChatCursor(b));
  });

  it("resiste basura, vacío y versión desconocida (null, nunca throw)", () => {
    expect(decodeChatCursor(null)).toBeNull();
    expect(decodeChatCursor("")).toBeNull();
    expect(decodeChatCursor("v2:1:id")).toBeNull();
    expect(decodeChatCursor("v1:no-ms:id")).toBeNull();
    expect(decodeChatCursor("v1:12345")).toBeNull();
    expect(decodeChatCursor("DALAT")).toBeNull();
  });

  it("cursorFromMessage acepta Date e ISO string", () => {
    const now = new Date("2026-11-03T17:11:20.123Z");
    expect(cursorFromMessage({ createdAt: now, id: "m1" }))
      .toBe(encodeChatCursor({ createdAt: now.toISOString(), id: "m1" }));
    expect(cursorFromMessage({ createdAt: now.toISOString(), id: "m1" }))
      .toBe(cursorFromMessage({ createdAt: now, id: "m1" }));
  });

  it("determinismo: el mismo mensaje manda siempre al mismo cursor", () => {
    const m = { createdAt: "2026-11-03T04:07:50.377Z", id: "fac3be79" };
    expect(cursorFromMessage(m)).toBe(cursorFromMessage(m));
  });
});
