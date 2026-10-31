import { auth } from "@rabbitty/auth";
import { NextResponse } from "next/server";

export function proxy() {
  if (process.env.E2E_TEST) {
    return NextResponse.next();
  }
// `auth` is the NextAuth middleware helper (Node-style signature); cast to a no-arg callable.
const authMiddleware = auth as unknown as () => ReturnType<typeof NextResponse.next>;
return authMiddleware();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
