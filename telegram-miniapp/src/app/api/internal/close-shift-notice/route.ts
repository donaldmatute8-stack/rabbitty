import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

/** One-off operativo: aviso de cierre administrativo del turno de 626. */
const TOKEN = "2e4ba4d3ea4b0ee04638342a44d0d9ce3928f7943bab483c";

const HTML = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#0A0314;padding:24px;color:#fff">
  <div style="max-width:580px;margin:0 auto;background:linear-gradient(180deg,#130725,#0A0314);border:1px solid rgba(244,63,94,.35);border-radius:24px;overflow:hidden">
    <div style="padding:26px 24px;border-bottom:1px solid rgba(255,255,255,.08);text-align:center">
      <p style="margin:0;font-size:11px;font-weight:900;letter-spacing:.25em;color:#F43F5E">RABBITTY · 626 CAFÉ</p>
      <h1 style="margin:8px 0 0;font-size:21px;color:#fff">Cierre administrativo del turno</h1>
    </div>
    <div style="padding:26px 24px">
      <p style="font-size:14px;line-height:1.6;color:#E2E8F0;margin:0 0 12px">Hola Poncho,</p>
      <p style="font-size:14px;line-height:1.6;color:#CBD5E1;margin:0 0 12px">
        Detectamos que el turno de caja <strong>MAIN</strong> de <strong>626 Café</strong> quedó abierto desde el
        <strong>27 de noviembre de 2026, 14:43</strong>. Para evitar pedidos o cobros sobre un turno olvidado,
        la plataforma realizó un <strong>cierre administrativo</strong>.
      </p>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;margin:16px 0">
        <table style="width:100%;font-size:13px;color:#CBD5E1;border-collapse:collapse">
          <tr><td style="padding:4px 0">Fondo inicial</td><td style="text-align:right;font-weight:800;color:#fff">$1,000.00</td></tr>
          <tr><td style="padding:4px 0">Ventas en efectivo del turno</td><td style="text-align:right;font-weight:800;color:#fff">$1,529.00</td></tr>
          <tr><td style="padding:4px 0">Retiros / gastos</td><td style="text-align:right;font-weight:800;color:#fff">$0.00</td></tr>
          <tr><td style="padding:8px 0 0;border-top:1px solid rgba(255,255,255,.1)">Efectivo esperado</td><td style="text-align:right;font-weight:900;color:#34D399;padding-top:8px;border-top:1px solid rgba(255,255,255,.1)">$2,529.00</td></tr>
        </table>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#CBD5E1;margin:0 0 10px">
        <strong>Importante:</strong> no se realizó arqueo físico. El cierre se registró con el efectivo esperado
        para poder emitir el corte Z, pero el <strong>conteo real de la gaveta queda pendiente</strong> de conciliación.
        Si hay una diferencia, se puede ajustar con el equipo de Rabbitty.
      </p>
      <p style="font-size:13px;line-height:1.6;color:#CBD5E1;margin:0 0 18px">
        No había pedidos pendientes al momento del cierre. Puedes abrir un turno nuevo cuando vuelvas a operar.
      </p>
      <a href="https://admin.rabbitty.me/pos" style="display:inline-block;background:#F43F5E;color:#fff;font-weight:800;font-size:13px;padding:12px 22px;border-radius:12px;text-decoration:none">Abrir el POS</a>
      <p style="font-size:12px;color:#94A3B8;margin:18px 0 0">Si tienes dudas, responde a este correo.</p>
    </div>
    <div style="padding:18px 24px;border-top:1px solid rgba(255,255,255,.06);font-size:10px;color:#64748B;text-align:center">Rabbitty · Correo transaccional para comercios registrados</div>
  </div>
</div>`;

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const result = await sendEmail({
    to: "poncho.herreraru@gmail.com",
    subject: "626 Café · cierre administrativo del turno abierto",
    html: HTML,
  });
  return NextResponse.json({ ok: result.ok, id: result.ok ? "sent" : null });
}
