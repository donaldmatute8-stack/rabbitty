/**
 * ── Fechas que vienen de SQL crudo ────────────────────────────────────────
 *
 * Las columnas `timestamp` (sin zona) guardan UTC (los `defaultNow()` usan el
 * reloj del servidor, que está en UTC). Cuando se leen con el driver normal,
 * Drizzle devuelve `Date` y el cliente las interpreta bien.
 *
 * El problema aparece con `db.execute(sql\`...\`)`: el driver entrega el valor
 * como **string sin zona** ("2026-11-22 23:41:38"). El navegador lo interpreta
 * como hora LOCAL del usuario, así que una venta de 5:41 PM se mostraba como
 * 11:41 PM —y las de después de 6 PM caían al día siguiente—.
 *
 * `naiveUtcToIso()` deja el instante explícito (ISO con `Z`) para que el
 * cliente lo convierta a su zona sin adivinar.
 */
export function naiveUtcToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();

  const raw = String(value).trim();
  if (!raw) return null;

  // Ya viene con zona (ISO con Z u offset): se respeta.
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? raw : d.toISOString();
  }

  // "YYYY-MM-DD HH:mm:ss(.ffffff)" → ISO asumiendo UTC.
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(`${iso}Z`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString();
}
