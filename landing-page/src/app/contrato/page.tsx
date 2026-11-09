import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTRACT_SECTIONS, CONTRACT_VERSION } from '@/lib/contractContent';

export const metadata: Metadata = {
  title: 'Contrato de Participación para Negocios | Rabbitty',
  description:
    'Términos y condiciones de participación de negocios en Rabbitty: recompensas Bunz, capacidad dinámica, recuperación con aceptación, obligaciones, responsabilidad y evidencia de aceptación.',
};



export default function ContratoPage() {
  return (
    <div className="min-h-screen bg-[#07070F] text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold text-white/60 hover:text-white">
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-black tracking-tight">RABBITTY</span>
            <span className="rounded-full border border-pink-500/30 bg-pink-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-pink-300">
              Legal México
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">
          Negocios afiliados
        </p>
        <h1 className="m-0 mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Contrato de Participación
        </h1>
        <p className="m-0 mt-2 text-sm text-white/50">
          Versión {CONTRACT_VERSION} · Vigente desde el 8 de noviembre de 2026
        </p>

        <div className="mt-10 space-y-8">
          {CONTRACT_SECTIONS.map((section, index) => (
            <section key={section.title} className="border-t border-white/10 pt-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-black text-pink-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="m-0 text-xl font-black tracking-tight">{section.title}</h2>
              </div>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="mt-3 text-[14px] leading-[1.8] text-white/65">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed text-white/60">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-pink-500/30 bg-pink-500/[0.08] p-6">
          <p className="m-0 text-sm font-black text-white">Aceptación electrónica</p>
          <p className="m-0 mt-2 text-[13px] leading-relaxed text-white/65">
            Al enviar tu alta declaras que leíste y aceptas este Contrato, el Aviso de Privacidad y
            la Política de Bunz. La firma con tu nombre completo, la fecha, la versión del Contrato
            y los datos de conexión quedan registrados como evidencia de tu consentimiento.
          </p>
          <Link
            href="/negocios"
            className="mt-4 inline-flex rounded-2xl bg-pink-500 px-5 py-3 text-sm font-black text-white hover:bg-pink-400"
          >
            Volver al alta de negocio
          </Link>
        </div>
      </main>
    </div>
  );
}
