import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Sparkles,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Coffee,
  Heart,
  Award,
  CheckCircle2,
  Phone,
  Flame,
} from 'lucide-react';
import { getAffiliateBySlug, isValidSlug } from '@/lib/affiliateLanding';
import { SmartAppAction } from '@/components/SmartAppAction';
import { StickyMobileBar } from '@/components/StickyMobileBar';

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

  const title = `${affiliate.name} | ${affiliate.category}`;
  const description =
    affiliate.description ||
    `Conoce ${affiliate.name} en ${affiliate.address}. Menú artesanal, horarios de atención y programa de lealtad Rabbitty en cada consumo.`;

  const coverImage = affiliate.heroImage || affiliate.gallery[0] || 'https://rabbitty.me/icon.png';
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
      siteName: `${affiliate.name} · Digital Branch`,
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

  // Schema.org structured JSON-LD for Google & LLM Crawlers
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
    image: affiliate.gallery.length > 0 ? affiliate.gallery : [affiliate.heroImage],
    '@id': `https://${affiliate.slug}.rabbitty.me`,
    url: `https://${affiliate.slug}.rabbitty.me`,
    telephone: affiliate.phone || '+523312345678',
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: affiliate.address,
      addressLocality: affiliate.city || 'México',
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

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${affiliate.name} ${affiliate.address}`
  )}`;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C1810] selection:bg-[#D97706]/30 selection:text-[#2C1810] font-sans antialiased pb-20 md:pb-0">
      {/* Injected Schema.org JSON-LD for Search Engines & LLMs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Sticky Top Header: 70% Brand, 30% Rabbitty */}
      <header className="sticky top-0 z-40 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-stone-200/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-900/10 border border-amber-900/20 flex items-center justify-center text-amber-900 font-serif font-black text-lg">
              ☕
            </div>
            <div>
              <span className="font-serif font-black text-base sm:text-lg tracking-tight text-stone-900 block leading-none">
                {affiliate.name}
              </span>
              <span className="text-[10px] text-stone-500 font-medium uppercase tracking-wider block mt-0.5">
                {affiliate.category}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-widest font-bold text-stone-600">
              <a href="#menu-section" className="hover:text-stone-900 transition-colors no-underline">
                Menú
              </a>
              <a href="#story-section" className="hover:text-stone-900 transition-colors no-underline">
                Nosotros
              </a>
              <a href="#visit-section" className="hover:text-stone-900 transition-colors no-underline">
                Ubicación
              </a>
            </nav>

            <SmartAppAction
              affiliateId={affiliate.id}
              affiliateName={affiliate.name}
              buttonLabel="Abrir en Rabbitty"
              variant="primary"
            />
          </div>
        </div>
      </header>

      {/* HERO SECTION: Editorial Gastronomic Focus */}
      <section className="relative px-6 pt-10 sm:pt-16 pb-12 sm:pb-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          
          {/* Brand & Copy Left Column */}
          <div className="lg:col-span-6 space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/70 border border-amber-900/15 text-amber-950 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={13} className="text-amber-800" />
              <span>Cafetería de Especialidad & Masa Madre</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-stone-950 leading-[1.05]">
              Donde cada taza cuenta una <span className="italic font-normal text-amber-900">historia.</span>
            </h1>

            <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl font-normal">
              {affiliate.description ||
                'Granos de origen único seleccionados en pequeños lotes, tostados semanalmente y panadería artesanal horneada al amanecer.'}
            </p>

            {/* Direct Dual CTAs: Ver Menú + Cómo Llegar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#menu-section"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-[#2C1810] hover:bg-[#3D2318] text-white text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-black/10 no-underline cursor-pointer active:scale-95"
              >
                <span>Explorar Menú</span>
                <ArrowRight size={15} />
              </a>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-800 text-xs uppercase tracking-wider font-bold transition-all no-underline active:scale-95 shadow-sm"
              >
                <MapPin size={15} className="text-amber-800" />
                <span>Cómo Llegar</span>
              </a>
            </div>

            {/* Verified Quick Highlights */}
            <div className="pt-4 border-t border-stone-200 grid grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2 text-stone-700">
                <CheckCircle2 size={16} className="text-amber-800 shrink-0" />
                <span>Extracción artesanal diaria</span>
              </div>
              <div className="flex items-center gap-2 text-stone-700">
                <CheckCircle2 size={16} className="text-amber-800 shrink-0" />
                <span>Acumula Bunz en cada consumo</span>
              </div>
            </div>
          </div>

          {/* Hero Photography with Arch/Editorial Framing */}
          <div className="lg:col-span-6 relative">
            <div className="relative aspect-4/3 sm:aspect-5/4 rounded-3xl sm:rounded-[36px] overflow-hidden shadow-2xl border-4 border-white bg-stone-200 group">
              <Image
                src={affiliate.heroImage}
                alt={affiliate.name}
                fill
                priority
                unoptimized
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

              {/* Floating Verified Badge */}
              <div className="absolute bottom-5 left-5 right-5 sm:right-auto bg-[#FDFBF7]/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-stone-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-900/10 text-amber-900 flex items-center justify-center font-serif font-black text-xl">
                  ✨
                </div>
                <div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest block">
                    Sucursal Oficial
                  </span>
                  <span className="font-serif font-bold text-sm text-stone-900 block leading-tight">
                    {affiliate.address}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: FAVORITOS DEL NEGOCIO (Visual Menu with Real Photos) */}
      <section id="menu-section" className="py-16 sm:py-24 px-6 bg-[#F5F2EB] border-y border-stone-200/80">
        <div className="max-w-6xl mx-auto space-y-12">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-900 block mb-2">
                Selección de Temporada
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-stone-900">
                Especialidades de la Casa
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-stone-600 max-w-sm">
              Cada platillo y bebida preparado al momento con ingredientes frescos de productores locales.
            </p>
          </div>

          {/* 3 Featured Products with High-Resolution Photography */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {affiliate.menuItems.map(item => (
              <div
                key={item.id}
                className="bg-[#FDFBF7] rounded-3xl overflow-hidden border border-stone-200/90 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  {/* Photo Container */}
                  <div className="relative aspect-4/3 w-full bg-stone-200 overflow-hidden">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        unoptimized
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">☕</div>
                    )}
                    {item.badge && (
                      <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-[#2C1810]/85 backdrop-blur-md text-[#FDFBF7] text-[10px] font-black uppercase tracking-wider">
                        {item.badge}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-serif font-bold text-xl text-stone-900 leading-tight">
                        {item.name}
                      </h3>
                      <span className="font-mono font-black text-base text-amber-950 shrink-0">
                        ${item.price} <span className="text-xs font-normal text-stone-500">MXN</span>
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-stone-600 leading-relaxed font-normal">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-6 pt-0 border-t border-stone-100 flex items-center justify-between text-xs">
                  {item.rewardBunz && affiliate.features.hasRewards ? (
                    <span className="text-stone-500 font-medium">
                      Acumula <strong className="text-amber-900 font-bold">+{item.rewardBunz} Bunz</strong>
                    </span>
                  ) : (
                    <span className="text-stone-400 text-[11px]">Disponible en barra</span>
                  )}

                  <SmartAppAction
                    affiliateId={affiliate.id}
                    affiliateName={affiliate.name}
                    buttonLabel="Pedir"
                    variant="subtle"
                    className="py-2 px-4 text-[11px]"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-stone-500 mb-4">
              ¿Quieres consultar el menú completo con opciones veganas, sin gluten y filtrados?
            </p>
            <SmartAppAction
              affiliateId={affiliate.id}
              affiliateName={affiliate.name}
              buttonLabel="Ver Menú Completo en Rabbitty"
              variant="outline"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: LA EXPERIENCIA Y ATMÓSFERA */}
      <section id="story-section" className="py-20 px-6 max-w-6xl mx-auto space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-900 block">
              Nuestra Filosofía
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-stone-900 leading-tight">
              Café sin prisas. Espacio con alma.
            </h2>
            <p className="text-stone-600 text-sm leading-relaxed">
              {affiliate.story ||
                'Creemos que una cafetería debe ser el tercer lugar: ese espacio entre el hogar y el trabajo donde puedes concentrarte en tus ideas, leer un buen libro o reconectar con amigos sin el ruido invasivo de las franquicias industriales.'}
            </p>

            {/* Ambience Tags */}
            {affiliate.ambienceTags && (
              <div className="pt-2 flex flex-wrap gap-2">
                {affiliate.ambienceTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-stone-800 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Photo Gallery Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-4">
            {affiliate.gallery.slice(0, 4).map((img, i) => (
              <div
                key={i}
                className="relative aspect-4/3 rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-sm group"
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
      </section>

      {/* SECTION 4: FIDELIZACIÓN RABBITTY (30% Integración Discreta) */}
      <section className="py-16 px-6 bg-[#2C1810] text-[#FDFBF7]">
        <div className="max-w-5xl mx-auto rounded-3xl p-8 sm:p-14 space-y-8">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={13} /> Programa de Lealtad Oficial
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Gana +{affiliate.rewardPercentage}% en Bunz cada vez que nos visites.
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
              Sin tarjetas plásticas ni sellos de papel que se pierden. Pide tu café, escanea tu código en mostrador y acumula recompensas utilizables en tus siguientes consumos.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-white/10 text-xs">
            <div className="space-y-1.5">
              <span className="font-bold text-amber-400 block text-sm">1. Visita y Disfruta</span>
              <p className="text-stone-300">Ordena tus alimentos o bebidas favoritas en barra o mesa.</p>
            </div>
            <div className="space-y-1.5">
              <span className="font-bold text-amber-400 block text-sm">2. Escanea en Mostrador</span>
              <p className="text-stone-300">Muestra tu perfil Rabbitty para acreditar tu consumo al instante.</p>
            </div>
            <div className="space-y-1.5">
              <span className="font-bold text-amber-400 block text-sm">3. Canjea en Tu Próxima Visita</span>
              <p className="text-stone-300">Utiliza tus Bunz para canjear bebidas, postres y promociones.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: VISÍTANOS (Confirmed Map, Hours and Contact) */}
      <section id="visit-section" className="py-20 px-6 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-900 block">
            Encuéntranos
          </span>
          <h2 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-stone-900">
            Horarios & Ubicación
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Horario Confirmado */}
          <div className="p-7 rounded-3xl bg-[#F5F2EB] border border-stone-200/90 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/10 text-amber-900 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900">Horario de Servicio</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Lunes a Domingo en horario continuo: <br />
              <strong className="text-stone-900 text-sm font-mono mt-1 block">
                {affiliate.startTime} — {affiliate.endTime} hrs
              </strong>
            </p>
            <span className="inline-block text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
              Abierto Hoy
            </span>
          </div>

          {/* Card 2: Dirección Física */}
          <div className="p-7 rounded-3xl bg-[#F5F2EB] border border-stone-200/90 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/10 text-amber-900 flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900">Ubicación Física</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {affiliate.address} <br />
              <span className="text-stone-500">{affiliate.city || 'México'}</span>
            </p>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 hover:text-amber-950 underline underline-offset-4"
            >
              <span>Abrir en Google Maps</span>
              <Navigation size={13} />
            </a>
          </div>

          {/* Card 3: Atención y Contacto */}
          <div className="p-7 rounded-3xl bg-[#F5F2EB] border border-stone-200/90 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-900/10 text-amber-900 flex items-center justify-center">
              <Phone size={20} />
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900">Contacto Directo</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Atención en sucursal y pedidos para recoger: <br />
              <strong className="text-stone-900 text-sm font-mono mt-1 block">
                {affiliate.phone || '+52 33 1234 5678'}
              </strong>
            </p>
            <span className="text-[11px] text-stone-500 block">
              {affiliate.features.hasTakeaway ? '✓ Servicio Takeaway disponible' : 'Solo consumo en salón'}
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 6: CIERRE DE CONVERSIÓN */}
      <section className="py-16 px-6 bg-[#FAF8F5] border-t border-stone-200 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">
            Ven a conocernos a {affiliate.name}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
            Descubre nuestro café de especialidad, disfruta de la atmósfera y únete a la comunidad de amantes del buen café.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <SmartAppAction
              affiliateId={affiliate.id}
              affiliateName={affiliate.name}
              buttonLabel="Abrir Sucursal en Rabbitty"
              variant="primary"
            />
          </div>
        </div>
      </section>

      {/* Footer Legal & Terms (Mexico 2026 Compliant) */}
      <footer className="border-t border-stone-200/80 py-10 px-6 bg-[#F5F2EB] text-xs text-stone-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-serif font-bold text-stone-800 text-sm">
              © 2026 {affiliate.name}
            </p>
            <p className="text-[11px] text-stone-500">
              Sucursal digital impulsada por Rabbitty Technologies · Ciudad de México & Guadalajara, México.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-semibold text-stone-600">
            <Link href="/privacy" className="hover:text-stone-950 transition-colors">
              Aviso de Privacidad (LFPDPPP)
            </Link>
            <Link href="/privacy" className="hover:text-stone-950 transition-colors">
              Términos de Servicio (PROFECO 2026)
            </Link>
            <a
              href="https://rabbitty.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-900 hover:text-amber-950 font-bold transition-colors"
            >
              rabbitty.me
            </a>
          </div>
        </div>
      </footer>

      {/* Sticky Bottom Bar for Mobile Visitors */}
      <StickyMobileBar
        affiliateId={affiliate.id}
        affiliateName={affiliate.name}
        address={affiliate.address}
        hasMenu={affiliate.menuItems.length > 0}
      />
    </div>
  );
}
