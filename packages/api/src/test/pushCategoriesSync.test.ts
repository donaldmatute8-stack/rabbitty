/**
 * Contrato de categorías de push (@rabbitty/events) — invariante v2.1 §2.2/§2.3.
 * El miniapp RE-EXPORTA este contrato (sin espejo duplicado) en
 * telegram-miniapp/src/lib/push/categories.ts, así que aquí se validan las
 * reglas del catálogo y el respeto a los tipos críticos.
 */
import { describe, expect, it } from "vitest";
import { categoryForType, PushCategory, typeMuted, UNMUTABLE_TYPES } from "@rabbitty/events";

const ALL_TYPES = [
  "ORDER_COMPLETED", "ORDER_VOIDED", "ACCOUNT_BILL_SENT", "BUNZ_MINTED", "BUNZ_REDEEMED",
  "BUNZ_TRANSFER_RECEIVED", "TIP_PAYOUT", "CHAT_MESSAGE", "ARRIVAL", "CHECKIN_PROMPT",
  "OFFER_FLASH", "MEMBERSHIP_GRANTED", "MEMBERSHIP_RENEWED", "MEMBERSHIP_REVOKED",
  "RATING_REPORTED", "SHIFT_EVENT", "SYSTEM",
];

describe("catálogo de categorías de push (v2.1)", () => {
  it("las 6 categorías del plan existen", () => {
    expect(Object.values(PushCategory).sort()).toEqual(
      ["chat", "marketing", "memberships", "orders", "proximity", "rewards"].sort(),
    );
  });

  it("membresías/órdenes/recompensas/chat/proximidad caen en su categoría esperada", () => {
    expect(categoryForType("CHAT_MESSAGE")).toBe("chat");
    expect(categoryForType("BUNZ_MINTED")).toBe("rewards");
    expect(categoryForType("ORDER_COMPLETED")).toBe("orders");
    expect(categoryForType("ARRIVAL")).toBe("proximity");
    expect(categoryForType("MEMBERSHIP_GRANTED")).toBe("memberships");
    expect(categoryForType("OFFER_FLASH")).toBe("marketing");
    expect(categoryForType("RATING_REPORTED")).toBe("rewards");
  });

  it("CRITICAL/SYSTEM jamás se silencian (pagos y seguridad pasan siempre)", () => {
    for (const t of [...UNMUTABLE_TYPES]) {
      expect(typeMuted(["chat", "rewards", "orders", "proximity", "memberships", "marketing"], t)).toBe(false);
    }
    expect(UNMUTABLE_TYPES.has("TIP_PAYOUT")).toBe(true);
  });

  it("todo tipo del contrato cae en alguna categoría sin lanzar", () => {
    for (const t of ALL_TYPES) {
      expect(typeof categoryForType(t)).toBe("string");
    }
  });
});
