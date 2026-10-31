export { auth as proxy } from "@rabbitty/auth";

export const config = {
  // `pay` excluido: la página de pago la abre el COMENSAL (QR de mostrador /
  // móvil), no requiere sesión del comercio; la seguridad vive en tRPC
  // (publicLimited + scoping por payerSubjectId) y en la liquidación server-side.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|demo|privacy|verify-2fa|Ra.png|pay).*)"],
};
