'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

const INTERESTS = [
  "Food", "Travel", "Fashion", "Music",
  "Sports", "Tech", "Art", "Books",
  "Gaming", "Fitness", "Film", "Nature",
];

export default function RabbitBotPage() {
  const router = useRouter();
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());

  const toggleInterest = (interest: string) => {
    const newSelected = new Set(selectedInterests);
    if (newSelected.has(interest)) {
      newSelected.delete(interest);
    } else {
      newSelected.add(interest);
    }
    setSelectedInterests(newSelected);
  };

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "#F4F4F4",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 'var(--safe-top)' }} />
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 24px",
        marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E91E63" }} />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E91E63", opacity: 0.55 }} />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E91E63", opacity: 0.25 }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginLeft: 4 }}>RabbitBot</span>
        </div>
        <button 
          onClick={() => router.back()}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1L17 17M17 1L1 17" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            backgroundColor: "#fff",
            borderRadius: "18px 18px 18px 4px",
            padding: "14px 18px",
            maxWidth: "84%",
            fontSize: 15,
            color: "var(--text-dark)",
            lineHeight: 1.5,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          Hi, Bruce. Let's get started by understanding what you want.
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            backgroundColor: "#fff",
            borderRadius: "18px 18px 18px 4px",
            padding: "14px 18px",
            maxWidth: "84%",
            fontSize: 15,
            color: "var(--text-dark)",
            lineHeight: 1.5,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 4 }}>What are you interested in?</p>
          <p style={{ fontSize: 13, color: "#AAA" }}>Select all that apply</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}>
            {INTERESTS.map((label, i) => {
              const isSelected = selectedInterests.has(label);
              return (
                <motion.div
                  key={i}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleInterest(label)}
                  style={{
                    aspectRatio: "1",
                    backgroundColor: isSelected ? "#FFE0EC" : "#F7F7F7",
                    border: isSelected ? "1px solid #E91E63" : "1px solid #EBEBEB",
                    borderRadius: 14,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    gap: 4,
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: isSelected ? "#E91E63" : "#E5E5E5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}>
                    {isSelected && "✓"}
                  </div>
                  <span style={{ fontSize: 9, color: isSelected ? "#E91E63" : "#AAA", fontWeight: 600 }}>{label}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        style={{ padding: "16px 24px 36px" }}
      >
        <button 
          onClick={() => router.push('/')}
          className="active:scale-[0.98] transition-transform"
          style={{
            width: "100%",
            backgroundColor: selectedInterests.size > 0 ? "#111" : "var(--background-light)",
            color: selectedInterests.size > 0 ? "#fff" : "#888",
            fontSize: 16,
            fontWeight: 500,
            padding: "17px 0",
            borderRadius: 100,
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-family-base)",
            transition: "all 0.3s ease"
          }}
        >
          {selectedInterests.size > 0 ? "Continue" : "Select at least one"}
        </button>
      </motion.div>
    </div>
  );
}
