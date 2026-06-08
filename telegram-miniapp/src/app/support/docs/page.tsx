'use client';

import { motion } from 'framer-motion';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

export default function DocsPage() {
  const sections = [
    {
      title: "El Ecosistema Rabbitty",
      content: (
        <>
          <p>Rabbitty es una red de recompensas descentralizada diseñada para conectar negocios locales y consumidores mediante un modelo de <strong>Give-to-Get</strong>.</p>
          <p>Al visitar los restaurantes y comercios de la red <em>Stock</em>, puedes escanear tu billetera para recibir un porcentaje de tus compras directamente en <strong>Bunz</strong>, nuestra moneda digital exclusiva.</p>
        </>
      )
    },
    {
      title: "La Billetera Bunz",
      content: (
        <>
          <p>Tu billetera es el corazón de la Mini App. Funciona gracias a tecnología blockchain invisible, lo que significa que tus Bunz te pertenecen al 100%.</p>
          <ul>
            <li><strong>Cobrar:</strong> Muestra tu Código QR en el establecimiento.</li>
            <li><strong>Bóvedas Temporales:</strong> Si recibiste Bunz mediante tu teléfono antes de registrarte, tienes 3 meses para crear tu cuenta, de lo contrario se transferirán de vuelta a la Tesorería.</li>
          </ul>
        </>
      )
    },
    {
      title: "Stock y Freehands (Mapas)",
      content: (
        <>
          <p>En el menú inferior encontrarás dos formas de descubrir recompensas:</p>
          <ul>
            <li><strong>Stock (Feed):</strong> Una lista dinámica de negocios activos y sus ofertas de cashback en Bunz.</li>
            <li><strong>Freehands (Mapa):</strong> Un mapa interactivo y geolocalizado para encontrar los locales más cercanos a ti en tiempo real.</li>
          </ul>
        </>
      )
    },
    {
      title: "Niveles y Referidos",
      content: (
        <>
          <p>A medida que acumulas <strong>Hops</strong> (puntos de experiencia por tus visitas), tu nivel de Madriguera sube, cambiando el borde de tu avatar a colores únicos (Legendario, Épico, Raro).</p>
          <p>Además, al invitar a tus amigos con tu enlace del <strong>Programa de Referidos</strong>, ambos ganarán Bunz de regalo en la primera transacción del invitado.</p>
        </>
      )
    }
  ];

  return (
    <ProfileSubpageLayout title="Documentación">
      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #111 0%, #222 100%)', 
          borderRadius: 20, 
          padding: 24, 
          color: 'white',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>
            Whitepaper
          </h2>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14, lineHeight: 1.5 }}>
            Una guía rápida y destilada sobre cómo funciona el ecosistema Rabbitty desde la perspectiva del usuario.
          </p>
        </div>

        {sections.map((sec, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 24,
              border: '1px solid #F0F0F0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
            }}
          >
            <h3 style={{ 
              fontSize: 18, fontWeight: 800, color: '#E91E63', 
              margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 
            }}>
              <span style={{ 
                background: '#FDF2F8', color: '#E91E63', width: 24, height: 24, 
                borderRadius: '50%', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', fontSize: 13, fontWeight: 900 
              }}>{idx + 1}</span>
              {sec.title}
            </h3>
            <div style={{ 
              fontSize: 15, color: '#444', lineHeight: 1.6, 
              display: 'flex', flexDirection: 'column', gap: 12 
            }}>
              {sec.content}
            </div>
          </motion.div>
        ))}

      </div>
    </ProfileSubpageLayout>
  );
}
