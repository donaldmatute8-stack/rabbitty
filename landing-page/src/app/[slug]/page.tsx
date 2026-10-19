import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  MapPin,
  Clock,
  Sparkles,
  Navigation,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  Award,
} from 'lucide-react';
import { getAffiliateBySlug, isValidSlug } from '@/lib/affiliateLanding';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const affiliate = await getAffiliateBySlug(slug);

  if (!affiliate) {
    return {
      title: 'Comercio no encontrado | Rabbitty',
      description: 'El perfil solicitado no existe o no se encuentra activo.',
    };
  }

  const title = `${affiliate.name} | Menú, Horarios y Recompensas Bunz`;
  const description =
    affiliate.description ||
    `Conoce ${affiliate.name} en ${affiliate.address}. Explora su menú oficial, horarios de atención y acumula +${affiliate.rewardPercentage}% en Bunz en cada consumo.`;

  const coverImage = affiliate.gallery[0] || affiliate.logoUrl || 'https://rabbitty.me/icon.png';
  const canonicalUrl = `https://${affiliate.slug}.rabbitty.me`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Rabbitty Network',
      images: [
        {
          url: coverImage,
          width: 1200,
          height: 630,
          alt: affiliate.name,
        },
      ],
      type: 'website',
      locale: 'es_MX',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [coverImage],
    },
    other: {
      'geo.placename': affiliate.address,
      'geo.position': `${affiliate.lat};${affiliate.lng}`,
      'ICBM': `${affiliate.lat}, ${affiliate.lng}`,
    },
  };
}

