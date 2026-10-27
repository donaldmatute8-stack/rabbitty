import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WalletProvider } from "@/contexts/WalletContext";
import AuthProvider from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import AppOpener from "@/components/AppOpener";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import BunzyLaunchOverlay from "@/components/bunzy/BunzyLaunchOverlay";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Telegram WebApp Script */}
        <script
          src="https://telegram.org/js/telegram-web-app.js"
          async
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <BunzyLaunchOverlay />
        <AppOpener />
          <ToastProvider>
            <AuthProvider>
              <DeepLinkHandler />
              <WalletProvider>
                {children}
              </WalletProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
