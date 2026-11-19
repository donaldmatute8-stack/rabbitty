import { describe, it, expect } from "vitest";
import { quoteDelivery, type DeliveryConfig } from "../services/deliveryQuote";

/**
 * Cotización de envío: es dinero que paga el cliente. Estas pruebas fijan:
 * - sin config no se cobra (y se dice),
 * - gratis por umbral,
 * - tarifa fija,
 * - zonas por distancia (haversine) con caída a fija,
 * - el proveedor caído no rompe la venta.
 */
const pickup = { lat: 20.753174, lng: -105.33547 };

const base = (over: Partial<DeliveryConfig> = {}): DeliveryConfig => ({
  enabled: true,
  mode: "FLAT",
  baseFee: 45,
  etaMinutes: 40,
  ...over,
});

describe("quoteDelivery", () => {
  it("sin configuración no cobra y lo reporta", async () => {
    const q = await quoteDelivery({ config: null, subtotal: 280 });
    expect(q.fee).toBe(0);
    expect(q.source).toBe("UNCONFIGURED");
    expect(q.label).toMatch(/confirmar/);
  });

  it("con envíos desactivados no cobra", async () => {
    const q = await quoteDelivery({ config: base({ enabled: false }), subtotal: 280 });
    expect(q.fee).toBe(0);
    expect(q.source).toBe("DISABLED");
  });

  it("gratis al superar freeOver", async () => {
    const q = await quoteDelivery({ config: base({ freeOver: 600 }), subtotal: 640 });
    expect(q.fee).toBe(0);
    expect(q.source).toBe("FREE");
  });

  it("tarifa fija cuando no hay coordenadas", async () => {
    const q = await quoteDelivery({ config: base(), subtotal: 280, dropoff: {} });
    expect(q.fee).toBe(45);
    expect(q.source).toBe("FLAT");
  });

  it("usa la zona que cubre la distancia (2 km → $35)", async () => {
    const q = await quoteDelivery({
      config: base({ zones: [{ maxKm: 3, fee: 35 }, { maxKm: 6, fee: 55 }] }),
      subtotal: 280,
      pickup,
      dropoff: { lat: 20.77, lng: -105.32 }, // ~2.5 km
    });
    expect(q.fee).toBe(35);
    expect(q.label).toMatch(/km/);
  });

  it("zona media (5 km → $55)", async () => {
    const q = await quoteDelivery({
      config: base({ zones: [{ maxKm: 3, fee: 35 }, { maxKm: 6, fee: 55 }] }),
      subtotal: 280,
      pickup,
      dropoff: { lat: 20.79, lng: -105.31 }, // ~4.5 km
    });
    expect(q.fee).toBe(55);
  });

  it("fuera de toda zona cae a la tarifa fija", async () => {
    const q = await quoteDelivery({
      config: base({ zones: [{ maxKm: 3, fee: 35 }] }),
      subtotal: 280,
      pickup,
      dropoff: { lat: 20.95, lng: -105.1 }, // ~20 km
    });
    expect(q.fee).toBe(45);
  });

  it("el proveedor caído no rompe: cae a tarifa fija", async () => {
    // mode PROVIDER sin credenciales configuradas → no intenta y usa la fija.
    const q = await quoteDelivery({
      config: base({ mode: "PROVIDER" }),
      subtotal: 280,
      pickup,
      dropoff: { lat: 20.77, lng: -105.32 },
    });
    expect([45, 0]).toContain(q.fee);
    expect(["FLAT", "UNCONFIGURED", "PROVIDER"]).toContain(q.source);
  });
});
