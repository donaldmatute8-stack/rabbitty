'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import Link from 'next/link';

import { FAQS } from '@/lib/support-content';

export default function FAQPage() {
  const [query, setQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(
    faq => faq.q.toLowerCase().includes(query.toLowerCase()) || 
           faq.a.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <ProfileSubpageLayout title="FAQs">
      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Buscador Inteligente */}
        <div style={{ position: 'relative' }}>
          <div style={{ 
            position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)', color: '#E91E63' 
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar pregunta..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '16px 16px 16px 44px',
              borderRadius: 16,
              border: '1px solid #E0E0E0',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'var(--font-family-base)',
              color: '#111',
              background: '#fff',
              outline: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#E91E63'}
            onBlur={(e) => e.target.style.borderColor = '#E0E0E0'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div 
                  key={idx} 
                  style={{ 
                    background: '#FFFFFF', 
                    borderRadius: 16, 
                    border: '1px solid #F0F0F0',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <button 
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    style={{ 
                      width: '100%', padding: 20, display: 'flex', justifyContent: 'space-between', 
                      alignItems: 'center', background: 'transparent', border: 'none', 
                      cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111', paddingRight: 16 }}>
                      {faq.q}
                    </span>
                    <motion.div 
                      animate={{ rotate: isExpanded ? 180 : 0 }} 
                      style={{ color: '#E91E63' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div style={{ padding: '0 20px 20px', fontSize: 14, color: '#666', lineHeight: 1.6 }}>
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#AAA' }}>
              No se encontraron resultados.
            </div>
          )}
        </div>

        {/* Fallback a Telegram Bot */}
        <div style={{ marginTop: 32, textAlign: 'center', padding: 20 }}>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>¿Aún no encuentras lo que buscas?</p>
          <Link href="https://t.me/rabbittybot_bot?start=help" style={{ textDecoration: 'none' }}>
            <motion.div
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 100,
                border: '2px solid #E91E63',
                color: '#E91E63',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              Contactar Soporte
            </motion.div>
          </Link>
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
