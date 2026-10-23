import { NextRequest, NextResponse } from 'next/server';

/**
 * Enlace corto para redes sociales: https://rabbitty.me/app
 *
 * - iPhone/iPad  -> NEXT_PUBLIC_IOS_APP_URL (TestFlight hoy; App Store al cambiar la variable)
 * - Resto        -> /download (landing de descarga con QR/instrucciones)
 *
 * Conserva ?ref= y ?bunz= para atribución de afiliados.
 */
export function GET(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_URL;

  if (isIOS && iosUrl) {
    return NextResponse.redirect(iosUrl, 302);
  }

  const target = new URL('/download', req.url);
  req.nextUrl.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return NextResponse.redirect(target, 302);
}
