import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "../lib/providers";
import { ErrorBoundary, Toaster } from "@rabbitty/ui";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Rabbitty Admin & POS",
  description: "Punto de Venta Inteligente y Gestión de Negocios Rabbitty",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rabbitty POS",
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/Ra.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} antialiased dark`}>
      <body className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <ErrorBoundary>
          <TRPCProvider>
            {children}
            <Toaster theme="dark" position="top-right" />
          </TRPCProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
