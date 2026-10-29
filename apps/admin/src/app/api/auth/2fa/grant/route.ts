import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import {
  isGodAdminIdentity,
  issueGod2faCookieValue,
  GOD_2FA_COOKIE,
} from "@rabbitty/api/services/god2fa";

export const runtime = "nodejs";

/** POST /api/auth/2fa/grant — emite la cookie god2fa tras verificación exitosa. */
export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";

  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GOD_2FA_COOKIE, issueGod2faCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60,
    path: "/",
  });
  return res;
}
