import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Rabbitty - The Rabbit Hole',
  description: 'Gana mientras gastas. El Sistema Operativo Definitivo para el Consumidor y el Negocio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark scroll-smooth">
      <body className={`${inter.variable} antialiased bg-black text-white selection:bg-pink-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
