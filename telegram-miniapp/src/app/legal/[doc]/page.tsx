import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, getLegalDoc } from "../../../lib/legal-docs";

/** Documento legal individual. El contenido vive en `lib/legal-docs.ts`. */
export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: slug } = await params;
  const doc = getLegalDoc(slug);
  return { title: doc ? `${doc.title} · Rabbitty` : "Legal · Rabbitty" };
}

export default async function LegalDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc: slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/legal" className="text-[11px] font-bold text-pink-300 no-underline">
        ← Documentos legales
      </Link>

      <h1 className="mt-3 text-2xl font-extrabold leading-tight text-white">{doc.title}</h1>
      <p className="mt-1 text-[11px] text-white/45">
        Versión {doc.version} · {doc.updated} · {doc.audience}
      </p>

      <div className="mt-8 space-y-6">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="m-0 text-[14px] font-black text-white">{section.heading}</h2>
            <div className="mt-1.5 space-y-2">
              {section.body.map((paragraph, i) => (
                <p key={i} className="m-0 text-[12.5px] leading-relaxed text-white/60">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[11px] leading-relaxed text-white/30">
        Este documento forma parte del conjunto legal de Rabbitty. Los Bunz son
        puntos de lealtad, no dinero. Contacto: hola@rabbitty.me.
      </p>
    </div>
  );
}
