/**
 * ── Hoja de ruta de la economía Bunny ────────────────────────────────────────
 *
 * Contenido estático y versionado: se actualiza a mano cuando cambia un hito.
 * Vive solo en el admin GOD (`/god/*` exige allowlist + 2FA + no impersonar).
 *
 * Regla: no declarar "hecho" nada que no tenga evidencia verificable
 * (migración aplicada, test, snapshot o deploy).
 */

export type RoadmapStatus = "done" | "active" | "blocked" | "pending";

export const ROADMAP_VERSION = "2026-11-07.6";

export interface RoadmapItem {
  id: string;
  title: string;
  detail: string;
  status: RoadmapStatus;
  evidence?: string;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  subtitle: string;
  status: RoadmapStatus;
  progress: number;
  items: RoadmapItem[];
}

export const PHASES: RoadmapPhase[] = [
  {
    id: "P0",
    title: "Instrumentación",
    subtitle: "Observabilidad económica con datos reales",
    status: "done",
    progress: 100,
    items: [
      { id: "P0-1", title: "Simulador v2.3.2.3", detail: "Ciclo de vida de disputas, caps, libros separados.", status: "done", evidence: "48 pruebas" },
      { id: "P0-2", title: "Contrato Real Data v1.0", detail: "R00–R27, unidades, agregación y conciliación dimensional.", status: "done", evidence: "validador + kit CSV" },
      { id: "P0-3", title: "Backtest temporal", detail: "Partición temporal, as-of OT-7 y pruebas adversariales.", status: "done", evidence: "backtest v1.0" },
      { id: "P0-4", title: "Panel GOD", detail: "Cobertura, huecos, reglas, backtest, compuertas y reporte.", status: "done", evidence: "/god/validacion" },
      { id: "P0-5", title: "OT-1…OT-5", detail: "Intentos, obligaciones, libro, capacidad diaria y señales de abuso.", status: "done", evidence: "migraciones 0027–0029" },
      { id: "P0-6", title: "Captura semanal", detail: "Cron + volumen /data/validation + snapshot en el panel.", status: "done", evidence: "4 afiliados · 114 ventas" },
    ],
  },
  {
    id: "RP-2A",
    title: "Motor de pagos canónico",
    subtitle: "Técnico · sin decisiones económicas",
    status: "done",
    progress: 100,
    items: [
      { id: "A1", title: "Bunz por intent canónico", detail: "Hold atómico, capacidad del afiliado, recuperación y reembolso.", status: "done", evidence: "paymentCore" },
      { id: "A2", title: "Cobro fiat atómico", detail: "Totales + pago + COMPLETED + mesa + stock en una transacción.", status: "done", evidence: "RP-2A" },
      { id: "A3", title: "Idempotencia de cobro", detail: "Clave por intento; reintentos no duplican.", status: "done", evidence: "migración 0031" },
      { id: "A4", title: "Split sobre motor canónico", detail: "Efectivo + Bunz vía paymentCore; si el cierre falla, se revierte la parte Bunz.", status: "done", evidence: "directCheckout split" },
      { id: "A5", title: "Legacy Bunz cerrado", detail: "payOrder rechaza BUNZ; el miniapp deja libro e intento.", status: "done", evidence: "RABBITTY_LEGACY_BUNZ" },
      { id: "A6", title: "Validación con venta real", detail: "Una venta efectivo + un intento Bunz, revisar libros y captura.", status: "active", evidence: "pendiente de caja" },
    ],
  },
  {
    id: "RP-2B",
    title: "Piloto económico",
    subtitle: "Emisión, redención y liquidación con límites",
    status: "active",
    progress: 90,
    items: [
      { id: "B1", title: "Liquidación multi-instrumento", detail: "Bunz, fiat o mixto con tasa por operación; flags separados.", status: "done", evidence: "migración 0030" },
      { id: "B2", title: "Topes duros por afiliado", detail: "Máximo emitido, redimido y liquidado por periodo.", status: "done", evidence: "migración 0032 + bunzControls" },
      { id: "B3", title: "Lista blanca de afiliados", detail: "Solo los autorizados entran al piloto.", status: "done", evidence: "RABBITTY_BUNZ_PILOT" },
      { id: "B4", title: "Kill switches independientes", detail: "Detener emisión, redención o liquidación sin tocar fiat.", status: "done", evidence: "BUNZ_EMIT / BUNZ_REDEEM" },
      { id: "B5", title: "Conciliación con pausa", detail: "Diferencia entre orden, libro y obligación ⇒ alerta y pausa del flujo.", status: "done", evidence: "0033 + cron + panel" },
      { id: "B6", title: "Fase B controlada", detail: "Redención y liquidación parcial para 3 afiliados, con topes y pausa.", status: "active", evidence: "piloto ON · 5,000/5,000/2,000" },
    ],
  },
  {
    id: "RP-2C",
    title: "Escalamiento económico",
    subtitle: "G3–G6, G8 y G9",
    status: "blocked",
    progress: 0,
    items: [
      { id: "C1", title: "G3 · extinción fiat", detail: "¿Bunz extingue una obligación fiat? Negocio + legal.", status: "blocked" },
      { id: "C2", title: "G4 · paridad", detail: "Tasa y mecanismo aprobados por negocio + CFO.", status: "blocked" },
      { id: "C3", title: "G5 · tope contractual", detail: "Límite de autorización por contrato.", status: "blocked" },
      { id: "C4", title: "G6 · concentración", detail: "Política de exposición y remedios.", status: "blocked" },
      { id: "C5", title: "G8 · evidencia", detail: "12 semanas de operación + 6 meses de datos.", status: "blocked" },
      { id: "C6", title: "G9 · aprobación", detail: "Gobernanza autoriza RP-2 completo.", status: "blocked" },
    ],
  },
];

