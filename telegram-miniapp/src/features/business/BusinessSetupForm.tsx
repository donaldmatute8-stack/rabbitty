'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Percent, UploadCloud, ChevronRight, ChevronLeft, HelpCircle, ShieldCheck, FileText, ScanFace } from 'lucide-react';
import { useRouter } from 'next/navigation';
import BunzGuide from './BunzGuide';

import { NichePicker } from './NichePicker';
import { BunzyOnboarding } from './BunzyOnboarding';
import { BunzyVideoStage } from '@/components/onboarding/BunzyVideoStage';
import { verifyBiometric } from '@/lib/securityVault';
import { buildCapacityOptions, estimateDailyDemand, priorForNiche, tierLabel } from '@/lib/mcceOffer';
import { MCCE_CONTRACT_VERSION, MCCE_CONTRACT_STATUS, MCCE_CONTRACT_SUMMARY, renderContract, hashContract } from '@/lib/mcceContract';
/** Paso 0: el nicho define la categoría operativa (y por tanto los rangos). */
const NICHE_TO_CATEGORY: Record<string, string> = {
  restaurant: 'Restaurante',
  cafe: 'Cafetería',
  bar: 'Bar',
  bakery: 'Cafetería',
  pizza: 'Restaurante',
  tacos: 'Restaurante',
  barbershop: 'Belleza y Spa',
  fitness: 'Gimnasio',
  retail: 'Tienda de Ropa',
  services: 'Servicios de Salud',
  other: 'Restaurante',
};

interface BusinessSetupFormProps {
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
}



