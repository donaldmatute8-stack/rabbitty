import { afterEach, describe, expect, it } from "vitest";
import {
  EMIT_FLAG,
  PILOT_FLAG,
  REDEEM_FLAG,
  checkOperation,
  isEmissionEnabled,
  isPilotMode,
  isRedemptionEnabled,
} from "../services/bunzControls";

const tables = {
  limits: "limits",
  orders: "orders",
  branches: "branches",
  restaurants: "restaurants",
  attempts: "attempts",
  obligations: "obligations",
};

/** Fake con cola: cada `where` consume la siguiente respuesta. */
function fakeDb(responses: unknown[][]) {
  let i = 0;
  const db: any = {
    select() {
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => {
          const rows = responses[i++] ?? [];
          const p: any = Promise.resolve(rows);
          p.limit = async () => rows;
          return p;
        },
      };
      return chain;
    },
  };
  return db;
}

afterEach(() => {
  delete process.env[PILOT_FLAG];
  delete process.env[EMIT_FLAG];
  delete process.env[REDEEM_FLAG];
});

describe("RP-2B — controles del piloto", () => {
  it("piloto apagado por defecto; kill switches encendidos", () => {
    expect(isPilotMode({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isEmissionEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(isRedemptionEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(isEmissionEnabled({ [EMIT_FLAG]: "false" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isRedemptionEnabled({ [REDEEM_FLAG]: "false" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("con el piloto apagado no consulta ni limita", async () => {
    const db = fakeDb([]);
    const r = await checkOperation(db, {
      affiliateId: "a1",
      operation: "emission",
      amount: 9999,
      tables,
    });
    expect(r.allowed).toBe(true);
  });

  it("kill switch de emisión bloquea aunque el piloto esté apagado", async () => {
    process.env[EMIT_FLAG] = "false";
    const r = await checkOperation(fakeDb([]), {
      affiliateId: "a1",
      operation: "emission",
      amount: 10,
      tables,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("EMIT");
  });

  it("piloto activo: afiliado sin fila queda fuera", async () => {
    process.env[PILOT_FLAG] = "true";
    const r = await checkOperation(fakeDb([[]]), {
      affiliateId: "a1",
      operation: "redemption",
      amount: 10,
      tables,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("fuera del piloto");
  });

  it("piloto activo: fila deshabilitada queda fuera", async () => {
    process.env[PILOT_FLAG] = "true";
    const r = await checkOperation(fakeDb([[{ affiliateId: "a1", pilotEnabled: false }]]), {
      affiliateId: "a1",
      operation: "emission",
      amount: 10,
      tables,
    });
    expect(r.allowed).toBe(false);
  });

  it("piloto activo: respeta el tope del periodo", async () => {
    process.env[PILOT_FLAG] = "true";
    const limits = {
      affiliateId: "a1",
      pilotEnabled: true,
      periodDays: 7,
      maxEmissionBunz: 100,
      maxRedemptionBunz: 50,
      maxSettlementBunz: 200,
    };
    const denied = await checkOperation(fakeDb([[limits], [{ used: 90 }]]), {
      affiliateId: "a1",
      operation: "emission",
      amount: 20,
      tables,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.used).toBe(90);
    expect(denied.cap).toBe(100);

    const allowed = await checkOperation(fakeDb([[limits], [{ used: 50 }]]), {
      affiliateId: "a1",
      operation: "settlement",
      amount: 100,
      tables,
    });
    expect(allowed.allowed).toBe(true);
  });
});
