import { auth } from "@rabbitty/auth";
import { NextResponse } from "next/server";

export function proxy() {
  if (process.env.E2E_TEST) {
    return NextResponse.next();
  }
  return (auth as any)();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)"],
};
