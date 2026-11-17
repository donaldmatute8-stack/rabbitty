import Link from "next/link";
import { LEGAL_DOCS, LEGAL_VERSION } from "../../lib/legal-docs";

/**
 * Índice de documentos legales. Contenido publicado desde `lib/legal-docs.ts`
 * (la versión que el usuario acepta queda registrada con fecha y versión).
 */
export const metadata = { title: "Legal · Rabbitty" };

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-400">Rabbitty</p>
      <h1 className="mt-2 text-3xl font-extrabold text-white">Documentos legales</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        Versión vigente: <b className="text-white/80">{LEGAL_VERSION}</b>. Al aceptar
        registramos la fecha, tu correo y la versión aceptada.
      </p>

      <ul className="mt-8 space-y-3">
        {LEGAL_DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/legal/${doc.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 no-underline transition-colors hover:bg-white/[0.06]"
            >
              <p className="m-0 text-[15px] font-bold text-white">{doc.title}</p>
              <p className="m-0 mt-0.5 text-[11.5px] text-white/45">{doc.audience}</p>
              <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-white/60">{doc.summary}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[11px] leading-relaxed text-white/35">
        ¿Dudas sobre tus datos? Escribe a privacidad@rabbitty.me. Los Bunz son
        puntos de lealtad: no son dinero, no se compran con dinero y no se
        convierten a efectivo.
      </p>
    </div>
  );
}
