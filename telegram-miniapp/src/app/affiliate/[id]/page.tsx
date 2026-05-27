'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Clock, Tag, Navigation, Phone, Globe, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';

// Mock affiliate data based on ID
const getMockAffiliate = (id: string) => {
  if (id === '2') {
    return {
      id: '2',
      name: '626 Café',
      category: 'Cafetería y Postres',
      reward: 10,
      distance: '2.5km',
      address: 'Av. Las Palmas 626, Centro',
      hours: '08:00 - 21:00',
      description: 'El mejor lugar para disfrutar de un buen café de especialidad y repostería artesanal. Ven y trabaja desde nuestras instalaciones con WiFi de alta velocidad.',
      imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      phone: '+52 55 1234 5678',
      website: 'www.626cafe.mx',
    };
  }
  return {
    id: '1',
    name: 'Kukara',
    category: 'Restaurante Bar',
    reward: 15,
    distance: '1.2km',
    address: 'Calle Falsa 123, Zona Centro',
    hours: '13:00 - 02:00',
    description: 'Disfruta de la mejor mixología de la ciudad acompañada de platillos fusión increíbles. Perfecto para el precopeo o una cena inolvidable.',
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    phone: '+52 55 9876 5432',
    website: 'www.kukara.mx',
  };
};

export default function AffiliateProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const affiliate = getMockAffiliate(id);

  // Scroll effect for header
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 150);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100vh', paddingBottom: 180, position: 'relative' }}>
      {/* Floating Dynamic Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: isScrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled ? '1px solid #F0F0F0' : 'none',
        transition: 'all 0.3s ease',
        paddingTop: 'env(safe-area-inset-top, 40px)',
        paddingBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: isScrolled ? '#F5F5F5' : 'rgba(0,0,0,0.4)',
            color: isScrolled ? '#111' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer',
            backdropFilter: isScrolled ? 'none' : 'blur(10px)',
            transition: 'all 0.3s'
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ opacity: isScrolled ? 1 : 0, transition: 'opacity 0.3s', fontWeight: 900, fontSize: 17, color: '#111' }}>
          {affiliate.name}
        </div>
        <div style={{ width: 40 }} /> {/* Spacer */}
      </div>

      {/* Hero Image */}
      <div style={{ position: 'relative', width: '100%', height: 340 }}>
        <img src={affiliate.imageUrl} alt={affiliate.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)' }} />
        
        {/* Floating Reward Badge on Hero */}
        <div style={{ position: 'absolute', bottom: 40, right: 20 }}>
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            style={{
              background: 'linear-gradient(135deg, #E91E63 0%, #AD1457 100%)',
              color: '#fff', padding: '10px 20px', borderRadius: 999,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 8px 24px rgba(233,30,99,0.4)',
              border: '2px solid rgba(255,255,255,0.2)'
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 2s infinite' }} />
            <span style={{ fontWeight: 900, fontSize: 18 }}>+{affiliate.reward}%</span>
            <span style={{ fontWeight: 700, fontSize: 12 }}>BUNZ</span>
          </motion.div>
        </div>
      </div>

      {/* Content Card (Overlaps Image) */}
      <div style={{
        position: 'relative',
        background: '#FAFAFA',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -32,
        padding: '32px 24px',
        minHeight: 500,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
      }}>
        {/* Header Info */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 32, fontWeight: 900, color: '#111', letterSpacing: '-1px', lineHeight: 1.1 }}>
            {affiliate.name}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#E91E63', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
            {affiliate.category}
          </p>
        </div>

        {/* Action Quick Links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 32 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ background: '#FFF0F5', padding: 10, borderRadius: 16, color: '#E91E63' }}><Navigation size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Llegar</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ background: '#FFF5F0', padding: 10, borderRadius: 16, color: '#F97316' }}><MessageCircle size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Mensaje</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ background: '#F0F4FF', padding: 10, borderRadius: 16, color: '#3B82F6' }}><Phone size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Llamar</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ background: '#F0FFF4', padding: 10, borderRadius: 16, color: '#10B981' }}><Globe size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Web</span>
          </div>
        </div>

        {/* Details Section */}
        <div style={{ background: '#fff', borderRadius: 24, padding: 20, border: '1px solid #F0F0F0', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 16 }}>Detalles</h3>
          
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <MapPin size={20} color="#999" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 2px 0', fontSize: 14, fontWeight: 700, color: '#111' }}>{affiliate.address}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>A {affiliate.distance} de ti</p>
            </div>
          </div>
          
          <div style={{ height: 1, background: '#F5F5F5', margin: '16px 0' }} />
          
          <div style={{ display: 'flex', gap: 16 }}>
            <Clock size={20} color="#999" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 2px 0', fontSize: 14, fontWeight: 700, color: '#111' }}>Horario de atención</p>
              <p style={{ margin: 0, fontSize: 13, color: '#10B981', fontWeight: 600 }}>Abierto • {affiliate.hours}</p>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div style={{ background: '#fff', borderRadius: 24, padding: 20, border: '1px solid #F0F0F0', marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#111', marginBottom: 12 }}>Acerca de</h3>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, margin: 0 }}>
            {affiliate.description}
          </p>
        </div>
      </div>

      {/* Floating Bottom Action */}
      <div style={{
        position: 'fixed', bottom: 85, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(255,255,255,1) 30%, rgba(255,255,255,0.9) 80%, rgba(255,255,255,0))',
        padding: '32px 24px 16px',
        zIndex: 90,
        pointerEvents: 'none' // The wrapper is invisible to clicks
      }}>
        <button style={{
          width: '100%',
          background: '#111', color: '#fff',
          padding: 20, borderRadius: 24,
          border: 'none',
          fontSize: 16, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          pointerEvents: 'auto' // Button is clickable
        }}>
          <Tag size={20} />
          Escanear ticket y ganar +{affiliate.reward}%
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
      `}} />
      <BottomNav />
    </div>
  );
}
