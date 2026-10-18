'use client';

import { motion } from 'framer-motion';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

import { DOC_SECTIONS } from '@/lib/support-content';
import React from 'react';

export default function DocsPage() {
  const sections = DOC_SECTIONS.map((sec) => ({
    title: sec.title,
    content: (
      <>
        {sec.body.split('\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </>
    ),
  }));

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
