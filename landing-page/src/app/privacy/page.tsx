import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { LEGAL_VERSION, PUBLISHED_LEGAL_DOCS } from '@rabbitty/legal';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad y Términos de Servicio | Rabbitty México 2026',
  description:
    'Términos y Condiciones, Aviso de Privacidad, Anexo de Pagos y Reglamento de Bunz de Rabbitty, conforme a la LFPDPPP y a las disposiciones de consumo aplicables en México.',
};

/**
 * ── /privacy — documentos legales (una sola fuente) ────────────────────────
 *
 * Antes esta página tenía su **propio** texto, con otra fecha y contenido
 * distinto del que la app muestra y registra al aceptar. Dos políticas de
 * privacidad divergentes es un problema de cumplimiento.
 *
 * Ahora renderiza desde `@rabbitty/legal`, la misma fuente que usa la app
 * (`app.rabbitty.me/legal`). Si cambias el texto, sube `LEGAL_VERSION` en el
 * paquete y ambas superficies quedan alineadas de una vez.
 *
 * Se conserva `/privacy` (y sus anclas `#privacidad`, `#terminos`, …) porque es
 * la URL que se declara en las tiendas de aplicaciones.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#07070F] text-white selection:bg-[#E91E63] selection:text-white">
      <div className="fixed top-0 left-1/4 h-96 w-96 rounded-full bg-[#E91E63]/10 blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 h-96 w-96 rounded-full bg-[#9C27B0]/10 blur-[140px] pointer-events-none" />

      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-6">
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
            <span className="rounded-full border border-[#E91E63]/30 bg-[#E91E63]/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#E91E63]">
              Legal México 2026
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 py-14">
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/70">
            <ShieldCheck size={14} className="text-[#E91E63]" />
            LFPDPPP · PROFECO · México 2026
          </div>
          <h1 className="mb-4 text-3xl font-black tracking-tight md:text-5xl">
            Aviso de Privacidad y Términos de Servicio
          </h1>
          <p className="text-base leading-relaxed text-white/60">
            Versión vigente: <strong className="text-white">{LEGAL_VERSION}</strong>. Este es el mismo
            texto que se muestra y se acepta dentro de la app (
            <a
              href="https://app.rabbitty.me/legal"
              className="text-[#FF8FB8] underline underline-offset-2"
            >
              app.rabbitty.me/legal
            </a>
            ). En Rabbitty protegemos los datos de quienes consumen y de los negocios afiliados.
          </p>
        </div>

        {/* Índice */}
        <nav className="mb-12 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Documentos
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {PUBLISHED_LEGAL_DOCS.map((doc) => (
              <li key={doc.slug}>
                <a
                  href={`#${doc.slug}`}
                  className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11.5px] font-bold text-white/70 transition-colors hover:border-[#E91E63]/40 hover:text-white"
                >
                  {doc.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-14">
          {PUBLISHED_LEGAL_DOCS.map((doc) => (
            <section key={doc.slug} id={doc.slug} className="scroll-mt-28">
              <p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#E91E63]">
                {doc.audience} · actualizado {doc.updated}
              </p>
              <h2 className="mb-3 mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
                {doc.title}
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-white/60">{doc.summary}</p>

              <div className="space-y-6">
                {doc.sections.map((section) => (
                  <div key={`${doc.slug}-${section.heading}`}>
                    <h3 className="mb-2 text-sm font-black text-white">{section.heading}</h3>
                    <div className="space-y-2">
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph.slice(0, 48)}
                          className="m-0 text-[13.5px] leading-relaxed text-white/60"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-white/10 pt-6 text-[11px] leading-relaxed text-white/35">
          ¿Dudas sobre tus datos? Escribe a{' '}
          <a href="mailto:privacidad@rabbitty.me" className="text-[#FF8FB8]">
            privacidad@rabbitty.me
          </a>
          . Los Bunz son puntos de lealtad: no son dinero, no se compran con dinero y no se convierten
          a efectivo.
        </p>
      </main>
    </div>
  );
}
