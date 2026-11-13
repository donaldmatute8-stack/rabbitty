import { describe, expect, it } from "vitest";
import { assertLiveKeyAllowed } from "./stripeConnect";

/**
 * H-1: una llave LIVE en staging cobra dinero real. El guard debe bloquearla
 * sin depender de NODE_ENV (Railway lo deja en "production" en todos lados).
 */

const live = "sk_live_abc123";
const test = "sk_test_abc123";

describe("assertLiveKeyAllowed", () => {
  it("bloquea una llave LIVE en staging", () => {
    expect(() => assertLiveKeyAllowed(live, { RAILWAY_ENVIRONMENT_NAME: "staging" })).toThrow(
      /llave LIVE en el ambiente "staging"/i,
    );
  });

  it("permite una llave LIVE en producción", () => {
    expect(() =>
      assertLiveKeyAllowed(live, { RAILWAY_ENVIRONMENT_NAME: "production" }),
    ).not.toThrow();
  });

  it("permite llaves de prueba en cualquier ambiente", () => {
    expect(() => assertLiveKeyAllowed(test, { RAILWAY_ENVIRONMENT_NAME: "staging" })).not.toThrow();
    expect(() => assertLiveKeyAllowed(test, { RAILWAY_ENVIRONMENT_NAME: "production" })).not.toThrow();
  });

  it("no bloquea si el ambiente es desconocido (no romper producción)", () => {
    expect(() => assertLiveKeyAllowed(live, {})).not.toThrow();
  });

  it("permite el override explícito", () => {
    expect(() =>
      assertLiveKeyAllowed(live, { RAILWAY_ENVIRONMENT_NAME: "staging", ALLOW_LIVE_PAYMENTS: "1" }),
    ).not.toThrow();
  });
});
