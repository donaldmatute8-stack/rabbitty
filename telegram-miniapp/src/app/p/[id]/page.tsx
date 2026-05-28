import { Metadata, ResolvingMetadata } from 'next';
import prisma from '@/lib/prisma';
import { MapPin, Clock, Tag, ExternalLink } from 'lucide-react';
import Link from 'next/link';

type Props = {
  params: { id: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.id;
  const business = await prisma.ownedBusiness.findUnique({ where: { id } });

  if (!business) {
    return { title: 'Negocio no encontrado | Rabbitty' };
  }

  const gallery = business.gallery ? JSON.parse(business.gallery) : [];
  const image = gallery.length > 0 ? gallery[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24';

  return {
    title: `${business.name} en Rabbitty 🐰`,
    description: `Gana +${business.rewardPercentage}% en Bunz visitando ${business.name}. ${business.description || ''}`,
    openGraph: {
      title: `${business.name} | Gana +${business.rewardPercentage}% Bunz`,
      description: `Visita ${business.name} en ${business.address} y obtén recompensas criptográficas escaneando tu ticket.`,
      images: [image],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${business.name} en Rabbitty`,
      description: `Gana +${business.rewardPercentage}% en Bunz escaneando tu ticket.`,
      images: [image],
    }
  }
}

export default async function PublicAffiliatePage({ params }: Props) {
  const business = await prisma.ownedBusiness.findUnique({ where: { id: params.id } });

  if (!business) {
    return <div className="min-h-screen flex items-center justify-center">Negocio no encontrado</div>;
  }

  const gallery = business.gallery ? JSON.parse(business.gallery) : [];
  const coverImage = gallery.length > 0 ? gallery[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24';

  // Deep Link to open Telegram Mini App on this specific profile
  const telegramDeepLink = `https://t.me/RabbittyBot/app?startapp=affiliate_${business.id}`;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      {/* Hero Image */}
      <div className="w-full h-72 md:h-96 relative">
        <img src={coverImage} alt={business.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        
        <div className="absolute bottom-6 left-6 right-6 text-white max-w-4xl mx-auto">
          <span className="bg-pink-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
            {business.category}
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">{business.name}</h1>
          <div className="flex items-center gap-2 text-white/80 font-medium">
            <MapPin size={16} /> {business.address}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-8 -mt-16 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-black text-gray-900 mb-4">Acerca de</h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                {business.description || 'Este negocio forma parte del ecosistema Rabbitty.'}
              </p>

              <div className="bg-pink-50 rounded-2xl p-6 border border-pink-100">
                <h3 className="text-pink-600 font-black flex items-center gap-2 mb-2">
                  <Tag size={20} /> Happy Hour de Bunz
                </h3>
                <p className="text-gray-700 font-medium mb-3">
                  Escanea tu ticket durante estas horas para llevarte el <strong className="text-pink-600 font-black">+{business.rewardPercentage}%</strong> en Bunz.
                </p>
                <span className="bg-pink-600 text-white text-xs font-black px-3 py-1.5 rounded-full">
                  {business.startTime} a {business.endTime}
                </span>
              </div>
            </div>

            {/* Desktop CTA */}
            <div className="w-full md:w-80 bg-gray-50 rounded-2xl p-6 border border-gray-200 text-center flex-shrink-0">
              <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                🐰
              </div>
              <h3 className="font-black text-gray-900 text-xl mb-2">¿Quieres ganar cripto?</h3>
              <p className="text-sm text-gray-500 mb-6 font-medium">
                Abre esta oferta en la App oficial de Rabbitty en Telegram para reclamar tus puntos.
              </p>
              <a 
                href={telegramDeepLink}
                className="block w-full bg-[#2AABEE] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#229ED9] transition-colors"
              >
                <ExternalLink size={18} />
                Abrir en Telegram
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
