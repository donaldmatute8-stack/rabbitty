import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "../lib/providers";
import { ErrorBoundary } from "@rabbitty/ui";

export const metadata: Metadata = {
  title: "Rabbitty POS",
  description: "Sistema POS para restaurantes",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="antialiased">
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: "var(--rabbitty-font)" }}>
        <ErrorBoundary>
          <TRPCProvider>{children}</TRPCProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
