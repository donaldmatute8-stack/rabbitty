import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      subject?: string;
      html?: string;
    };

    const to = String(body.to || "").trim();
    const subject = String(body.subject || "Reporte Rabbitty").slice(0, 180);
    const html = String(body.html || "");

    if (!isEmail(to)) {
      return NextResponse.json({ ok: false, error: "Correo inválido" }, { status: 400 });
    }
    if (html.length < 50) {
      return NextResponse.json({ ok: false, error: "Reporte vacío" }, { status: 400 });
    }

    const key =
      process.env.RESEND_API_KEY ||
      process.env.AUTH_RESEND_KEY ||
      process.env.RESEND_KEY;

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "Resend no configurado" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rabbitty Reportes <hola@rabbitty.me>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[Reports Email] Resend error:", res.status, detail.slice(0, 300));
      return NextResponse.json(
        { ok: false, error: "No se pudo enviar el correo" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Reports Email]", error);
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