export default function BusinessSetupForm({ onSubmit, isLoading }: BusinessSetupFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = Welcome, 1 = Basic Info, 2 = Rewards, 3 = Package, 4 = Confirm
  // ── Paso 0: nicho (obligatorio antes de todo) ──
  const [niche, setNiche] = useState<string | null>(null);
  const [nicheDraft, setNicheDraft] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Step 1
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [legalName, setLegalName] = useState('');
  const [rfc, setRfc] = useState('');
  const [representativePosition, setRepresentativePosition] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Step 2
  const [rewardPercentage, setRewardPercentage] = useState(30);
  const [logoBase64, setLogoBase64] = useState('');

  // Step 3 · capacidad
  const [selectedPackage, setSelectedPackage] = useState('BASIC');
  const [salesPerDay, setSalesPerDay] = useState(30);
  const [avgTicket, setAvgTicket] = useState(180);

  // Step 4 · contrato y firma
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCollateral, setAcceptedCollateral] = useState(false);
  const [acceptedSplitClause, setAcceptedSplitClause] = useState(false);
  const [legalSignerName, setLegalSignerName] = useState('');
  const [offerId] = useState(() => `mcce-${crypto.randomUUID()}`);
  const offerDate = new Date().toISOString().slice(0, 10);
  const reviewDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricNote, setBiometricNote] = useState('');

  const [showBunzGuide, setShowBunzGuide] = useState(false);

  const THEME_COLOR = "#E91E63";
  const THEME_GRADIENT = "linear-gradient(135deg, #E91E63 0%, #D81B60 100%)";
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 1 };
  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '13px 16px', borderRadius: 14, color: '#fff', fontSize: 14, outline: 'none' };

  const offerDailyDemand = useMemo(
    () =>
      estimateDailyDemand({
        dailyFiatSales: Math.max(0, Number(avgTicket) || 0) * Math.max(0, Number(salesPerDay) || 0),
        rewardRate: Math.max(10, Number(rewardPercentage) || 10) / 100,
        redemptionShare: priorForNiche(niche || category),
      }),
    [avgTicket, salesPerDay, rewardPercentage, niche, category]
  );

  const offerOptions = useMemo(
    () =>
      buildCapacityOptions({
        dailyCapacityDemand: offerDailyDemand,
        nicheFloor: 500,
        nicheCeiling: 20000,
        solvencyCap: 10000,
        coverageDays: [7, 14, 30],
        promoShare: 0.4,
      }),
    [offerDailyDemand]
  );

  const selectedOption =
    selectedPackage === 'CUSTOM'
      ? offerOptions.length > 0
        ? { ...offerOptions[offerOptions.length - 1], tier: 'CUSTOM' as const }
        : undefined
      : offerOptions.find((o) => o.tier === selectedPackage) ?? offerOptions[0];

  // Step 1 additions
  const [isVirtual, setIsVirtual] = useState(false);
  const [locating, setLocating] = useState(false);
  const [googleClaimed, setGoogleClaimed] = useState(false);

  const contractData = useMemo(
    () => ({
      affiliateLegalName: legalName || name,
      affiliateRfc: rfc || undefined,
      affiliateAddress: isVirtual ? 'Negocio Virtual' : address,
      representative: legalSignerName,
      representativePosition: representativePosition || undefined,
      businessName: name,
      niche: niche || category,
      offerId,
      offerDate,
      capacityTotal: selectedOption?.totalCapacity ?? 0,
      promo: selectedOption?.promoCapacity ?? 0,
      credit: selectedOption?.creditCapacity ?? 0,
      provisioned: 0,
      coverageDays: selectedOption?.coverageDays ?? 0,
      reviewDate,
      recoveryTerms: 'Recuperación desde capacidad generada por actividad elegible; sin intereses; con protección de lo comprometido.',
      operationalTerms: 'Sucursal principal; horarios, productos y servicios declarados en el alta; reclamaciones por los canales de soporte de Rabbitty.',
      contactEmail: contactEmail || undefined,
    }),
    [
      legalName, name, rfc, isVirtual, address, legalSignerName, representativePosition,
      niche, category, offerId, offerDate, selectedOption, reviewDate, contactEmail,
    ]
  );

  const contractText = useMemo(() => renderContract(contractData), [contractData]);

  const downloadContract = () => {
    try {
      const blob = new Blob([contractText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato-rabbitty-${offerId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo descargar la copia del contrato.');
    }
  };

  const handleBiometric = async () => {
    setBiometricBusy(true);
    setBiometricNote('');
    try {
      const res = await verifyBiometric('Firma del Acuerdo de Capacidad Comercial');
      setBiometricVerified(res.ok);
      setBiometricNote(res.message);
    } catch {
      setBiometricVerified(false);
      setBiometricNote('No se pudo verificar Face ID. Puedes firmar con tu nombre completo.');
    } finally {
      setBiometricBusy(false);
    }
  };

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
    if (step === 1 && (!name || !category || !legalName || legalSignerName.trim().length < 3 || (!isVirtual && !address))) {
      setError("Completa el nombre comercial, la razón social, el representante legal y la dirección.");
      return;
    }
    if (step === 2 && rewardPercentage < 10) {
      setError("La recompensa mínima es 10%.");
      return;
    }
    if (step === 3 && !selectedOption) {
      setError('Elige una opción de capacidad para continuar.');
      return;
    }
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!acceptedTerms || !acceptedCollateral || !acceptedSplitClause || legalSignerName.trim().length < 3) {
      setError('Acepta las condiciones y firma con tu nombre completo.');
      return;
    }
    if (!selectedOption) {
      setError('No hay una capacidad calculada. Revisa tus datos de operación.');
      return;
    }
    const contractHash = await hashContract(contractText);
    const offer = {
      tier: selectedOption.tier,
      coverageDays: selectedOption.coverageDays,
      totalCapacity: selectedOption.totalCapacity,
      promoCapacity: selectedOption.promoCapacity,
      creditCapacity: selectedOption.creditCapacity,
      dailyDemand: Math.round(offerDailyDemand * 100) / 100,
      avgTicket: Number(avgTicket) || 0,
      salesPerDay: Number(salesPerDay) || 0,
      estimated: true,
      customRequested: selectedPackage === 'CUSTOM',
    };
    onSubmit({
      name,
      category,
      niche,
      address: isVirtual ? 'Negocio Virtual' : address,
      rewardPercentage,
      gallery: logoBase64 ? [logoBase64] : [],
      description: "Negocio afiliado de Rabbitty.",
      activeDays: [1,2,3,4,5,6,7],
      startTime: "09:00",
      endTime: "21:00",
      package: selectedOption.tier,
      creditLimit: selectedOption.totalCapacity,
      googleClaimed,
      contractSignature: {
        signedBy: legalSignerName.trim(),
        signedAt: new Date().toISOString(),
        contractVersion: MCCE_CONTRACT_VERSION,
        contractStatus: MCCE_CONTRACT_STATUS,
        contractHash,
        contractData,
        contractText,
        signatureMethod: biometricVerified ? 'local_authentication' : 'name_checkbox',
        acceptanceType: MCCE_CONTRACT_STATUS === 'draft' ? 'draft' : 'final',
        biometricVerified,
        acceptedTerms: true,
        acceptedCapacity: true,
        acceptedRecovery: true,
        offer,
        nicheCategory: category,
        niche: niche || null,
      },
    });
  };

  // ── PASO 0: elegir nicho antes de cualquier otra cosa ──
  // Define los módulos del negocio (mesas, cocina, citas…) y la categoría
  // operativa. Añadir un nicho nuevo NO requiere tocar este formulario.
  if (!niche) {
    return (
      <NichePicker
        value={nicheDraft}
        onSelect={setNicheDraft}
        onContinue={() => {
          if (!nicheDraft) return;
          setNiche(nicheDraft);
          setCategory(NICHE_TO_CATEGORY[nicheDraft] ?? 'Restaurante');
        }}
        submitLabel="Continuar"
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111', color: '#fff', zIndex: 100, display: 'flex', flexDirection: 'column', fontFamily: "var(--font-family-base)", overflowY: 'auto' }}>
      
      <BunzyOnboarding niche={niche} step={step} businessName={name || null} />

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
                style={{ position: 'absolute', top: 'calc(max(var(--safe-top, 0px), 50px) + 24px)', left: 0, background: 'rgba(255,255,255,0.1)', border: 'none', width: 40, height: 40, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ChevronLeft size={20} />
              </button>

              <button
                onClick={() => setShowBunzGuide(true)}
                style={{ position: 'absolute', top: 'calc(max(var(--safe-top, 0px), 50px) + 24px)', right: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '6px 14px', borderRadius: 999, color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <HelpCircle size={14} /> ¿Cómo funciona?
              </button>
              
              <div style={{ margin: '0 auto 20px', width: '100%' }}>
                <BunzyVideoStage
          loop
                  videoSrc="/videos/bunzy/bunzy-1-hi.mp4"
                  poster="/videos/bunzy/bunzy-1-hi.jpg"
                  stepLabel="AFILIACIÓN DE NEGOCIO"
                  title="Atrae clientes con Rabbitty"
                  description="Afilia tu negocio, ofrece recompensas en Bunz y aumenta tus ventas diarias con tu propio programa de lealtad."
                  videoHeightClass="h-48 sm:h-56"
                />
              </div>

              <button 
                onClick={nextStep}
                style={{ width: '100%', padding: '18px', background: THEME_GRADIENT, color: '#fff', border: 'none', borderRadius: 999, fontSize: 17, fontWeight: 900, boxShadow: '0 8px 32px rgba(233,30,99,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}
              >
                Comenzar Registro <ChevronRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div style={{ marginBottom: 20 }}>
                <BunzyVideoStage
          loop
                  videoSrc="/videos/bunzy/bunzy-2-show.mp4"
                  poster="/videos/bunzy/bunzy-2-show.jpg"
                  stepLabel="PASO 1 · PERFIL COMERCIAL"
                  title="¿Cómo te conocerán?"
                  description="Indica el nombre y dirección de tu local para que los Rabbitters te visiten y consuman."
                  videoHeightClass="h-40 sm:h-48"
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Nombre Comercial</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Café Cultura" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', borderRadius: 16, color: '#fff', fontSize: 16, outline: 'none' }} />
                </div>
                <div>
                  <label style={labelStyle}>Razón social / nombre legal</label>
                  <input type="text" value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Ej. Café Cultura SA de CV" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>RFC (opcional)</label>
                    <input type="text" value={rfc} onChange={e => setRfc(e.target.value.toUpperCase())} placeholder="XAXX010101000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Correo de contacto</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contacto@negocio.mx" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Representante legal</label>
                    <input type="text" value={legalSignerName} onChange={e => setLegalSignerName(e.target.value)} placeholder="Nombre completo" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Cargo</label>
                    <input type="text" value={representativePosition} onChange={e => setRepresentativePosition(e.target.value)} placeholder="Titular / Administrador" style={inputStyle} />
                  </div>
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
              <div style={{ marginBottom: 20 }}>
                <BunzyVideoStage
          loop
                  videoSrc="/videos/bunzy/bunzy-3-conexion.mp4"
                  poster="/videos/bunzy/bunzy-3-conexion.jpg"
                  stepLabel="PASO 2 · CONFIANZA & VALOR"
                  title="Tus Recompensas en Bunz"
                  description="Define el porcentaje que recibirán tus clientes. Más Bunz significa mayor recurrencia y comensales fieles."
                  videoHeightClass="h-40 sm:h-48"
                />
              </div>
              
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
                  type="range" min="10" max="50" step="1" value={rewardPercentage} onChange={e => setRewardPercentage(Number(e.target.value))}
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
              <div style={{ marginBottom: 20 }}>
                <BunzyVideoStage
                  loop
                  videoSrc="/videos/bunzy/bunzy-4-descubrimiento.mp4"
                  poster="/videos/bunzy/bunzy-4-descubrimiento.jpg"
                  stepLabel="PASO 4 · CAPACIDAD"
                  title="Tu capacidad para recibir"
                  description="Calculamos la capacidad según tu negocio. No compras Bunz: te habilitamos capacidad para que los Rabbitters consuman."
                  videoHeightClass="h-40 sm:h-48"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Ventas por día (aprox.)</label>
                  <input
                    type="number"
                    min={1}
                    value={salesPerDay}
                    onChange={(e) => setSalesPerDay(Number(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ticket promedio (MXN)</label>
                  <input
                    type="number"
                    min={1}
                    value={avgTicket}
                    onChange={(e) => setAvgTicket(Number(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, rgba(233,30,99,0.12), rgba(249,115,22,0.08))', borderRadius: 20, padding: 16, marginBottom: 16, border: '1px solid rgba(233,30,99,0.28)' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 900, color: '#F472B6', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Capacidad estimada para tu negocio
                </p>
                <p style={{ margin: '4px 0', fontSize: 30, fontWeight: 900, color: '#fff' }}>
                  {selectedOption ? selectedOption.totalCapacity.toLocaleString() : '—'}{' '}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Bunz</span>
                </p>
                <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
                  Cobertura {selectedOption?.coverageDays ?? '—'} días · Incentivo{' '}
                  {selectedOption?.promoCapacity.toLocaleString() ?? '—'} · Capacidad adelantada{' '}
                  {selectedOption?.creditCapacity.toLocaleString() ?? '—'}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
                  Estimación sujeta a autorización. El monto lo calcula el sistema; tú eliges la cobertura.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {offerOptions.map((o) => {
                  const selected = selectedPackage === o.tier;
                  return (
                    <button
                      key={o.tier}
                      onClick={() => setSelectedPackage(o.tier)}
                      style={{
                        width: '100%', display: 'flex', flexDirection: 'column', gap: 4,
                        padding: '16px 20px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                        background: selected ? 'rgba(233,30,99,0.16)' : 'rgba(255,255,255,0.04)',
                        border: selected ? '2px solid rgba(233,30,99,0.7)' : '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{tierLabel(o.tier)}</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: THEME_COLOR }}>
                          {o.totalCapacity.toLocaleString()} Bunz
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                        {o.coverageDays} días de cobertura · Incentivo {o.promoCapacity.toLocaleString()} + Capacidad adelantada {o.creditCapacity.toLocaleString()}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        La capacidad adelantada se recupera con tu actividad, sin tocar lo ya comprometido.
                      </p>
                    </button>
                  );
                })}

                <button
                  onClick={() => setSelectedPackage('CUSTOM')}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '16px 20px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                    background: selectedPackage === 'CUSTOM' ? 'rgba(233,30,99,0.16)' : 'rgba(255,255,255,0.04)',
                    border: selectedPackage === 'CUSTOM' ? '2px solid rgba(233,30,99,0.7)' : '1px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Personalizado</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#FBBF24' }}>Sujeto a evaluación</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                    Si tu operación necesita otra cobertura, el equipo evalúa tu caso con tus datos.
                  </p>
                </button>
              </div>

              <div style={{ marginTop: 18, padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  No compras Bunz. Te habilitamos capacidad para recibir a los Rabbitters. La capacidad
                  está sujeta a autorización y a las condiciones del acuerdo.
                </p>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 14, marginTop: 16 }}>{error}</p>}

              <button onClick={nextStep} style={{ width: '100%', padding: '16px', background: THEME_GRADIENT, color: '#fff', border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 900, marginTop: 24 }}>
                Continuar
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'left', paddingTop: 12 }}>
              <div style={{ marginBottom: 20 }}>
                <BunzyVideoStage
                  loop
                  videoSrc="/videos/bunzy/bunzy-5-celebra.mp4"
                  poster="/videos/bunzy/bunzy-5-celebra.jpg"
                  stepLabel="PASO 5 · CONTRATO Y FIRMA"
                  title="Acuerdo de capacidad"
                  description="Revisa el acuerdo, acepta las condiciones y firma."
                  videoHeightClass="h-36 sm:h-44"
                />
              </div>

              <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 16, padding: 14, maxHeight: 230, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                {contractText}
              </div>
              <button
                type="button"
                onClick={downloadContract}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: THEME_COLOR, fontSize: 12, fontWeight: 800, cursor: 'pointer', marginBottom: 14, padding: 0 }}
              >
                <FileText size={13} /> Descargar copia del contrato
              </button>

              {MCCE_CONTRACT_STATUS === 'draft' && (
                <div style={{ background: 'rgba(251,191,36,0.12)', borderRadius: 12, border: '1px solid rgba(251,191,36,0.35)', padding: '12px 14px', marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#FBBF24', lineHeight: 1.5, fontWeight: 700 }}>
                    Borrador para revisión legal.
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    Este texto todavía no es un contrato ejecutable. Al continuar registras tu
                    aceptación del borrador; la capacidad queda como propuesta y no se activa
                    hasta la aprobación legal.
                  </p>
                </div>
              )}

              <div style={{ background: 'rgba(233,30,99,0.08)', borderRadius: 12, border: '1px solid rgba(233,30,99,0.2)', padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  <strong>Resumen:</strong> {MCCE_CONTRACT_SUMMARY}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, accentColor: THEME_COLOR, flexShrink: 0 }} />
                  <span>
                    {MCCE_CONTRACT_STATUS === 'draft'
                      ? 'He recibido y consultado la versión de trabajo del expediente MCCE. Mi acción registra la recepción/aceptación del borrador; no constituye firma del contrato definitivo, aceptación de una oferta económica, reconocimiento de adeudo ni autorización para provisionar capacidad real.'
                      : `Acepto el Acuerdo de Capacidad Comercial ${MCCE_CONTRACT_VERSION}.`}
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={acceptedCollateral} onChange={(e) => setAcceptedCollateral(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, accentColor: THEME_COLOR, flexShrink: 0 }} />
                  <span>Entiendo que la capacidad se usa para aceptar redenciones de Bunz y que no puedo condicionar ni inflar precios.</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                  <input type="checkbox" checked={acceptedSplitClause} onChange={(e) => setAcceptedSplitClause(e.target.checked)} style={{ marginTop: 2, width: 17, height: 17, accentColor: THEME_COLOR, flexShrink: 0 }} />
                  <span>Entiendo que la capacidad adelantada se recupera con actividad y que lo ya comprometido se protege.</span>
                </label>
              </div>

              <div style={{ marginBottom: 18 }}>
                <p style={labelStyle}>Firmante</p>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontStyle: 'italic', fontWeight: 700, color: legalSignerName.trim().length >= 3 ? '#34D399' : 'rgba(255,255,255,0.5)' }}>
                  {legalSignerName.trim().length >= 3 ? legalSignerName : 'Completa el representante legal en el paso 1.'}
                </p>
                <p style={{ margin: 0, fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                  El contrato se genera con la razón social, RFC, domicilio, representante y la oferta de capacidad de este alta.
                </p>

                <div style={{ marginTop: 12 }}>
                  {biometricVerified ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#34D399', fontWeight: 700 }}>
                      ✓ Autenticación local verificada
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBiometric}
                      disabled={biometricBusy}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                        width: '100%', padding: '12px 16px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', fontSize: 13, fontWeight: 800, cursor: biometricBusy ? 'wait' : 'pointer',
                      }}
                    >
                      <ScanFace size={16} />
                      {biometricBusy ? 'Verificando…' : 'Autenticación local con Face ID / Touch ID'}
                    </button>
                  )}
                  {biometricNote && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: biometricVerified ? '#34D399' : 'rgba(255,255,255,0.55)' }}>
                      {biometricNote}
                    </p>
                  )}
                  <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                    Si tu dispositivo no tiene biometría, tu nombre completo y las casillas son suficientes.
                  </p>
                </div>
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
                  transition: 'all 0.25s',
                }}
              >
                {isLoading
                  ? 'Registrando...'
                  : MCCE_CONTRACT_STATUS === 'draft'
                    ? 'Registrar aceptación del borrador'
                    : 'Firmar acuerdo y activar negocio'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showBunzGuide && <BunzGuide onClose={() => setShowBunzGuide(false)} />}
    </div>
  );
}
