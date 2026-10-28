'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, MapPin, Percent, UploadCloud, ChevronRight, ChevronLeft, HelpCircle, ShieldCheck, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BunzGuide from './BunzGuide';

const NICHE_WELCOME_RANGES: Record<string, { label: string; min: number; max: number }> = {
  'Cafetería': { label: 'Cafetería / Specialty Coffee', min: 25, max: 35 },
  'Restaurante': { label: 'Restaurante Casual / Bistró', min: 25, max: 50 },
  'Restaurante Gourmet': { label: 'Restaurante Gourmet / Gran Capacidad', min: 50, max: 100 },
  'Bar': { label: 'Bar / Mixología / Taproom', min: 25, max: 50 },
  'Tienda de Ropa': { label: 'Retail / Moda / Boutique', min: 35, max: 75 },
  'Servicios de Salud': { label: 'Salud / Clínica / Consultorio', min: 50, max: 100 },
  'Belleza y Spa': { label: 'Belleza / Barbería / Spa', min: 25, max: 50 },
  'Gimnasio': { label: 'Gimnasio / Fitness Studio', min: 30, max: 60 },
  'Educación': { label: 'Educación / Academia / Cursos', min: 25, max: 50 },
  'Servicios Digitales': { label: 'Servicios Digitales / E-Commerce', min: 25, max: 40 },
  'Otro': { label: 'Comercio General Afiliado', min: 25, max: 50 },
};

function getClientNicheRule(category: string) {
  const info = NICHE_WELCOME_RANGES[category] || NICHE_WELCOME_RANGES['Cafetería'];
  const totalBunz = 25; // Base homologada actual para todos los nichos
  const affiliateSharePct = 60;
  const treasurySharePct = 40;
  const affiliateBunz = 15;
  const treasuryBunz = 10;
  return {
    nicheLabel: info.label,
    totalBunz,
    affiliateSharePct,
    treasurySharePct,
    affiliateBunz,
    treasuryBunz,
    recommendedFutureMin: info.min,
    recommendedFutureMax: info.max,
    rule: { baseBunz: totalBunz, affiliateSplitPct: affiliateSharePct, treasurySplitPct: treasurySharePct },
  };
}

interface BusinessSetupFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
}

const PACKAGES = [
  { id: 'Starter', credit: 10000, label: 'Starter', price: '$10,000', desc: 'Para negocios pequeños y cafés', icon: '☕', color: '#3B82F6' },
  { id: 'Growth', credit: 20000, label: 'Growth', price: '$20,000', desc: 'Para restaurantes medianos', icon: '🍽️', color: '#8B5CF6' },
  { id: 'Pro', credit: 50000, label: 'Pro', price: '$50,000', desc: 'Para cadenas y gimnasios', icon: '🏪', color: '#F59E0B' },
  { id: 'Enterprise', credit: 100000, label: 'Enterprise', price: '$100,000', desc: 'Para grandes retailers', icon: '🏢', color: '#E91E63' },
];

