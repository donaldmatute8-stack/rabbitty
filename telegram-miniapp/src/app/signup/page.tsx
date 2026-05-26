'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      router.push('/welcome');
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      router.push('/onboarding');
    }
  };

  return (
    <div
      className="min-h-[100dvh]"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
        padding: "56px 28px 40px",
      }}
    >
      <div style={{ display: "flex", justifyContent: step === 1 ? "flex-end" : "flex-start", marginBottom: 28 }}>
        <button 
          onClick={handleBack}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          {step === 1 ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M1 1L17 17M17 1L1 17" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path d="M9 1L1 9L9 17" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
        >
          <h1 
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: "var(--text-dark)",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
              marginBottom: 52,
            }}
          >
            {step === 1 ? (
              <>What's your<br/>email address?</>
            ) : (
              <>Choose your<br/>password</>
            )}
          </h1>

          <div style={{ flex: 1 }}>
            {step === 1 ? (
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: "1px solid #DCDCDC",
                  padding: "12px 0",
                  fontSize: 17,
                  color: "var(--text-primary)",
                  outline: "none",
                  fontFamily: "var(--font-family-base)",
                }}
              />
            ) : (
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: "1px solid #DCDCDC",
                  padding: "12px 0",
                  fontSize: 17,
                  color: "var(--text-primary)",
                  outline: "none",
                  fontFamily: "var(--font-family-base)",
                }}
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.button 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={handleNext}
        className="active:scale-[0.98] transition-transform"
        style={{
          width: "100%",
          backgroundColor: "var(--bg-subtle)",
          color: "#888",
          fontSize: 16,
          fontWeight: 500,
          padding: "17px 0",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-family-base)",
        }}
      >
        Continue
      </motion.button>
    </div>
  );
}
