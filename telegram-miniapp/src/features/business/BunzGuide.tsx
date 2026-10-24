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
                  <strong style={{ color: 'var(--text-primary)' }}>Colateral:</strong> Tu inventario y producto real respaldan los Bunz que creas. 
                  No estás creando dinero de la nada — estás convirtiendo tu capacidad de servicio en recompensas.
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Paridad fija:</strong> 1 Bunz = $1 MXN. Siempre. Sin inflación, sin sorpresas.
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
                  <p style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text-primary)' }}>💰 Costos de transacción (en Bunz):</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cuando RECOMPENSAS (minteas)</span>
                      <span style={{ fontWeight: 800, color: THEME_COLOR }}>6%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cuando COBRAS en Bunz (recibes pago)</span>
                      <span style={{ fontWeight: 800, color: '#22C55E' }}>0%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cuando un cliente GASTA en tu negocio</span>
                      <span style={{ fontWeight: 800, color: THEME_COLOR }}>3%</span>
                    </div>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 13 }}>
                  💡 <strong>Compara con tarjetas de crédito:</strong> 2-4% sin beneficio adicional. 
                  Aquí pagas fees en Bunz (no en efectivo), y atraes clientes recurrentes.
                </p>
              </div>
            </motion.div>
          )}

          {tab === 'example' && (
            <motion.div key="example" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>Ejemplo Real: 50% de Recompensa</h3>
              
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>ESCENARIO</p>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Restaurante — Consumo de $1,000 MXN</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: '#22C55E' }}>✅ Con Bunz (50% recompensa)</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    • Recibes <strong>$1,000 MXN</strong> del cliente (pago completo)<br/>
                    • Entregas 500 Bunz (costo marginal: 6% fee = 30 Bunz ≈ $30 MXN)<br/>
                    • <strong>Costo real: $30 MXN</strong> (solo el fee)<br/>
                    • El cliente vuelve por más Bunz → recurrencia
                  </p>
                </div>

                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 14, border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 800, color: '#EF4444' }}>❌ Con Descuento del 50%</p>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    • Recibes solo <strong>$500 MXN</strong> (perdiste $500)<br/>
                    • Sin recompensa, sin fidelidad<br/>
                    • <strong>Costo real: $500 MXN</strong> de ingreso perdido<br/>
                    • El cliente se va y puede no volver
                  </p>
                </div>

                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, color: 'var(--text-primary)', marginTop: 4 }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 13 }}>📊 Diferencia clave</p>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 8px' }}></th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', color: '#22C55E' }}>Bunz 50%</th>
                        <th style={{ textAlign: 'right', padding: '4px 8px', color: '#EF4444' }}>Dto 50%</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '4px 8px' }}>Ingreso inmediato</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800 }}>$1,000</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 800 }}>$500</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '4px 8px' }}>Costo real</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>$30</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px' }}>$500</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '4px 8px' }}>¿Atrae nuevo tráfico?</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', color: '#22C55E' }}>Sí</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', color: '#EF4444' }}>No</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px' }}>Cliente recurrente</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', color: '#22C55E' }}>Alta prob.</td>
                        <td style={{ textAlign: 'right', padding: '4px 8px', color: '#EF4444' }}>Baja prob.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p style={{ margin: 0, fontSize: 13 }}>
                  💡 <strong>Con Bunz pagas solo el fee (6%).</strong> El descuento real 
                  es ~3% del valor de la transacción. Mucho menor que cualquier descuento tradicional.
                </p>
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
            Los Bunz son la moneda de recompensa del ecosistema Rabbitty. 
            1 Bunz = $1 MXN. Solo negocios afiliados pueden mintear Bunz.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
