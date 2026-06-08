import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "../lib/providers";
import { ErrorBoundary } from "@rabbitty/ui";

export const metadata: Metadata = {
  title: "Rabbitty Admin",
  description: "Panel de administración Rabbitty",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="antialiased">
      <body className="min-h-screen" style={{ fontFamily: "var(--rabbitty-font)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <ErrorBoundary>
          <TRPCProvider>{children}</TRPCProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
