import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { LEGAL_VERSION, PUBLISHED_LEGAL_DOCS } from '@rabbitty/legal';

export const metadata: Metadata = {
  title: 'Documentos legales · Rabbitty',
  description:
    'Términos y Condiciones, Anexo de Pagos (comisiones y liquidaciones), Aviso de Privacidad y Reglamento de Bunz de Rabbitty. Versión vigente ' +
    LEGAL_VERSION +
    '.',
  openGraph: {
    title: 'Documentos legales · Rabbitty',
    description: `Términos, Anexo de Pagos, Aviso de Privacidad y Reglamento de Bunz. Versión ${LEGAL_VERSION}.`,
    url: 'https://rabbitty.me/legal',
    siteName: 'Rabbitty',
    type: 'article',
  },
  alternates: { canonical: 'https://rabbitty.me/legal' },
};

/**
 * ── Versión pública de los documentos legales (landing) ─────────────────────
 *
 * Enlace para compartir sin depender de la app: `rabbitty.me/legal`.
 * Misma fuente que la app (`@rabbitty/legal`), así que no hay copia que se
 * desincronice. Se puede imprimir o guardar como PDF (⌘/Ctrl + P) y tiene
 * Open Graph para que WhatsApp/correo muestren vista previa.
 */
const CONTACT = 'privacidad@rabbitty.me';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#07070F] text-white selection:bg-[#E91E63] selection:text-white">
      <div className="pointer-events-none fixed left-1/4 top-0 h-96 w-96 rounded-full bg-[#E91E63]/10 blur-[140px] print:hidden" />

      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft size={18} />
            <span>Volver al inicio</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Image src="/icon_ra.png" alt="Rabbitty" width={28} height={28} className="object-contain" />
            <span className="font-black tracking-tight">Rabbitty</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-12 print:max-w-none print:px-0 print:py-0">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/70 print:hidden">
            <ShieldCheck size={14} className="text-[#E91E63]" />
            Documento público
          </div>
          <h1 className="mb-3 text-3xl font-black tracking-tight md:text-4xl print:text-black">
            Documentos legales
          </h1>
          <p className="text-sm leading-relaxed text-white/60 print:text-black">
            Versión vigente: <strong className="text-white print:text-black">{LEGAL_VERSION}</strong>.
            Este es el texto completo y público; es el mismo que se muestra y se acepta dentro de la
            app. Puedes imprimirlo o guardarlo como PDF con ⌘/Ctrl + P.
          </p>
        </div>

        <nav className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5 print:hidden">
          <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Contenido
          </p>
          <ol className="m-0 list-decimal space-y-1 pl-5">
            {PUBLISHED_LEGAL_DOCS.map((doc) => (
              <li key={doc.slug}>
                <a
                  href={`#${doc.slug}`}
                  className="text-[12.5px] font-semibold text-[#FF8FB8] underline-offset-2 hover:underline"
                >
                  {doc.title}
                </a>
                <span className="ml-2 text-[11px] text-white/35">{doc.audience}</span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-14">
          {PUBLISHED_LEGAL_DOCS.map((doc, index) => (
            <article key={doc.slug} id={doc.slug} className="scroll-mt-28 print:break-before-page">
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#E91E63] print:text-black">
                Documento {index + 1} de {PUBLISHED_LEGAL_DOCS.length} · {doc.audience}
              </p>
              <h2 className="mb-1 mt-1 text-2xl font-black tracking-tight print:text-black">
                {doc.title}
              </h2>
              <p className="mb-3 mt-1 text-[11px] text-white/40 print:text-black">
                Versión {doc.version} · actualizado {doc.updated}
              </p>
              <p className="mb-6 text-sm leading-relaxed text-white/60 print:text-black">
                {doc.summary}
              </p>

              <div className="space-y-5">
                {doc.sections.map((section) => (
                  <div key={`${doc.slug}-${section.heading}`}>
                    <h3 className="mb-1.5 text-sm font-black text-white print:text-black">
                      {section.heading}
                    </h3>
                    <div className="space-y-2">
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph.slice(0, 48)}
                          className="m-0 text-[13px] leading-relaxed text-white/60 print:text-black"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <footer className="mt-14 border-t border-white/10 pt-6 print:border-black/20">
          <p className="m-0 text-[11px] leading-relaxed text-white/35 print:text-black">
            ¿Dudas sobre tus datos? Escribe a{' '}
            <a href={`mailto:${CONTACT}`} className="text-[#FF8FB8] print:text-black">
              {CONTACT}
            </a>
            . Los Bunz son puntos de lealtad: no son dinero, no se compran con dinero y no se
            convierten a efectivo.
          </p>
          <p className="m-0 mt-3 text-[10.5px] text-white/25 print:text-black">
            Rabbitty · versión pública {LEGAL_VERSION} ·{' '}
            <span className="print:hidden">rabbitty.me/legal</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
