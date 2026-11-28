import { describe, expect, it } from "vitest";
import {
  generateOfferCode,
  isOfferLive,
  isOfferPublicable,
  normalizeOfferCode,
  offerAvailableUnits,
  pickOfferForCard,
} from "./offers";

const now = new Date("2026-11-27T12:00:00.000Z");
const base = { status: "ACTIVE", stockTotal: 10, stockUsed: 0, bunzCost: 30, validUntil: null, validFrom: null };

describe("ofertas · disponibilidad", () => {
  it("el stock manda cuando el respaldo sobra", () => {
    expect(offerAvailableUnits(base, 10_000)).toBe(10);
  });

  it("el respaldo manda cuando el stock sobra", () => {
    expect(offerAvailableUnits({ ...base, stockTotal: 200 }, 90)).toBe(3);
  });

  it("sin respaldo no hay unidades", () => {
    expect(offerAvailableUnits(base, 0)).toBe(0);
    expect(isOfferPublicable(base, 0, now)).toBe(false);
  });

  it("respetar lo ya usado", () => {
    expect(offerAvailableUnits({ ...base, stockUsed: 8 }, 10_000)).toBe(2);
  });

  it("pausada o vencida no está viva", () => {
    expect(isOfferLive({ ...base, status: "PAUSED" }, now)).toBe(false);
    expect(isOfferLive({ ...base, validUntil: "2026-11-27T11:00:00.000Z" }, now)).toBe(false);
    expect(isOfferLive({ ...base, validFrom: "2026-11-28T00:00:00.000Z" }, now)).toBe(false);
  });

  it("elige la más barata que el negocio puede honrar", () => {
    const offers = [
      { id: "caro", ...base, bunzCost: 100 },
      { id: "barato", ...base, bunzCost: 20 },
    ];
    // El segundo argumento es el respaldo del NEGOCIO.
    expect(pickOfferForCard(offers, 10_000, now)?.id).toBe("barato");
    // Sin respaldo no se lista ninguna.
    expect(pickOfferForCard(offers, 0, now)).toBeNull();
    expect(pickOfferForCard([], 10_000, now)).toBeNull();
  });
});

describe("ofertas · código", () => {
  it("genera códigos sin caracteres ambiguos", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateOfferCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("normaliza lo que teclea el comercio", () => {
    expect(normalizeOfferCode(" ab-c2 3 ")).toBe("ABC23");
  });
});