export default async function AffiliateLandingPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  const affiliate = await getAffiliateBySlug(slug);
  if (!affiliate) {
    notFound();
  }

  const coverImage =
    affiliate.gallery.length > 0
      ? affiliate.gallery[0]
      : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80';

  // Schema.org structured JSON-LD for Search Engines & LLMs
  const schemaType =
    affiliate.category.toLowerCase().includes('cafe') || affiliate.category.toLowerCase().includes('cafetería')
      ? 'CafeOrCoffeeShop'
      : affiliate.category.toLowerCase().includes('restaurant')
      ? 'Restaurant'
      : 'LocalBusiness';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: affiliate.name,
    image: affiliate.gallery.length > 0 ? affiliate.gallery : [coverImage],
    '@id': `https://${affiliate.slug}.rabbitty.me`,
    url: `https://${affiliate.slug}.rabbitty.me`,
    telephone: '+523312345678',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: affiliate.address,
      addressCountry: 'MX',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: affiliate.lat,
      longitude: affiliate.lng,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: affiliate.startTime,
        closes: affiliate.endTime,
      },
    ],
    hasMenu: affiliate.menuItems.length > 0
      ? {
          '@type': 'Menu',
          name: `Menú de ${affiliate.name}`,
          hasMenuItem: affiliate.menuItems.map(item => ({
            '@type': 'MenuItem',
            name: item.name,
            description: item.description,
            offers: {
              '@type': 'Offer',
              price: item.price,
              priceCurrency: 'MXN',
            },
          })),
        }
      : undefined,
  };

  const appDirectLink = `https://app.rabbitty.me/affiliate/${affiliate.id}`;

  return (
    <div className="min-h-screen bg-[#0A0A10] text-white selection:bg-[#E91E63] selection:text-white">
      {/* Injected Schema.org JSON-LD for Google & LLM Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-50 bg-[#0A0A10]/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E91E63]/20 border border-[#E91E63]/30 flex items-center justify-center text-pink-400 font-black">
              🐰
            </div>
            <div>
              <span className="font-black text-sm tracking-tight text-white block leading-none">
                {affiliate.name}
              </span>
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                Sucursal Oficial en Rabbitty
              </span>
            </div>
          </div>

          <a
            href={appDirectLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#E91E63] hover:bg-[#FF4081] text-white text-xs font-black px-4 py-2 rounded-full transition-all shadow-lg shadow-[#E91E63]/30 active:scale-95 no-underline"
          >
            <span>Abrir en Rabbitty</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="relative w-full h-95 sm:h-115 bg-black">
        <Image
          src={coverImage}
          alt={affiliate.name}
          fill
          priority
          unoptimized
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#0A0A10] via-[#0A0A10]/50 to-transparent" />

        <div className="absolute bottom-10 left-0 right-0 px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E91E63]/20 border border-[#E91E63]/30 text-pink-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} />
                <span>{affiliate.category}</span>
              </div>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
                {affiliate.name}
              </h1>
              <p className="text-sm text-white/70 max-w-xl flex items-center gap-2">
                <MapPin size={16} className="text-[#E91E63] shrink-0" />
                <span>{affiliate.address}</span>
              </p>
            </div>

            {/* Bunz Badge Card */}
            <div className="bg-linear-to-br from-[#E91E63] to-[#AD1457] p-4 rounded-3xl border border-white/20 shadow-2xl flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-black text-2xl">
                🎁
              </div>
              <div>
                <span className="text-xs font-bold text-white/80 block">Recompensa Oficial</span>
                <span className="text-2xl font-black text-white leading-none">
                  +{affiliate.rewardPercentage}% Bunz
                </span>
                <span className="text-[10px] text-white/70 block mt-0.5">En cada visita validada</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Body Grid */}
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-16">
        {/* Quick Info & Action Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#14141E] p-5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <span className="text-xs text-white/50 font-bold block">Horario de Servicio</span>
              <span className="text-sm font-black text-white">
                {affiliate.startTime} - {affiliate.endTime}
              </span>
              <span className="text-[11px] text-emerald-400 block mt-0.5">Abierto hoy</span>
            </div>
          </div>

          <div className="bg-[#14141E] p-5 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
              <Award size={24} />
            </div>
            <div>
              <span className="text-xs text-white/50 font-bold block">Fidelización Activa</span>
              <span className="text-sm font-black text-white">Programa Bunz</span>
              <span className="text-[11px] text-pink-400 block mt-0.5">Canjeable en el local</span>
            </div>
          </div>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${affiliate.name} ${affiliate.address}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#14141E] hover:bg-[#1a1a27] p-5 rounded-2xl border border-white/10 flex items-center justify-between text-white no-underline transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Navigation size={24} />
              </div>
              <div>
                <span className="text-xs text-white/50 font-bold block">¿Cómo llegar?</span>
                <span className="text-sm font-black text-white">Ver en Google Maps</span>
              </div>
            </div>
            <ArrowRight size={18} className="text-white/40 group-hover:text-white transition-colors" />
          </a>
        </div>

        {/* About Section */}
        {affiliate.description && (
          <div className="bg-[#14141E] p-8 rounded-3xl border border-white/10 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-pink-400">
              Acerca de {affiliate.name}
            </h2>
            <p className="text-base text-white/80 leading-relaxed max-w-3xl">
              {affiliate.description}
            </p>
          </div>
        )}

        {/* Digital Menu Catalog Preview */}
        {affiliate.menuItems.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-pink-400">
                  Especialidades de la Casa
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Menú Destacado
                </h2>
              </div>
              <a
                href={appDirectLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-black text-pink-400 hover:text-pink-300 inline-flex items-center gap-1.5 no-underline"
              >
                <span>Ver Menú Completo & Pedir</span>
                <ArrowRight size={14} />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {affiliate.menuItems.map(item => (
                <div
                  key={item.id}
                  className="bg-[#14141E] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-white/20 transition-all space-y-3"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-black text-sm text-white">{item.name}</h3>
                      <span className="font-extrabold text-sm text-pink-400">${item.price} MXN</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-white/60 mt-1.5 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                    <span>Acumula +{Math.round(item.price * (affiliate.rewardPercentage / 100))} Bunz</span>
                    <a
                      href={appDirectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 font-bold hover:underline"
                    >
                      Pedir en mesa →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery Section */}
        {affiliate.gallery.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-pink-400">
              Galería de la Sucursal
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {affiliate.gallery.map((img, i) => (
                <div
                  key={i}
                  className="relative h-44 rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-md group"
                >
                  <Image
                    src={img}
                    alt={`${affiliate.name} fotografía ${i + 1}`}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LLM & Human FAQ Section (Semantic Content visible for AI & users) */}
        <div className="bg-[#14141E] p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center gap-2.5 text-pink-400">
            <HelpCircle size={20} />
            <h2 className="text-lg font-black tracking-tight text-white">
              Preguntas Frecuentes sobre {affiliate.name}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1.5">
              <h3 className="font-bold text-white">¿Cómo acumulo recompensas en este local?</h3>
              <p className="text-white/60 text-xs leading-relaxed">
                Al pagar tu cuenta, solicita escanear el código QR en caja con tu cuenta de Rabbitty. Recibirás automáticamente el +{affiliate.rewardPercentage}% del total de tu consumo acreditado en Bunz.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-white">¿Tienen servicio y pedidos en mesa?</h3>
              <p className="text-white/60 text-xs leading-relaxed">
                Sí. Puedes escanear el código QR de cualquiera de las mesas del establecimiento para consultar el menú interactivo, ver fotografías y enviar tu pedido directamente desde tu teléfono.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-white">¿Cuál es el horario y ubicación oficial?</h3>
              <p className="text-white/60 text-xs leading-relaxed">
                Atienden de lunes a domingo en horario continuo de {affiliate.startTime} a {affiliate.endTime} en {affiliate.address}.
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-white">¿Se requiere reservar con anticipación?</h3>
              <p className="text-white/60 text-xs leading-relaxed">
                Se reciben clientes por orden de llegada y se admiten reservas anticipadas a través de la red Rabbitty y el portal de atención directa.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA Card */}
        <div className="p-8 sm:p-12 rounded-3xl bg-linear-to-r from-[#E91E63]/20 via-[#14141E] to-[#8B5CF6]/20 border border-white/10 text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Vive la experiencia completa en {affiliate.name}
          </h2>
          <p className="text-sm text-white/70 max-w-lg mx-auto leading-relaxed">
            Explora el menú interactivo, reserva tu mesa y gana hasta +{affiliate.rewardPercentage}% en recompensas Bunz cada vez que visites este establecimiento.
          </p>
          <div className="pt-2">
            <a
              href={appDirectLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white px-8 py-4 rounded-full font-black text-sm tracking-wide shadow-xl shadow-[#E91E63]/30 hover:scale-105 active:scale-95 transition-all no-underline"
            >
              <span>Abrir Sucursal Digital en Rabbitty</span>
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-xs text-white/40 space-y-2">
        <p>© 2026 {affiliate.name} · Impulsado por la red descentralizada Rabbitty.</p>
        <p>
          <a href="https://rabbitty.me" className="text-pink-400 hover:underline">
            rabbitty.me
          </a>{' '}
          · Descubre, visita y vuelve.
        </p>
      </footer>
    </div>
  );
}
