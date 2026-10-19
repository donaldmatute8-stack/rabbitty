'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Clock, Tag, Navigation, Globe, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';

interface AffiliateData {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  startTime?: string;
  endTime?: string;
  rewardPercentage: number;
  description?: string;
  gallery?: string;
  website?: string;
  webUrl?: string;
  supportWhatsApp?: string;
  phone?: string;
  lat?: number | string;
  lng?: number | string;
  owner?: { phoneNumber?: string };
}

export default function AffiliateProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showInAppBrowser, setShowInAppBrowser] = useState(false);
  const [showMessageSelector, setShowMessageSelector] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/business/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.business) {
          setAffiliate(data.business);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Scroll effect for header
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 150);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) {
    return (
      <div style={{ background: '#0D0D15', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#E91E63', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div style={{ background: '#0D0D15', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Negocio no encontrado.</p>
      </div>
    );
  }

  // Parse gallery safely
  let parsedGallery: string[] = [];
  try { parsedGallery = affiliate.gallery ? JSON.parse(affiliate.gallery) : []; } catch { /* ignore parse error */ }
  const coverImage = parsedGallery.length > 0 ? parsedGallery[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80';

  const targetWebsite = affiliate.website || affiliate.webUrl || 'https://rabbitty.me';
  const formattedWebUrl = targetWebsite.startsWith('http') ? targetWebsite : `https://${targetWebsite}`;

  return (
    <div style={{ background: '#0D0D15', minHeight: '100vh', paddingBottom: 180, position: 'relative' }}>
      {/* Floating Dynamic Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        paddingTop: 'calc(max(var(--safe-top, 0px), env(safe-area-inset-top, 0px)) + 12px)',
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        pointerEvents: 'none',
      }}>
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(20, 20, 26, 0.75)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'auto',
          }}
          className="active:scale-90 transition-transform"
          aria-label="Volver atrás"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Central Floating Pill (Screenshot 1: solo el pill central con nombre del negocio + su categoría) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: isScrolled ? 1 : 0, y: isScrolled ? 0 : -10 }}
          transition={{ duration: 0.25 }}
          style={{
            background: 'rgba(24, 24, 32, 0.88)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '6px 16px',
            borderRadius: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            maxWidth: '65%',
            pointerEvents: 'auto',
          }}
        >
          <span style={{ fontWeight: 900, fontSize: 14, color: '#fff', lineHeight: 1.15, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
            {affiliate.name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#E91E63', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 1 }}>
            {affiliate.category || 'Negocio'}
          </span>
        </motion.div>

        <div style={{ width: 42 }} /> {/* Spacer to preserve center balance */}
      </div>

      {/* Hero Image */}
      <div style={{ position: 'relative', width: '100%', height: 340 }}>
        <Image src={coverImage} alt={affiliate.name} fill unoptimized priority style={{ objectFit: 'cover' }} />
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
            <span style={{ fontWeight: 900, fontSize: 18 }}>+{affiliate.rewardPercentage}%</span>
            <span style={{ fontWeight: 700, fontSize: 12 }}>BUNZ</span>
          </motion.div>
        </div>
      </div>

      {/* Content Card (Overlaps Image) */}
      <div style={{
        position: 'relative',
        background: '#0D0D15',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -32,
        padding: '32px 24px 120px',
        minHeight: 500,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottom: 'none'
      }}>
        {/* Header Info */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: 30, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-1px', lineHeight: 1.1 }}>
            {affiliate.name}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#E91E63', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
            {affiliate.category}
          </p>
        </div>

        {/* Action Quick Links */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMapSelector(true)}
            style={{ background: '#161622', borderRadius: 20, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer' }}
          >
            <div style={{ background: 'rgba(233,30,99,0.15)', padding: 10, borderRadius: 16, color: '#E91E63' }}><Navigation size={20} /></div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', textAlign: 'center' }}>Llegar</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMessageSelector(true)}
            style={{ background: '#161622', borderRadius: 20, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer' }}
          >
            <div style={{ background: 'rgba(249,115,22,0.15)', padding: 10, borderRadius: 16, color: '#F97316' }}><MessageCircle size={20} /></div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', textAlign: 'center' }}>Mensaje</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowInAppBrowser(true)}
            style={{ background: '#161622', borderRadius: 20, padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer' }}
          >
            <div style={{ background: 'rgba(16,185,129,0.15)', padding: 10, borderRadius: 16, color: '#10B981' }}><Globe size={20} /></div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', textAlign: 'center' }}>Web</span>
          </motion.div>
        </div>

        {/* Info Grid */}
        <div style={{ background: '#161622', borderRadius: 24, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E91E63', flexShrink: 0 }}>
              <MapPin size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#FFFFFF' }}>{affiliate.address}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>A {affiliate.distance || '1.0km'} de ti</p>
            </div>
          </div>
          
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 -20px 16px -20px' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', flexShrink: 0 }}>
              <Clock size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                Abierto Ahora <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} />
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {affiliate.startTime} - {affiliate.endTime}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Rewards Schedule */}
        <div style={{ background: 'linear-gradient(135deg, rgba(233,30,99,0.12) 0%, rgba(173,20,87,0.08) 100%)', borderRadius: 24, padding: 20, border: '1px solid rgba(233,30,99,0.25)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 16, fontWeight: 900, color: '#FF4081', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={18} /> Happy Hour de Bunz
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, fontWeight: 500 }}>
            Escanea tu ticket durante estas horas para llevarte el <strong>+{affiliate.rewardPercentage}%</strong> del valor de tu compra en Bunz.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: '#E91E63', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 100 }}>{affiliate.startTime} a {affiliate.endTime}</span>
          </div>
        </div>

        {/* Gallery Slider */}
        {parsedGallery.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>Galería</h3>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, margin: '0 -20px', padding: '0 20px' }} className="scrollbar-hide">
              {parsedGallery.map((img: string, i: number) => (
                <div key={i} style={{ position: 'relative', width: 200, height: 140, borderRadius: 20, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <Image src={img} fill unoptimized style={{ objectFit: 'cover' }} alt={`Gallery ${i}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>Acerca de</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            {affiliate.description || 'Este negocio no ha agregado una descripción todavía.'}
          </p>
        </div>
      </div>

      {/* Floating Bottom Action (above BottomNav) */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 12px) + 72px)',
        left: 0, right: 0,
        padding: '0 20px',
        zIndex: 90,
        pointerEvents: 'none'
      }}>
        <button 
          onClick={() => {
            PlatformBridge.hapticFeedback('medium');
            router.push('/scan');
          }}
          style={{
            width: '100%',
            maxWidth: 500,
            margin: '0 auto',
            background: 'linear-gradient(135deg, #E91E63 0%, #FF4081 100%)',
            color: '#fff',
            padding: '16px 20px', borderRadius: 22,
            border: 'none',
            fontSize: 15, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 8px 28px rgba(233,30,99,0.4)',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}>
          <Tag size={18} />
          Escanear en caja y ganar +{affiliate.rewardPercentage}%
        </button>
      </div>

      {/* MODAL: Selector de Aplicación de Mapa */}
      {showMapSelector && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end' }}>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            style={{ width: '100%', background: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 900 }}>🗺️ ¿Cómo quieres llegar?</h3>
              <button onClick={() => setShowMapSelector(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                  setShowMapSelector(false);
                }}
                style={{ background: '#1E1E24', color: '#fff', padding: '16px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                🗺️ Abrir en Google Maps
              </button>

              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
                  setShowMapSelector(false);
                }}
                style={{ background: '#1E1E24', color: '#fff', padding: '16px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                🚗 Abrir en Waze
              </button>

              <button
                onClick={() => {
                  const query = encodeURIComponent(`${affiliate.name} ${affiliate.address || ''}`);
                  window.open(`http://maps.apple.com/?q=${query}`, '_blank');
                  setShowMapSelector(false);
                }}
                style={{ background: '#1E1E24', color: '#fff', padding: '16px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                🍎 Abrir en Apple Maps
              </button>

              <button
                onClick={() => {
                  router.push(`/map?lat=${affiliate.lat || 19.4326}&lng=${affiliate.lng || -99.1332}`);
                  setShowMapSelector(false);
                }}
                style={{ background: 'linear-gradient(135deg, #E91E63, #8B5CF6)', color: '#fff', padding: '16px', borderRadius: 18, border: 'none', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', marginTop: 4 }}
              >
                🚀 Ver en Mapa Neón Rabbitty
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Selector de Mensaje (In-App vs WhatsApp) */}
      {showMessageSelector && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <motion.div 
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ background: '#161622', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: '24px 20px 40px', width: '100%', maxWidth: 500, border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#fff' }}>Enviar mensaje</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Elige cómo comunicarte con {affiliate.name}</p>
              </div>
              <button onClick={() => setShowMessageSelector(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  setShowMessageSelector(false);
                  router.push(`/chat/${affiliate.id}`);
                }}
                style={{ background: 'linear-gradient(135deg, #E91E63 0%, #FF4081 100%)', color: '#fff', padding: '16px', borderRadius: 20, border: 'none', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: '0 8px 24px rgba(233,30,99,0.3)' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>Chat In-App Rabbitty</div>
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>Chatea directamente con el negocio dentro de la app</div>
                </div>
              </button>

              <button
                onClick={() => {
                  PlatformBridge.hapticFeedback('medium');
                  setShowMessageSelector(false);
                  const phone = affiliate.supportWhatsApp || affiliate.phone || affiliate.owner?.phoneNumber;
                  if (phone) {
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    const text = encodeURIComponent(`¡Hola ${affiliate.name}! Vi su perfil en Rabbitty y me gustaría información.`);
                    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                  } else {
                    showToast('WhatsApp directo no configurado por el comercio', 'info');
                  }
                }}
                style={{ background: '#25D366', color: '#fff', padding: '16px', borderRadius: 20, border: 'none', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: '0 8px 24px rgba(37,211,102,0.3)' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📱</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>WhatsApp Oficial</div>
                  <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>Abrir conversación en WhatsApp</div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Visor Web In-App (Estilo Instagram) */}
      {showInAppBrowser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#05020A', display: 'flex', flexDirection: 'column' }}>
          {/* Header del Visor In-App */}
          <div style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 56px)', paddingBottom: 12, paddingLeft: 16, paddingRight: 16, background: '#110720', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setShowInAppBrowser(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontWeight: 800 }}>✕</button>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>{affiliate.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#A855F7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{formattedWebUrl}</p>
              </div>
            </div>
            <button
              onClick={() => window.open(formattedWebUrl, '_blank')}
              style={{ background: '#E91E63', color: '#fff', padding: '6px 14px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              Abrir en Safari/Chrome
            </button>
          </div>

          {/* Iframe Contenido Web */}
          <iframe
            src={formattedWebUrl}
            style={{ width: '100%', flex: 1, border: 'none', background: '#fff' }}
            title={`Web de ${affiliate.name}`}
          />
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
      `}} />
      <BottomNav />
    </div>
  );
}
