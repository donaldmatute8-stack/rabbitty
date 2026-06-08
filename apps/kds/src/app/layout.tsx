import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "../lib/providers";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@rabbitty/ui";

export const metadata: Metadata = {
  title: "KDS - Rabbitty",
  description: "Kitchen Display System",
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark antialiased">
      <body className="min-h-screen" style={{ fontFamily: "var(--rabbitty-font)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <ErrorBoundary>
          <TRPCProvider>
            {children}
            <Toaster position="top-right" />
          </TRPCProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
