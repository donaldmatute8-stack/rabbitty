import type { Metadata } from 'next';
import { RitualPreviewClient } from './RitualPreviewClient';

export const metadata: Metadata = {
  title: 'Ritual de bienvenida · Rabbitty',
  description: 'Vista previa del ritual de bienvenida de Rabbitty.',
  robots: { index: false, follow: false },
};

export default function RitualPreviewPage() {
  return <RitualPreviewClient />;
}
