import { describe, expect, it, vi, afterEach } from "vitest";
import { buildFacturamaPayload, facturamaProvider } from "./facturama";
import type { StampInput } from "./types";

/**
 * El PAC se prueba con `fetch` simulado: describe el contrato que esperamos de
 * Facturama (rutas, payload y mapeo de respuesta). La validación contra el
 * sandbox real requiere las credenciales del tenant.
 */

const input: StampInput = {
  issuer: { rfc: "EKU9003173C9", name: "ESCUELA KEMPER URGATE", taxRegime: "601", zipCode: "42501" },
  receiver: {
    rfc: "URE180429TM6",
    name: "UNIVERSIDAD ROBOTICA ESPAÑOLA",
    cfdiUse: "G03",
    taxRegime: "601",
    zipCode: "86991",
    email: "pagos@ejemplo.mx",
  },
  items: [
    { description: "Tacos al pastor", productCode: "90101500", quantity: 2, unitPrice: 50, unitCode: "E48", taxRate: 0.16, taxed: true },
    { description: "Agua", productCode: "90101500", quantity: 1, unitPrice: 20, unitCode: "E48", taxed: false },
  ],
  paymentForm: "28",
  folio: "ORD123",
  orderNumber: "abc-123",
};

const creds = { username: "tenant", password: "secreto" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildFacturamaPayload", () => {
  it("arma CFDI de ingreso con receptor 4.0 y desglose de IVA", () => {
    const payload = buildFacturamaPayload(input) as any;

    expect(payload.CfdiType).toBe("I");
    expect(payload.Currency).toBe("MXN");
    expect(payload.PaymentForm).toBe("28");
    expect(payload.ExpeditionPlace).toBe("42501");
    expect(payload.Receiver).toMatchObject({
      Rfc: "URE180429TM6",
      CfdiUse: "G03",
      FiscalRegime: "601",
      TaxZipCode: "86991",
      Name: "UNIVERSIDAD ROBOTICA ESPAÑOLA",
    });

    const [tacos, agua] = payload.Items;
    expect(tacos).toMatchObject({ Quantity: 2, UnitPrice: 50, Subtotal: 100, TaxObject: "02" });
    expect(tacos.Taxes[0]).toMatchObject({ Base: 100, Rate: 0.16, Total: 16 });
    expect(tacos.Total).toBe(116);

    // Concepto sin impuesto → TaxObject 01 y sin nodo Taxes.
    expect(agua.TaxObject).toBe("01");
    expect(agua.Taxes).toBeUndefined();
    expect(agua.Total).toBe(20);
  });
});

describe("facturamaProvider.stamp", () => {
  it("mapea Id y UUID del timbre", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          Id: "DznlumtVtkA3ya4JXAeGWw2",
          Status: "active",
          Total: 136,
          Complement: { TaxStamp: { Uuid: "5e09160f-a206-44d7-b389-4f243585e76a" } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await facturamaProvider.stamp(creds, "sandbox", input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.uuid).toBe("5e09160f-a206-44d7-b389-4f243585e76a");
      expect(result.pacInvoiceId).toBe("DznlumtVtkA3ya4JXAeGWw2");
      expect(result.total).toBe(136);
    }

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://apisandbox.facturama.mx/3/cfdis");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("tenant:secreto").toString("base64")}`,
    );
  });

  it("devuelve el mensaje del SAT sin lanzar", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Message: "El RFC del receptor no es válido" }), { status: 400 }),
    );

    const result = await facturamaProvider.stamp(creds, "sandbox", input);
    expect(result).toMatchObject({ success: false, error: "El RFC del receptor no es válido", fromSat: true });
  });

  it("no se cuelga si el PAC no está disponible", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await facturamaProvider.stamp(creds, "production", input);
    expect(result.success).toBe(false);
  });
});

describe("facturamaProvider.cancel", () => {
  it("envía motivo y UUID sustituto", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Status: "cancelled" }), { status: 200 }),
    );

    const result = await facturamaProvider.cancel(creds, "sandbox", {
      pacInvoiceId: "abc",
      uuid: "5e09160f-a206-44d7-b389-4f243585e76a",
      motive: "01",
      replacementUuid: "11111111-2222-3333-4444-555555555555",
    });

    expect(result).toEqual({ success: true, status: "cancelled" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/3/cfdis/abc?");
    expect(String(url)).toContain("motive=01");
    expect(String(url)).toContain("uuidReplacement=11111111-2222-3333-4444-555555555555");
  });
});

describe("facturamaProvider.testConnection", () => {
  it("detecta credenciales rechazadas", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }));
    const result = await facturamaProvider.testConnection(creds, "sandbox");
    expect(result.ok).toBe(false);
  });

  it("acepta 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    const result = await facturamaProvider.testConnection(creds, "sandbox");
    expect(result.ok).toBe(true);
  });
});
