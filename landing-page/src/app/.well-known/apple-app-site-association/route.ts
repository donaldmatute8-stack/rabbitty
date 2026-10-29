import { NextResponse } from "next/server";

/** AASA con content-type application/json (iOS exige este tipo para Universal Links). */
export async function GET() {
  const aasa = {
    applinks: {
      details: [
        {
          appIDs: ["FW97275K5X.com.rabbitty.app"],
          components: [
            { "/": "/download*", "comment": "Pósters impresos: miembros abren la app; no instalados → landing con App Store" },
            { "/": "/scan*", "comment": "Escáner / check-in / qrlogin" },
            { "/": "/qr/*", "comment": "QRs de mesa" },
            { "/": "/pay/*", "comment": "Pagos POS" },
            { "/": "/affiliate/*", "comment": "Fichas de afiliados" },
            { "/": "/kiosk-confirm*", "comment": "Identidad del cliente para el kiosko" },
          ],
        },
      ],
    },
  };
  return new NextResponse(JSON.stringify(aasa), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}