export interface Gate {
  id: string;
  label: string;
  owner: string;
  type: "técnica" | "económica" | "gobernanza";
  status: "done" | "active" | "pending";
}

export const GATES: Gate[] = [
  { id: "G1", label: "Contratos canónicos de pago", owner: "Tech", type: "técnica", status: "done" },
  { id: "G2", label: "Shadow sin discrepancias", owner: "Tech", type: "técnica", status: "active" },
  { id: "G3", label: "¿Bunz extingue obligación fiat?", owner: "Negocio + Legal", type: "económica", status: "pending" },
  { id: "G4", label: "Paridad y mecanismo", owner: "Negocio + CFO", type: "económica", status: "pending" },
  { id: "G5", label: "Tope contractual de autorización", owner: "Negocio", type: "económica", status: "pending" },
  { id: "G6", label: "Política de concentración", owner: "Negocio", type: "económica", status: "pending" },
  { id: "G7", label: "orders.bunzPaid unificado", owner: "Producto + Tech", type: "técnica", status: "active" },
  { id: "G8", label: "Datos reales (12 sem + 6 meses)", owner: "Datos", type: "económica", status: "pending" },
  { id: "G9", label: "Aprobación explícita de RP-2", owner: "Gobernanza", type: "gobernanza", status: "pending" },
];

export interface FlagRow {
  name: string;
  value: string;
  on: boolean;
  what: string;
}

export const FLAGS: FlagRow[] = [
  { name: "RABBITTY_BUNZ_BOOKS", value: "true", on: true, what: "Libro Bunz de doble entrada" },
  { name: "RABBITTY_BUNZ_OBLIGATIONS", value: "true", on: true, what: "Devengo de comisión (6%)" },
  { name: "RABBITTY_BUNZ_ABUSE", value: "true", on: true, what: "Señales de abuso (OT-5)" },
  { name: "GOD_VALIDATION_PANEL", value: "true", on: true, what: "Panel y captura en /god/validacion" },
  { name: "RABBITTY_BUNZ_PILOT", value: "true", on: true, what: "Lista blanca + topes del piloto" },
  { name: "RABBITTY_BUNZ_EMIT", value: "true", on: true, what: "Kill switch de emisión" },
  { name: "RABBITTY_BUNZ_REDEEM", value: "true", on: true, what: "Kill switch de redención" },
  { name: "RABBITTY_BUNZ_SETTLE", value: "false", on: false, what: "Liquidar obligaciones en Bunz" },
  { name: "RABBITTY_BUNZ_SETTLE_FIAT", value: "false", on: false, what: "Extinguir obligaciones con fiat" },
  { name: "RABBITTY_LEGACY_BUNZ", value: "false", on: false, what: "Rollback del POS legacy (no usar)" },
  { name: "RABBITTY_STOCK_STRICT", value: "false", on: false, what: "Bloquear venta sin stock (opt-in)" },
];