export default function BusinessSetupForm({ onSubmit, isLoading }: BusinessSetupFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = Welcome, 1 = Basic Info, 2 = Rewards, 3 = Package, 4 = Confirm
  const [error, setError] = useState('');

  // Step 1
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');

  // Step 2
  const [rewardPercentage, setRewardPercentage] = useState(15);
  const [logoBase64, setLogoBase64] = useState('');

  // Step 3
  const [selectedPackage, setSelectedPackage] = useState('Starter');

  // Step 4: Digital Contract Signature & Split Acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCollateral, setAcceptedCollateral] = useState(false);
  const [acceptedSplitClause, setAcceptedSplitClause] = useState(false);
  const [legalSignerName, setLegalSignerName] = useState('');

  const [showBunzGuide, setShowBunzGuide] = useState(false);
  const nicheWelcomeInfo = getClientNicheRule(category || 'Cafetería');
  const nicheRule = nicheWelcomeInfo;

  const THEME_COLOR = "#E91E63";
  const THEME_GRADIENT = "linear-gradient(135deg, #E91E63 0%, #D81B60 100%)";

  // Step 1 additions
  const [isVirtual, setIsVirtual] = useState(false);
  const [locating, setLocating] = useState(false);
  const [googleClaimed, setGoogleClaimed] = useState(false);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setAddress('Avenida Principal 123, Monterrey');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const data = await res.json();
          setAddress(data.display_name || `${pos.coords.latitude}, ${pos.coords.longitude}`);
        } catch {
          setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
        setLocating(false);
      },
      () => {
        setAddress('Avenida Principal 123, Monterrey');
        setLocating(false);
      }
    );
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen no debe pesar más de 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const nextStep = () => {
    if (step === 1 && (!name || !category || (!isVirtual && !address))) {
      setError("Por favor completa todos los campos requeridos.");
      return;
    }
    if (step === 2 && rewardPercentage < 2) {
      setError("La recompensa mínima es 2%.");
      return;
    }
    if (step === 3) {
      // Package is optional, no validation needed
    }
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = () => {
    if (!acceptedTerms || !acceptedCollateral || !acceptedSplitClause || legalSignerName.trim().length < 3) {
      setError('Debes aceptar todas las cláusulas legales y firmar con tu nombre completo.');
      return;
    }
    const pkg = PACKAGES.find(p => p.id === selectedPackage);
    onSubmit({
      name,
      category,
      address: isVirtual ? 'Negocio Virtual' : address,
      rewardPercentage,
      gallery: logoBase64 ? [logoBase64] : [],
      description: "Negocio afiliado de Rabbitty.",
      activeDays: [1,2,3,4,5,6,7],
      startTime: "09:00",
      endTime: "21:00",
      package: selectedPackage || 'Starter',
      creditLimit: pkg?.credit || 10000,
      googleClaimed,
      contractSignature: {
        signedBy: legalSignerName.trim(),
        signedAt: new Date().toISOString(),
        termsVersion: '2026.10-v2',
        acceptedTerms: true,
        acceptedCollateral: true,
        acceptedSplitClause: true,
        nicheCategory: category,
        nicheWelcomeBaseBunz: nicheWelcomeInfo.rule.baseBunz,
        affiliateSplitPct: nicheWelcomeInfo.rule.affiliateSplitPct,
        treasurySplitPct: nicheWelcomeInfo.rule.treasurySplitPct,
        affiliateSplitBunz: nicheWelcomeInfo.affiliateBunz,
        treasurySplitBunz: nicheWelcomeInfo.treasuryBunz,
        selectedPackage: selectedPackage || 'Starter',
        creditLimit: pkg?.credit || 10000,
      },
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111', color: '#fff', zIndex: 100, display: 'flex', flexDirection: 'column', fontFamily: "var(--font-family-base)", overflowY: 'auto' }}>
      
      {/* Dynamic Header for steps > 0 */}
      {step > 0 && (
        <div style={{ padding: 'calc(max(var(--safe-top, 0px), 50px) + 56px) 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <button onClick={() => setStep(s => s - 1)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: 40, height: 40, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? THEME_COLOR : 'rgba(255,255,255,0.2)', transition: 'all 0.3s' }} />
            ))}
          </div>
          <div style={{ width: 40 }} /> {/* Spacer */}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px', justifyContent: step === 0 ? 'center' : 'flex-start', paddingTop: step === 0 ? 0 : 20 }}>
        <AnimatePresence mode="wait">
          
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ textAlign: 'center', position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <button 
                onClick={() => router.back()} 
                style={{ position: 'absolute', top: 'calc(max(var(--safe-top, 0px), 50px) + 48px)', left: 0, background: 'rgba(255,255,255,0.1)', border: 'none', width: 40, height: 40, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ChevronLeft size={20} />
              </button>

              <button
                onClick={() => setShowBunzGuide(true)}
                style={{ position: 'absolute', top: 'calc(max(var(--safe-top, 0px), 50px) + 48px)', right: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 999, color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <HelpCircle size={14} /> ¿Cómo funciona?
              </button>
              
              <div style={{ width: 100, height: 100, background: 'rgba(233,30,99,0.1)', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', border: '1px solid rgba(233,30,99,0.3)' }}>
                <Store size={48} color={THEME_COLOR} />
              </div>
              <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 16, lineHeight: 1.1, letterSpacing: '-1px' }}>
                Atrae clientes<br/>con <span style={{ color: THEME_COLOR }}>Rabbitty</span>
              </h1>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 48, lineHeight: 1.5 }}>
                Afilia tu negocio, ofrece recompensas en Bunz y aumenta tus ventas diarias. Sin comisiones ocultas.
              </p>
              <button 
                onClick={nextStep}
                style={{ width: '100%', padding: '18px', background: THEME_GRADIENT, color: '#fff', border: 'none', borderRadius: 999, fontSize: 18, fontWeight: 900, boxShadow: '0 8px 32px rgba(249,115,22,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                Comenzar Registro <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Datos del Negocio</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>¿Cómo te van a encontrar los clientes?</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Nombre Comercial</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Café Cultura" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: 16, color: '#fff', fontSize: 16, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Categoría</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: 16, color: category ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16, outline: 'none', appearance: 'none' }}>
                    <option value="" disabled>Selecciona una categoría...</option>
                    <option value="Restaurante">Restaurante</option>
                    <option value="Restaurante Gourmet">Restaurante Gourmet / Gran Capacidad</option>
                    <option value="Cafetería">Cafetería</option>
                    <option value="Bar">Bar</option>
                    <option value="Tienda de Ropa">Tienda de Ropa</option>
                    <option value="Servicios de Salud">Servicios de Salud</option>
                    <option value="Belleza y Spa">Belleza y Spa</option>
                    <option value="Gimnasio">Gimnasio</option>
                    <option value="Educación">Educación</option>
                    <option value="Servicios Digitales">Servicios Digitales</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <input type="checkbox" id="isVirtual" checked={isVirtual} onChange={e => setIsVirtual(e.target.checked)} style={{ width: 20, height: 20, accentColor: THEME_COLOR }} />
                  <label htmlFor="isVirtual" style={{ fontSize: 14, color: '#fff', fontWeight: 600, cursor: 'pointer', flex: 1 }}>Este es un Negocio Virtual (Sin local físico)</label>
                </div>

                {!isVirtual && (
                  <div>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Dirección Física</span>
                      <button onClick={handleUseLocation} style={{ background: 'none', border: 'none', color: THEME_COLOR, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <MapPin size={12} /> {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}
                      </button>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <MapPin size={20} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                      <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle, Número, Ciudad" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px 16px 48px', borderRadius: 16, color: '#fff', fontSize: 16, outline: 'none' }} />
                    </div>
                  </div>
                )}

                <div style={{ padding: '16px', background: googleClaimed ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.02)', borderRadius: 16, border: googleClaimed ? '1px solid rgba(34,197,94,0.3)' : '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>Vincular Google Business</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: googleClaimed ? '#4ade80' : 'rgba(255,255,255,0.5)' }}>
                      {googleClaimed ? '✓ Verificación instantánea activada' : 'Verifica tu negocio al instante con Google'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setGoogleClaimed(!googleClaimed)} 
                    type="button"
                    style={{ 
                      background: googleClaimed ? '#22c55e' : 'rgba(255,255,255,0.1)', 
                      color: googleClaimed ? '#000' : '#fff', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: 999, 
                      fontSize: 12, 
                      fontWeight: 900,
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    {googleClaimed ? '✓ Verificado' : 'Vincular'}
                  </button>
                </div>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 14, marginTop: 16 }}>{error}</p>}

              <button onClick={nextStep} style={{ width: '100%', padding: '16px', background: name && category && (isVirtual || address) ? THEME_GRADIENT : 'rgba(255,255,255,0.1)', color: name && category && (isVirtual || address) ? '#fff' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 900, marginTop: 40, transition: 'all 0.3s' }}>
                Continuar
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Recompensas</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Configura cuánto valor retornarás a tus clientes.</p>
              
              <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 24, padding: 24, marginBottom: 32, textAlign: 'center' }}>
                <Percent size={32} color={THEME_COLOR} style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 48, fontWeight: 900, color: THEME_COLOR, margin: '0 0 8px 0', lineHeight: 1 }}>{rewardPercentage}%</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>del consumo regresado en Bunz</p>
                
                {(() => {
                  let rarityLabel = "COMÚN 🔵";
                  let rarityColor = "#3B82F6"; 
                  if (rewardPercentage >= 15) { rarityLabel = "LEGENDARIO 🟡"; rarityColor = "#F59E0B"; } 
                  else if (rewardPercentage >= 10) { rarityLabel = "ÉPICO 🔴"; rarityColor = "#EF4444"; } 
                  else if (rewardPercentage >= 5) { rarityLabel = "RARO 🟣"; rarityColor = "#8B5CF6"; } 

                  return (
                    <div style={{ marginTop: 12, display: 'inline-block', padding: '6px 16px', background: `${rarityColor}20`, color: rarityColor, borderRadius: 999, fontSize: 12, fontWeight: 900, border: `1px solid ${rarityColor}40`, letterSpacing: 1 }}>
                      {rarityLabel}
                    </div>
                  );
                })()}
                
                <input 
                  type="range" min="2" max="50" step="1" value={rewardPercentage} onChange={e => setRewardPercentage(Number(e.target.value))}
                  style={{ width: '100%', marginTop: 24, accentColor: THEME_COLOR }}
                />
              </div>

              <div style={{ marginBottom: 32 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Logo del Negocio (Opcional)</label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 20, background: 'rgba(255,255,255,0.02)', cursor: 'pointer', overflow: 'hidden' }}>
                  {logoBase64 ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoBase64} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <UploadCloud size={24} color="rgba(255,255,255,0.4)" style={{ marginBottom: 8 }} />
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Toca para subir</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 14, marginTop: 16 }}>{error}</p>}

              <button onClick={nextStep} style={{ width: '100%', padding: '16px', background: THEME_GRADIENT, color: '#fff', border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 900, marginTop: 16 }}>
                Continuar
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Elige tu Paquete</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Define el crédito de minting para tu negocio.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => setSelectedPackage('')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                    background: !selectedPackage ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: !selectedPackage ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s', textAlign: 'left', opacity: !selectedPackage ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 28, opacity: 0.6 }}>🚫</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: !selectedPackage ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      Sin paquete (Recomendado)
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      Crédito de minting sin límite
                    </p>
                  </div>
                </button>

                {PACKAGES.map(pkg => {
                  const selected = selectedPackage === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                        padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                        background: selected ? `${pkg.color}20` : 'rgba(255,255,255,0.05)',
                        border: selected ? `2px solid ${pkg.color}` : '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.2s', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 32 }}>{pkg.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{pkg.label}</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: pkg.color }}>{pkg.price}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{pkg.desc}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Crédito: {pkg.credit.toLocaleString()} Bunz</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(233,30,99,0.08)', borderRadius: 12, border: '1px solid rgba(233,30,99,0.15)' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  💡 El crédito de minting define el límite de Bunz que puedes regalar a tus clientes. 
                  A mayor paquete, más recompensas puedes ofrecer sin costo adicional.
                </p>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 14, marginTop: 16 }}>{error}</p>}

              <button onClick={nextStep} style={{ width: '100%', padding: '16px', background: selectedPackage ? THEME_GRADIENT : 'rgba(255,255,255,0.1)', color: selectedPackage ? '#fff' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 900, marginTop: 24 }}>
                Continuar
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'left', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, background: 'rgba(16,185,129,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={26} color="#10B981" />
                </div>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Firma Digital & Garantía</h2>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '2px 0 0' }}>
                    Revisa tu configuración y firma el contrato de adhesión de afiliado.
                  </p>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>{name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: THEME_COLOR, fontWeight: 700 }}>{category}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: 'rgba(233,30,99,0.15)', color: THEME_COLOR, border: '1px solid rgba(233,30,99,0.3)' }}>
                    {selectedPackage ? `Paquete ${selectedPackage.toUpperCase()}` : 'Sin Paquete'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} color="rgba(255,255,255,0.4)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{isVirtual ? 'Negocio Virtual' : address}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Percent size={14} color="rgba(255,255,255,0.4)" />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{rewardPercentage}% Recompensa</span>
                  </div>
                </div>
              </div>

              {/* Tarjeta de Split Dinámico por Nicho */}
              <div style={{ background: 'linear-gradient(135deg, rgba(233,30,99,0.12), rgba(249,115,22,0.08))', borderRadius: 20, padding: 16, marginBottom: 16, border: '1px solid rgba(233,30,99,0.28)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#F472B6', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    ⚡ Split de Bienvenida por Nicho ({nicheRule.nicheLabel})
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', background: 'rgba(0,0,0,0.35)', padding: '3px 10px', borderRadius: 999 }}>
                    +{nicheRule.totalBunz} Bunz / nuevo cliente
                  </span>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45 }}>
                  Cuando un cliente nuevo descargue Rabbitty escaneando el QR oficial de tu negocio, recibirá <strong>{nicheRule.totalBunz} Bunz</strong> financiados en co-inversión triangular:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700 }}>Aporte de tu Paquete ({nicheRule.affiliateSharePct}%)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 900, color: '#FBBF24' }}>{nicheRule.affiliateBunz} Bunz</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700 }}>Subsidio Tesorería ({nicheRule.treasurySharePct}%)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 900, color: '#34D399' }}>{nicheRule.treasuryBunz} Bunz</p>
                  </div>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
                  * Base actual homologada en {nicheRule.totalBunz} Bunz para todos los nichos (rango proyectado para {nicheRule.nicheLabel}: {nicheRule.recommendedFutureMin}–{nicheRule.recommendedFutureMax} Bunz según volumen y ticket promedio).
                </p>
              </div>

              {/* Resumen del Contrato Legal */}
              <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 14, maxHeight: 150, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} color={THEME_COLOR} /> CONTRATO DIGITAL DE COLATERAL Y SPLIT DE ADQUISICIÓN (v2.0)
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>1. Garantía Comercial Real:</strong> El Afiliado respalda el paquete de emisión seleccionado ({selectedPackage ? `${selectedPackage.toUpperCase()} — ${(PACKAGES.find(p => p.id === selectedPackage)?.credit || 0).toLocaleString()} Bunz` : 'Emisión Abierta'}) con sus productos y servicios reales a valor de menú público, sin inflar precios ni condicionar el canje de Bunz.
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>2. Cláusula de Co-Inversión y Split Dinámico por Nicho:</strong> Por cada nuevo usuario registrado mediante los códigos QR del Afiliado, el Bono de Bienvenida ({nicheRule.totalBunz} Bunz base) se cubrirá en un <strong>{nicheRule.affiliateSharePct}% ({nicheRule.affiliateBunz} Bunz)</strong> con cargo al paquete de emisión del Afiliado y en un <strong>{nicheRule.treasurySharePct}% ({nicheRule.treasuryBunz} Bunz)</strong> por la Tesorería de Rabbitty.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>3. Liquidación y Auditoría:</strong> Toda emisión queda registrada en el libro mayor inmutable de Rabbitty. En caso de negativa de canje injustificada, Rabbitty podrá suspender la cuenta comercial y exigir la redención de los saldos emitidos.
                </p>
              </div>

              {/* Checkboxes obligatorios */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, accentColor: THEME_COLOR, flexShrink: 0 }} />
                  <span>Acepto los Términos y Condiciones de Afiliación Comercial y las políticas de canje a paridad real de menú.</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={acceptedCollateral} onChange={e => setAcceptedCollateral(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, accentColor: THEME_COLOR, flexShrink: 0 }} />
                  <span>Pongo en garantía comercial los productos/servicios de <strong>{name || 'mi negocio'}</strong> para respaldar los Bunz emitidos en mi paquete.</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={acceptedSplitClause} onChange={e => setAcceptedSplitClause(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, accentColor: THEME_COLOR, flexShrink: 0 }} />
                  <span>Autorizo el <strong>Split Triangular por Nicho ({nicheRule.affiliateBunz} Bunz Afiliado / {nicheRule.treasuryBunz} Bunz Rabbitty)</strong> por cada nuevo cliente captado vía QR de bienvenida.</span>
                </label>
              </div>

              {/* Firma Digital */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Firma Digital del Representante Legal / Titular
                </label>
                <input
                  type="text"
                  value={legalSignerName}
                  onChange={e => setLegalSignerName(e.target.value)}
                  placeholder="Escribe tu nombre completo como firma legal..."
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: legalSignerName.trim().length >= 3 ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.15)',
                    padding: '13px 16px',
                    borderRadius: 14,
                    color: '#fff',
                    fontSize: 14,
                    fontStyle: 'italic',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                />
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{error}</p>}

              <button 
                onClick={handleSubmit}
                disabled={isLoading || !acceptedTerms || !acceptedCollateral || !acceptedSplitClause || legalSignerName.trim().length < 3}
                style={{
                  width: '100%',
                  padding: '17px',
                  background: (!acceptedTerms || !acceptedCollateral || !acceptedSplitClause || legalSignerName.trim().length < 3) ? 'rgba(255,255,255,0.1)' : THEME_GRADIENT,
                  color: (!acceptedTerms || !acceptedCollateral || !acceptedSplitClause || legalSignerName.trim().length < 3) ? 'rgba(255,255,255,0.35)' : '#fff',
                  border: 'none',
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 900,
                  opacity: isLoading ? 0.7 : 1,
                  cursor: (!acceptedTerms || !acceptedCollateral || !acceptedSplitClause || legalSignerName.trim().length < 3) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.25s'
                }}
              >
                {isLoading ? 'Firmando y Enviando...' : '✍️ Firmar Contrato y Activar Negocio'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showBunzGuide && <BunzGuide onClose={() => setShowBunzGuide(false)} />}
    </div>
  );
}
