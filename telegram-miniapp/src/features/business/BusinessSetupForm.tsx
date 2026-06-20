'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, MapPin, Percent, UploadCloud, ChevronRight, CheckCircle, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BusinessSetupFormProps {
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export default function BusinessSetupForm({ onSubmit, isLoading }: BusinessSetupFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = Welcome, 1 = Basic Info, 2 = Rewards & Gallery, 3 = Confirm
  const [error, setError] = useState('');

  // Step 1
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');

  // Step 2
  const [rewardPercentage, setRewardPercentage] = useState(15);
  const [logoBase64, setLogoBase64] = useState('');

  const THEME_COLOR = "#E91E63"; // Pink for brand identity
  const THEME_GRADIENT = "linear-gradient(135deg, #E91E63 0%, #D81B60 100%)";

  // Step 1 additions
  const [isVirtual, setIsVirtual] = useState(false);
  const [locating, setLocating] = useState(false);

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
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = () => {
    onSubmit({
      name,
      category,
      address: isVirtual ? 'Negocio Virtual' : address,
      rewardPercentage,
      gallery: logoBase64 ? [logoBase64] : [],
      description: "Negocio afiliado de Rabbitty.",
      activeDays: [1,2,3,4,5,6,7],
      startTime: "09:00",
      endTime: "21:00"
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
            {[1, 2, 3].map(i => (
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

                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>Vincular Google Business</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Verifica tu negocio al instante (próximamente)</p>
                  </div>
                  <button disabled style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', border: 'none', padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 900 }}>
                    Próximamente
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
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', paddingTop: 40 }}>
              <div style={{ width: 80, height: 80, background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={40} color="#10B981" />
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>¡Todo Listo!</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.5, marginBottom: 40, padding: '0 20px' }}>
                Al enviar tu solicitud, tu negocio entrará en fase de verificación. Te notificaremos cuando sea aprobado.
              </p>

              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 20, textAlign: 'left', marginBottom: 40 }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800, color: '#fff' }}>{name}</p>
                <p style={{ margin: '0 0 16px 0', fontSize: 14, color: THEME_COLOR, fontWeight: 700 }}>{category}</p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <MapPin size={16} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{address}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Percent size={16} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{rewardPercentage}% Recompensa</span>
                </div>
              </div>

              <button 
                onClick={handleSubmit} disabled={isLoading}
                style={{ width: '100%', padding: '18px', background: THEME_GRADIENT, color: '#fff', border: 'none', borderRadius: 999, fontSize: 16, fontWeight: 900, opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
