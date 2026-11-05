import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alta de negocio | Rabbitty',
  description:
    'Afiliación de negocios a Rabbitty: elige tu giro, configura tus recompensas en Bunz, firma y entra a tu panel.',
  alternates: { canonical: 'https://rabbitty.me/negocios' },
};

export default function NegociosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
