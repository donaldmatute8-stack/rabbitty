/**
 * Reconcilia órdenes históricas (IVA 16% incluido en el precio).
 *
 *   RESTAURANT_DATABASE_URL=<url> pnpm --filter @rabbitty/database-restaurant db:reconcile            # dry-run
 *   RESTAURANT_DATABASE_URL=<url> pnpm --filter @rabbitty/database-restaurant db:reconcile -- --apply # aplica
 *
 * Reglas:
 *  1. Órdenes con descuento donde total es bruto (suma de pagos ≈ total - descuento): total := neto.
 *  2. Para toda orden: subtotal = round2(total/1.16), tax = round2(total - subtotal).
 * Dry-run por defecto: solo imprime el resumen y las diferencias.
 */
import postgres from "postgres";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

async function main() {
  const url = process.env.RESTAURANT_DATABASE_URL;
  if (!url) throw new Error("RESTAURANT_DATABASE_URL not set");
  const apply = process.argv.includes("--apply");
  const sql = postgres(url, { max: 1 });

  try {
    const rows = await sql<
      { id: string; total: number; subtotal: number; tax: number; discount: number | null; paid: number | null; status: string }[]
    >`
      SELECT o.id, o.total, o.subtotal, o.tax, o.discount, o.status,
             (SELECT COALESCE(SUM(p.amount),0) FROM payments p
               WHERE p."orderId" = o.id AND p.status = 'COMPLETED') AS paid
      FROM orders o
      WHERE o.status IN ('COMPLETED','PAID','PARTIAL_PAID')
    `;

    let grossFixes = 0;
    let taxFixes = 0;
    let deltaTotal = 0;
    const updates: { id: string; total: number; subtotal: number; tax: number }[] = [];

    for (const o of rows) {
      let total = Number(o.total);
      const discount = Number(o.discount ?? 0);
      const paid = Number(o.paid ?? 0);
      if (discount > 0 && o.status !== "PARTIAL_PAID" && Math.abs(paid - (total - discount)) <= 0.02) {
        deltaTotal += r2(total - r2(total - discount));
        total = r2(total - discount);
        grossFixes++;
      } else {
        total = r2(total);
      }
      const subtotal = r2(total / 1.16);
      const tax = r2(total - subtotal);
      const changed =
        total !== Number(o.total) || subtotal !== Number(o.subtotal) || tax !== Number(o.tax);
      if (changed) {
        if (total === Number(o.total)) taxFixes++;
        updates.push({ id: o.id, total, subtotal, tax });
      }
    }

    // Órdenes cuyo pago no coincide con total (informativo)
    const mismatches = rows.filter((o) => {
      if (o.status === "PARTIAL_PAID") return false;
      const discount = Number(o.discount ?? 0);
      const t = Number(o.total);
      const net = discount > 0 && Math.abs(Number(o.paid) - (t - discount)) <= 0.02 ? t - discount : t;
      return Math.abs(Number(o.paid ?? 0) - net) > 0.02;
    });

    console.log(`Órdenes revisadas:            ${rows.length}`);
    console.log(`Con total bruto (descuento):  ${grossFixes}  (Δ total ≈ ${r2(deltaTotal)})`);
    console.log(`Con IVA/base a recalcular:    ${taxFixes}`);
    console.log(`Total a actualizar:           ${updates.length}`);
    console.log(`Pago ≠ total (revisar manual): ${mismatches.length}`);
    mismatches.slice(0, 20).forEach((o) =>
      console.log(`  - ${o.id} total=${o.total} desc=${o.discount ?? 0} pagado=${o.paid} status=${o.status}`),
    );

    if (!apply) {
      console.log("\nDRY-RUN: no se modificó nada. Usa --apply para aplicar.");
      return;
    }

    await sql.begin(async (tx) => {
      for (const u of updates) {
        await tx`UPDATE orders SET total = ${u.total}, subtotal = ${u.subtotal}, tax = ${u.tax} WHERE id = ${u.id}`;
      }
    });
    console.log(`\nAplicado: ${updates.length} órdenes actualizadas.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
