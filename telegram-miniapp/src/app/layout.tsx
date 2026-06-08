import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/contexts/WalletContext";
import AuthProvider from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import AppOpener from "@/components/AppOpener";

export const metadata: Metadata = {
  title: "Rabbitty — Gana bunz",
  description: "La app de recompensas que te paga por consumir",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAFAFA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script
          src="https://telegram.org/js/telegram-web-app.js"
          async
        />
      </head>
      <body className="antialiased bg-white" suppressHydrationWarning>
        <AppOpener />
        <ToastProvider>
          <AuthProvider>
            <WalletProvider>
              {children}
            </WalletProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
