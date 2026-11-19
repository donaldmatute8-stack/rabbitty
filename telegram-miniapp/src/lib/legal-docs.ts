/**
 * Documentos legales: re-export de `@rabbitty/legal`.
 *
 * El texto vive en el paquete compartido (`packages/legal/src/documents.ts`) para
 * que app, admin y landing no divergan. Aquí sólo se mantiene la ruta histórica
 * (`@/lib/legal-docs`) para no tocar los imports existentes.
 */
export {
  LEGAL_VERSION,
  LEGAL_DOCS,
  PUBLISHED_LEGAL_DOCS,
  getLegalDoc,
  type LegalDoc,
  type LegalSection,
} from "@rabbitty/legal";
