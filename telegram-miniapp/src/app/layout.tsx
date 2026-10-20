import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WalletProvider } from "@/contexts/WalletContext";
import AuthProvider from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/contexts/ToastContext";
import AppOpener from "@/components/AppOpener";
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
        {/* Auto-recuperación de chunks desactualizados en WKWebView / Native iOS */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              window.addEventListener('error', function(e) {
                var msg = (e && e.message) ? e.message.toLowerCase() : '';
                if (msg.indexOf('chunkloaderror') !== -1 || msg.indexOf('loading chunk') !== -1 || msg.indexOf('failed to fetch dynamically imported module') !== -1) {
                  var lastReload = sessionStorage.getItem('rabbitty_chunk_reload_ts');
                  var now = Date.now();
                  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                    sessionStorage.setItem('rabbitty_chunk_reload_ts', String(now));
                    console.warn('[Rabbitty Recovery] Chunk load failure detected. Reloading with cache bust...');
                    window.location.reload();
                  }
                }
              });
            })();`,
          }}
        />
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
