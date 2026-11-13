import type { Metadata, Viewport } from "next";

/**
 * Metadatos del comandero: manifest propio para instalarlo como app aparte
 * (pantalla de inicio "Comandero", no "POS") y sin zoom accidental.
 */
export const metadata: Metadata = {
  title: "Comandero · Rabbitty",
  manifest: "/comandero.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Comandero" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#08080a",
};

export default function ComanderoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
