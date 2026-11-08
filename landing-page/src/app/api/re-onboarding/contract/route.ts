import { NextResponse } from "next/server";
import { CONTRACT_TITLE, CONTRACT_VERSION, renderContractText } from "@/lib/contractContent";
import { sha256Hex } from "@/lib/contractEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Texto canónico del contrato y su hash.
 *
 * Público y sin datos personales: permite verificar que el texto que se muestra
 * en /contrato es exactamente el que se hashea en la aceptación.
 */
export async function GET() {
  const text = renderContractText();
  return NextResponse.json(
    {
      ok: true,
      title: CONTRACT_TITLE,
      version: CONTRACT_VERSION,
      hash: sha256Hex(text),
      text,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
