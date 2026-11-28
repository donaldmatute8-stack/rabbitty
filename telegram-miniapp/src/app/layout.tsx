import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WalletProvider } from "@/contexts/WalletContext";
import AuthProvider from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import { Toaster } from "@/components/ui/Toast";
import AppOpener from "@/components/AppOpener";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import BunzyLaunchOverlay from "@/components/bunzy/BunzyLaunchOverlay";
import ProximityEngine from "@/components/ProximityEngine";
import ConsentGate from "@/components/ConsentGate";
import AutoReadNotifications from "@/components/AutoReadNotifications";
import { NativeGestures } from "@/components/NativeGestures";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('rabbitty_theme')||'dark';var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;var d=document.documentElement;d.setAttribute('data-theme',r);d.classList.toggle('dark',r==='dark');d.classList.toggle('light',r==='light');d.style.colorScheme=r;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Rabbitty — Gana bunz",
  description: "La app de recompensas que te paga por consumir",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth" >
      <head>
        {/* Tema antes del primer paint, sin el warning de React por <script> manual. */}
        <Script id="rabbitty-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Telegram WebApp Script */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {/* Mapa: abrir TLS/DNS antes de que el motor pida tiles (menos latencia) */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <NativeGestures />
        <ThemeProvider>
          <BunzyLaunchOverlay />
        <AppOpener />
          <ToastProvider>
            <Toaster />
            <AuthProvider>
              <DeepLinkHandler />
              <WalletProvider>
                <AutoReadNotifications />
                {children}
                {/* Motor global de proximidad: pings en cualquier pantalla + modal de check-in */}
                <ProximityEngine />
                {/* Re-consentimiento de Términos/Privacidad para usuarios existentes */}
                <ConsentGate />
              </WalletProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
