export { auth as proxy } from "@rabbitty/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|demo|privacy|verify-2fa|Ra.png).*)"],
};
