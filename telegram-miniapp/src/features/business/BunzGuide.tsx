'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle, Info, DollarSign, TrendingUp, Users } from 'lucide-react';

const TABS = [
  { id: 'how', label: 'Cómo funciona', icon: Info },
  { id: 'costs', label: 'Compromiso y Costos', icon: DollarSign },
  { id: 'example', label: 'Ejemplo Real', icon: TrendingUp },
  { id: 'benefits', label: 'Beneficios Extra', icon: Users },
];

const THEME_COLOR = '#E91E63';

export default function BunzGuide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('how');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          width: '100%', maxHeight: '90vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', borderRadius: '24px 24px 0 0',
          padding: '24px', paddingTop: 'calc(max(var(--safe-top, 0px), 16px) + 40px)',
          borderTop: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
            <span style={{ color: THEME_COLOR }}>Bunz</span> para Negocios
          </h2>
          <button onClick={onClose} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} className="text-(--text-primary)" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 999, border: active ? 'none' : '1px solid var(--border-subtle)',
                  background: active ? THEME_COLOR : 'var(--bg-subtle)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                }}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'how' && (
            <motion.div key="how" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>¿Cómo funcionan los Bunz?</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Los Bunz no se compran con dinero real.</strong> Los crean los negocios cuando un cliente consume.
                </p>
                <div style={{ background: 'rgba(233,30,99,0.08)', borderRadius: 14, padding: 16, border: '1px solid rgba(233,30,99,0.2)' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>🔄 El ciclo:</p>
                  <p style={{ margin: 0, fontSize: 13 }}>1. Un cliente consume en tu negocio ($1,000)<br/>
                  2. Tú eliges el % de recompensa (ej. 20% = 200 Bunz)<br/>
                  3. Esos Bunz van directo al wallet del cliente<br/>
                  4. El cliente los gasta en OTRO negocio de Rabbitty<br/>
                  5. Ese otro negocio recibe el 91% del valor en Bunz</p>
                </div>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Respaldo:</strong> Tu capacidad operativa y tu producto real respaldan las recompensas que entregas. No creas dinero: entregas un beneficio que tú mismo defines y que se consume en tu negocio o en la red.
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Valor y reglas:</strong> Los Bunz no son dinero ni tienen una paridad fija garantizada. Su valor, vigencia y condiciones se informan en el programa y en el contrato vigente. Rabbitty no promete rendimientos ni convertibilidad a efectivo.
                </p>
              </div>
            </motion.div>
          )}

          {tab === 'costs' && (
            <motion.div key="costs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Compromiso y Costos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Al mintear Bunz te comprometes a:</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <li>Aceptar Bunz como forma de pago en tu negocio</li>
                  <li>Mantener la calidad del servicio (los Bunz valen por tu reputación)</li>
                  <li>No mintear más Bunz de los que puedes respaldar con tu capacidad operativa</li>
                </ul>

                <div style={{ background: 'rgba(233,30,99,0.08)', borderRadius: 14, padding: 16, border: '1px solid rgba(233,30,99,0.2)', marginTop: 8 }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>⚖️ Capacidad y recuperación</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    <p style={{ margin: 0 }}>
                      La capacidad no es un paquete fijo. Se calcula con tus ventas mensuales elegibles, tu % de recompensa y los meses de cobertura.
                    </p>
                    <p style={{ margin: 0 }}>
                      Puede incluir un incentivo de incorporación y capacidad adelantada recuperable. La recuperación se propone por ciclo, con el importe exacto, y requiere tu aceptación en un modal. Si rechazas, no se descuenta nada.
                    </p>
                    <p style={{ margin: 0 }}>
                      Nunca se toca la capacidad comprometida con los Rabbitters. No hay intereses ni cambios retroactivos. Cualquier cargo o cuota se informa antes de cobrar; no se aplican cargos no aprobados.
                    </p>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 13 }}>
                  💡 <strong>Sin letras chiquitas:</strong> revisa tu oferta individual y el estado de cuenta. Ahí ves capacidad autorizada, disponible, comprometida y pendiente de recuperar.
                </p>
              </div>
            </motion.div>
          )}

          {tab === 'example' && (
            <motion.div key="example" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Ejemplo: capacidad dinámica</h3>

              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>ESCENARIO</p>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Ventas mensuales elegibles: $80,000 · Recompensa: 30% · Cobertura: 2 meses</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: '#22C55E' }}>✅ Capacidad sugerida</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    • $80,000 × 30% = $24,000 de recompensas al mes<br/>
                    • × 2 meses de cobertura = 48,000 Bunz de capacidad referencial<br/>
                    • Es una estimación: la capacidad real se confirma en tu oferta individual
                  </p>
                </div>

                <div style={{ background: 'rgba(233,30,99,0.08)', borderRadius: 12, padding: 14, border: '1px solid rgba(233,30,99,0.2)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: THEME_COLOR }}>🔄 Recuperación</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Al cierre del ciclo, Rabbitty calcula una tasa según tu progreso y te propone un importe exacto. Tú lo aceptas o lo rechazas en un modal. Si aceptas, se descuenta de la capacidad nueva generada; nunca de la comprometida. Si rechazas, no se mueve nada.
                  </p>
                </div>

                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, color: 'var(--text-primary)' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 13 }}>📊 Lo que ves antes de aceptar</p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8 }}>
                    <li>Base generada del periodo</li>
                    <li>Tasa propuesta y por qué</li>
                    <li>Importe exacto a retener</li>
                    <li>Pendiente antes y después</li>
                    <li>Capacidad disponible antes y después</li>
                    <li>Cobertura antes y después</li>
                    <li>Vigencia de la propuesta</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'benefits' && (
            <motion.div key="benefits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Beneficios Extra</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: 'var(--text-primary)' }}>🎯 Atraes clientes de OTROS negocios</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Los Bunz que regresaste se gastan en otros lugares. Pero también: 
                    los Bunz que otros negocios regresaron se pueden gastar <strong>en tu negocio</strong>.
                    Es tráfico nuevo que no tenías antes.
                  </p>
                </div>

                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: 'var(--text-primary)' }}>💰 El cliente con Bunz derrocha más</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Datos del ecosistema muestran que un cliente pagando con Bunz 
                    <strong> consume 30% más</strong> que uno que paga en efectivo. 
                    Porque siente que "no está gastando" — aunque el negocio recibe el valor completo.
                  </p>
                </div>

                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: 'var(--text-primary)' }}>📈 Lealtad real, no descuentos</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    El cliente que acumula Bunz en tu negocio <strong>vuelve</strong>. No por descuento, 
                    sino porque está construyendo valor dentro del ecosistema. Es dueño de su experiencia.
                  </p>
                </div>

                <div style={{ background: 'rgba(233,30,99,0.08)', borderRadius: 14, padding: 16, border: '1px solid rgba(233,30,99,0.2)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: 'var(--text-primary)' }}>🔄 Economía circular</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    Lo que das en Bunz no se pierde — vuelve a tu negocio (o a otro negocio del ecosistema) 
                    como nuevo consumo. Es un <strong>multiplicador de ingresos</strong>, no un gasto.
                  </p>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Los Bunz son puntos de lealtad del ecosistema Rabbitty. No son dinero,
            no tienen paridad fija garantizada y no se convierten a efectivo. Solo los
            negocios afiliados pueden entregar Bunz conforme a su capacidad autorizada.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
