import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  async redirects() {
    return [
      { source: "/campaigns", destination: "/marketing/campaigns", permanent: false },
      { source: "/customers", destination: "/marketing/audiences", permanent: false },
      { source: "/birthdays", destination: "/marketing/automations/birthdays", permanent: false },
      { source: "/referrals", destination: "/marketing/referrals", permanent: false },
      { source: "/qr-generator", destination: "/marketing/qr", permanent: false },
      { source: "/atmosphere", destination: "/marketing/atmosphere", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            // Allow Web Bluetooth, WebUSB, and Web Serial APIs
            // Without this, Chrome blocks navigator.bluetooth even on HTTPS
            key: "Permissions-Policy",
            value: "bluetooth=*, usb=*, serial=*, camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // La landing de Rabbit Chair lleva el token de invitación en la URL.
        // Sin `no-referrer`, cualquier recurso externo o enlace saliente lo
        // filtraría en el header Referer.
        source: "/rabbit-chair",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        // El HTML de /pos se servía con s-maxage=31536000 (cache de 1 año).
        // Eso dejaba iPads corriendo un bundle viejo durante días: el botón de
        // Ayuda seguía abriendo el admin en Safari aunque el código ya estuviera
        // corregido. Estas rutas deben revalidar SIEMPRE.
        source: "/pos",
        headers: [{ key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" }],
      },
      {
        source: "/pos/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" }],
      },
      {
        source: "/comandero",
        headers: [{ key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
