import Link from "next/link";
import { LEGAL_VERSION, PUBLISHED_LEGAL_DOCS } from "../../lib/legal-docs";

/**
 * ── Versión pública de los documentos legales ───────────────────────────────
 *
 * Un solo enlace para compartir: `app.rabbitty.me/legal`. Antes era sólo un
 * índice, así que para mandar "los legales" había que adjuntar Word/PDF.
 *
 * Es la MISMA fuente que la app y la landing (`@rabbitty/legal`), así que no hay
 * versión "bonita para compartir" que se desincronice de la que se acepta.
 *
 * Pensada para:
 * - abrirse sin sesión (ruta pública; ver `PUBLIC_ROUTES` en AuthProvider),
 * - imprimirse o guardarse como PDF con Ctrl/⌘+P (hay estilos de impresión),
 * - compartirse por WhatsApp/correo con vista previa (Open Graph).
 */
export const metadata = {
  title: "Documentos legales · Rabbitty",
  description:
    "Términos y Condiciones, Anexo de Pagos (comisiones y liquidaciones), Aviso de Privacidad y Reglamento de Bunz de Rabbitty. Versión vigente 2026-11-19.",
  openGraph: {
    title: "Documentos legales · Rabbitty",
    description:
      "Términos, Anexo de Pagos, Aviso de Privacidad y Reglamento de Bunz. Versión vigente 2026-11-19.",
    url: "https://app.rabbitty.me/legal",
    siteName: "Rabbitty",
    type: "article",
  },
  alternates: { canonical: "https://app.rabbitty.me/legal" },
};

const CONTACT = "privacidad@rabbitty.me";

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 print:max-w-none print:px-0 print:py-0">
      {/* Encabezado */}
      <header className="print:mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-400 print:text-black">
          Rabbitty
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white print:text-black">
          Documentos legales
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55 print:text-black">
          Versión vigente: <b className="text-white/80 print:text-black">{LEGAL_VERSION}</b>. Este
          documento es la versión pública y completa; es el mismo texto que se muestra y se acepta
          dentro de la app.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <Link
            href="/legal/terminos"
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/70 no-underline hover:bg-white/[0.08]"
          >
            Enlace por documento
          </Link>
          <a
            href={`mailto:${CONTACT}?subject=${encodeURIComponent(
              `Dudas sobre los documentos legales ${LEGAL_VERSION}`,
            )}`}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/70 no-underline hover:bg-white/[0.08]"
          >
            Escribir a {CONTACT}
          </a>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/40">
            Imprime o guarda como PDF con ⌘/Ctrl + P
          </span>
        </div>
      </header>

      {/* Índice con anclas */}
      <nav className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 print:hidden">
        <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          Contenido
        </p>
        <ol className="m-0 list-decimal space-y-1 pl-5">
          {PUBLISHED_LEGAL_DOCS.map((doc) => (
            <li key={doc.slug}>
              <a
                href={`#${doc.slug}`}
                className="text-[12.5px] font-semibold text-pink-300 no-underline hover:text-pink-200"
              >
                {doc.title}
              </a>
              <span className="ml-2 text-[11px] text-white/35">{doc.audience}</span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Todos los documentos, en orden */}
      <div className="mt-10 space-y-14">
        {PUBLISHED_LEGAL_DOCS.map((doc, index) => (
          <article
            key={doc.slug}
            id={doc.slug}
            className="scroll-mt-6 print:break-before-page print:pt-4"
          >
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-pink-400 print:text-black">
              Documento {index + 1} de {PUBLISHED_LEGAL_DOCS.length} · {doc.audience}
            </p>
            <h2 className="m-0 mt-1 text-2xl font-extrabold leading-tight text-white print:text-black">
              {doc.title}
            </h2>
            <p className="m-0 mt-1 text-[11px] text-white/40 print:text-black">
              Versión {doc.version} · actualizado {doc.updated}
            </p>
            <p className="m-0 mt-3 text-[13px] leading-relaxed text-white/60 print:text-black">
              {doc.summary}
            </p>

            <div className="mt-6 space-y-5">
              {doc.sections.map((section) => (
                <section key={`${doc.slug}-${section.heading}`}>
                  <h3 className="m-0 text-[14px] font-black text-white print:text-black">
                    {section.heading}
                  </h3>
                  <div className="mt-1.5 space-y-2">
                    {section.body.map((paragraph) => (
                      <p
                        key={paragraph.slice(0, 48)}
                        className="m-0 text-[12.5px] leading-relaxed text-white/60 print:text-black"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-white/25 print:hidden">
              Enlace directo:{" "}
              <Link href={`/legal/${doc.slug}`} className="text-pink-300 no-underline">
                app.rabbitty.me/legal/{doc.slug}
              </Link>
            </p>
          </article>
        ))}
      </div>

      {/* Pie */}
      <footer className="mt-14 border-t border-white/10 pt-6 print:border-black/20">
        <p className="m-0 text-[11px] leading-relaxed text-white/35 print:text-black">
          ¿Dudas sobre tus datos? Escribe a{" "}
          <a href={`mailto:${CONTACT}`} className="text-pink-300 print:text-black">
            {CONTACT}
          </a>
          . Los Bunz son puntos de lealtad: no son dinero, no se compran con dinero y no se
          convierten a efectivo.
        </p>
        <p className="m-0 mt-3 text-[10.5px] text-white/25 print:text-black">
          Rabbitty · versión pública {LEGAL_VERSION} ·{" "}
          <span className="print:hidden">app.rabbitty.me/legal</span>
        </p>
      </footer>
    </div>
  );
}
