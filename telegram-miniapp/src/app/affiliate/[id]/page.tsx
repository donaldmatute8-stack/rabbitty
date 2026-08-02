'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, MapPin, Clock, Tag, Navigation, Phone, Globe, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { useToast } from '@/contexts/ToastContext';

export default function AffiliateProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { showToast } = useToast();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      <div style={{ background: '#FAFAFA', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #f3f3f3', borderTopColor: '#E91E63', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div style={{ background: '#FAFAFA', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#888', fontWeight: 600 }}>Negocio no encontrado.</p>
      </div>
    );
  }

  // Dynamic Modals State
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showInAppBrowser, setShowInAppBrowser] = useState(false);

  // Parse gallery safely
  let parsedGallery = [];
  try { parsedGallery = affiliate.gallery ? JSON.parse(affiliate.gallery) : []; } catch(e){}
  const coverImage = parsedGallery.length > 0 ? parsedGallery[0] : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80';

  const targetWebsite = affiliate.website || affiliate.webUrl || 'https://rabbitty.me';
  const formattedWebUrl = targetWebsite.startsWith('http') ? targetWebsite : `https://${targetWebsite}`;

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100vh', paddingBottom: 180, position: 'relative' }}>
      {/* Floating Dynamic Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: isScrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled ? '1px solid #F0F0F0' : 'none',
        transition: 'all 0.3s ease',
        paddingTop: 'calc(max(env(safe-area-inset-top), 84px) + 8px)',
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
        <img src={coverImage} alt={affiliate.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowMapSelector(true)}
            style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer' }}
          >
            <div style={{ background: '#FFF0F5', padding: 10, borderRadius: 16, color: '#E91E63' }}><Navigation size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Llegar</span>
          </motion.div>

          <Link href={`/chat/${affiliate.id}`} style={{ textDecoration: 'none' }}>
            <motion.div whileTap={{ scale: 0.95 }} style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ background: '#FFF5F0', padding: 10, borderRadius: 16, color: '#F97316' }}><MessageCircle size={20} /></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Mensaje</span>
            </motion.div>
          </Link>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (affiliate.phone || affiliate.owner?.phoneNumber) {
                window.location.href = `tel:${affiliate.phone || affiliate.owner.phoneNumber}`;
              } else {
                showToast('Número telefónico no disponible', 'info');
              }
            }}
            style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer' }}
          >
            <div style={{ background: '#F0F4FF', padding: 10, borderRadius: 16, color: '#3B82F6' }}><Phone size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Llamar</span>
          </motion.div>

          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowInAppBrowser(true)}
            style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1px solid #F0F0F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer' }}
          >
            <div style={{ background: '#F0FFF4', padding: 10, borderRadius: 16, color: '#10B981' }}><Globe size={20} /></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', textAlign: 'center' }}>Web</span>
          </motion.div>
        </div>

        {/* Info Grid */}
        <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #F0F0F0', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexShrink: 0 }}>
              <MapPin size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>{affiliate.address}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#888', marginTop: 2 }}>A {affiliate.distance || '1.0km'} de ti</p>
            </div>
          </div>
          
          <div style={{ height: 1, background: '#F5F5F5', margin: '0 -20px 16px -20px' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: '#F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexShrink: 0 }}>
              <Clock size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                Abierto Ahora <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50' }} />
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#888', marginTop: 2 }}>
                {affiliate.startTime} - {affiliate.endTime}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Rewards Schedule */}
        <div style={{ background: 'linear-gradient(135deg, rgba(233,30,99,0.05) 0%, rgba(173,20,87,0.05) 100%)', borderRadius: 24, padding: 20, border: '1px solid rgba(233,30,99,0.1)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 900, color: '#E91E63', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag size={18} /> Happy Hour de Bunz
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: '#666', lineHeight: 1.5, fontWeight: 500 }}>
            Escanea tu ticket durante estas horas para llevarte el <strong>+{affiliate.rewardPercentage}%</strong> del valor de tu compra en Bunz.
          </p>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: '#E91E63', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 100 }}>{affiliate.startTime} a {affiliate.endTime}</span>
          </div>
        </div>

        {/* Gallery Slider (New Feature) */}
        {parsedGallery.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 900, color: '#111' }}>Galería</h3>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, margin: '0 -20px', padding: '0 20px' }} className="scrollbar-hide">
              {parsedGallery.map((img: string, i: number) => (
                <div key={i} style={{ width: 200, height: 140, borderRadius: 20, overflow: 'hidden', flexShrink: 0, border: '1px solid #F0F0F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                  <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Gallery ${i}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* About */}
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 900, color: '#111' }}>Acerca de</h3>
          <p style={{ margin: 0, fontSize: 15, color: '#666', lineHeight: 1.6 }}>
            {affiliate.description || 'Este negocio no ha agregado una descripción todavía.'}
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
        <button 
          onClick={async () => {
            try {
              const mod = await import('@twa-dev/sdk');
              const app = mod.default;
              
              const processScan = async (fiatAmount: number) => {
                try {
                  const res = await fetch('/api/transaction/spend', { // Registra ticket de consumo y mint de Bunz
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      initData: app.initData, 
                      businessId: affiliate.id,
                      fiatAmount
                    })
                  });
                  
                  const data = await res.json();
                  if (data.success) {
                    if (app.closeScanQrPopup) {
                      try { app.closeScanQrPopup(); } catch(e) {}
                    }
                    showToast(`¡Felicidades! Acabas de ganar +${data.bunzEarned} Bunz.`, 'success');
                  } else {
                    showToast(`Ticket Rechazado: ${data.error}`, 'error');
                  }
                } catch (e) {
                  showToast("Error al procesar el ticket.", 'error');
                }
              };

              try {
                app.showScanQrPopup({ text: "Escanea tu ticket de compra" }, (qrText: string) => {
                  const parsed = parseInt(qrText, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    processScan(parsed);
                  } else {
                    showToast('Código QR inválido. Escanea el ticket de compra.', 'error');
                  }
                  return true;
                });
              } catch (e) {
                console.warn("QR Scanner not supported, falling back to mock input");
                const mockAmount = window.prompt(`Escáner no soportado. Ingresa el monto de tu consumo en ${affiliate.name}:`);
                if (mockAmount) {
                  const parsed = parseInt(mockAmount, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    processScan(parsed);
                  } else {
                    showToast('Monto inválido.', 'error');
                  }
                }
              }
            } catch (err) {
              console.error(err);
            }
          }}
          style={{
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
          Escanear ticket y ganar +{affiliate.rewardPercentage}%
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

      {/* MODAL: Visor Web In-App (Estilo Instagram) */}
      {showInAppBrowser && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#05020A', display: 'flex', flexDirection: 'column' }}>
          {/* Header del Visor In-App */}
          <div style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 50px) + 8px)', paddingBottom: 12, paddingLeft: 16, paddingRight: 16, background: '#110720', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
