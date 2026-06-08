import { NextResponse } from "next/server";

export async function POST() {
  const url = process.env.RABBITTY_MINIAPP_URL;
  const secret = process.env.RABBITTY_API_SECRET;

  if (!url) {
    return NextResponse.json({ success: false, error: "Miniapp no configurada" }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/api/auth/qr/generate`, {
      method: "POST",
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
