import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { LEGAL_CONTENT_HASH, LEGAL_DOCS, LEGAL_VERSION } from "@rabbitty/legal";

/**
 * ── Candado de versión legal ───────────────────────────────────────────────
 *
 * Regla del proyecto: **cambiar un documento = subir LEGAL_VERSION** en el mismo
 * commit. Si se cambia el texto y no la versión, los usuarios quedan "aceptando"
 * una versión cuyo texto ya cambió: la evidencia deja de ser válida.
 *
 * Esta prueba falla si el texto cambió sin actualizar la huella, y explica qué
 * hacer. Es barata y corre en CI.
 */
describe("documentos legales", () => {
  it("todos los documentos usan la versión vigente", () => {
    for (const doc of LEGAL_DOCS) {
      expect(doc.version, `${doc.slug} tiene versión distinta a LEGAL_VERSION`).toBe(LEGAL_VERSION);
    }
  });

  it("el texto no cambió sin subir la versión (huella)", () => {
    const file = resolve(__dirname, "../../../legal/src/documents.ts");
    const source = readFileSync(file, "utf8");
    const start = source.indexOf("export const LEGAL_DOCS: LegalDoc[] = [");
    const end = source.indexOf("export const PUBLISHED_LEGAL_DOCS");
    const body = source.slice(start, end).trim();
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);

    expect(
      hash,
      "Cambió el texto legal. Sube LEGAL_VERSION, actualiza LEGAL_CONTENT_HASH " +
        "(packages/legal/src/documents.ts) y commitea ambas cosas juntas.",
    ).toBe(LEGAL_CONTENT_HASH);
  });
});