export interface HistoryEntry {
  date: string;
  title: string;
  detail: string;
  ref?: string;
}

export const HISTORY: HistoryEntry[] = [
  {
    date: "2026-11-07",
    title: "Piloto encendido",
    detail: "RABBITTY_BUNZ_PILOT=true. Ka13, 626 Café y Bull Box con topes de 5,000 emisión / 5,000 redención / 2,000 liquidación por 7 días.",
    ref: "RABBITTY_BUNZ_PILOT",
  },
  {
    date: "2026-11-07",
    title: "Split de cuenta restaurado",
    detail: "Efectivo + Bunz con captura canónica, validación de suma y reverso automático si falla el cierre. Paridad de controles en el motor legacy.",
    ref: "directCheckout + paymentCore",
  },
  {
    date: "2026-11-07",
    title: "Piloto configurado + conciliación",
    detail: "Ka13, 626 Café y Bull Box con topes 500/500/300 por 7 días. Conciliación diaria que pausa emisión/redención/liquidación si algo no cuadra.",
    ref: "0032 · 0033",
  },
  {
    date: "2026-11-07",
    title: "RP-2B: controles del piloto",
    detail: "Topes por afiliado y periodo, lista blanca y kill switches de emisión/redención. Todo apagado hasta configurar el piloto.",
    ref: "0032 · bunzControls",
  },
  {
    date: "2026-11-07",
    title: "RP-2A: motor de pagos canónico",
    detail: "Cobro fiat atómico, idempotencia, split fuera del piloto y legacy Bunz cerrado. Auditoría de readiness y liquidación multi-instrumento.",
    ref: "40094d6 · 70a4627",
  },
  {
    date: "2026-11-07",
    title: "Cierre de gaps OT-2/OT-4/OT-5",
    detail: "Mora derivada, capacidad diaria, señales de abuso, tesorería en la captura, clawback de recompensa y afiliados completos.",
    ref: "1e5e882 · 6e25d39 · 670b3cc",
  },
  {
    date: "2026-11-07",
    title: "Acciones del panel",
    detail: "Ejecutar captura desde el panel y comparar con la semana anterior, sin exponer CRON_SECRET.",
    ref: "a62cba0",
  },
  {
    date: "2026-11-06",
    title: "Panel GOD + captura",
    detail: "9 tarjetas read-only, alertas ALR, plan OT, reporte y snapshot descargable.",
    ref: "17ec9ab",
  },
  {
    date: "2026-11-06",
    title: "OT-1…OT-4 en producción",
    detail: "Migraciones 0027 y 0028: intentos, libro, obligaciones y capacidad. Escritores idempotentes.",
    ref: "9ba75b2",
  },
  {
    date: "2026-11-06",
    title: "Contrato y backtest",
    detail: "Real Data Spec v1.0 (R00–R27), kit CSV, backtest temporal y modo piloto.",
    ref: "f0943b5",
  },
  {
    date: "2026-11-06",
    title: "Simulador v2.3.2.3",
    detail: "Redistribución, disputas, caps y libros separados. 48 pruebas en verde.",
  },
];

export interface NextAction {
  id: string;
  title: string;
  detail: string;
  owner: string;
}

export const NEXT_ACTIONS: NextAction[] = [
  {
    id: "N1",
    title: "Venta controlada",
    detail: "Una venta en efectivo, un intento Bunz y una cuenta dividida; revisar orders, payments, libro, obligación y captura.",
    owner: "Operación",
  },
  {
    id: "N2",
    title: "Validar el piloto",
    detail: "Piloto encendido con 3 afiliados. Falta la venta controlada (efectivo, Bunz y split) y revisar la captura.",
    owner: "Operación + Tech",
  },
  {
    id: "N3",
    title: "Conciliación con pausa",
    detail: "Si orden, libro, obligación y stock no cuadran: alerta y detener el flujo afectado.",
    owner: "Tech",
  },
  {
    id: "N4",
    title: "Decidir G3/G4",
    detail: "Llevar la auditoría y el snapshot a legal/CFO para extinguir la duda de fondo.",
    owner: "Negocio",
  },
];
