'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { inAppWallet } from "thirdweb/wallets";
import { useConnect } from "thirdweb/react";
import { client, activeChain } from "@/features/auth/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const { connect } = useConnect();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      router.push('/onboarding');
    }
  };

  // Step 1: Send OTP to email
  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await preAuthenticate({
        client,
        strategy: "email",
        email,
      });
      setStep(2);
    } catch (e) {
      setError('Could not send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP → create In-App Wallet + Smart Wallet → register in Neon
  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const wallet = inAppWallet({
        smartAccount: {
          chain: activeChain, // Polygon or Sepolia based on env
          sponsorGas: true, // Gasless for the user
        },
      });

      const connectedWallet = await connect(async () => {
        await wallet.connect({
          client,
          strategy: "email",
          email,
          verificationCode,
        });
        return wallet;
      });

      // The smart wallet address is the canonical identity
      const smartWalletAddress = connectedWallet?.getAccount()?.address ?? '';
      // The in-app wallet is the underlying signer
      const signerAddress = smartWalletAddress;

      // Register in Neon DB (server-side API route)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          smart_wallet_address: smartWalletAddress,
          signer_wallet: signerAddress,
        }),
      });

      if (!res.ok) throw new Error('Registration failed');

      router.push('/welcome');
    } catch (e) {
      console.error(e);
      setError('Invalid code or connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      handleSendCode();
    } else {
      handleVerify();
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "1px solid var(--border-default)",
    padding: "12px 0",
    fontSize: 17,
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "var(--font-family-base)",
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
      {/* Back / Close */}
      <div style={{ display: "flex", justifyContent: step === 1 ? "flex-end" : "flex-start", marginBottom: 28 }}>
        <button
          onClick={handleBack}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          {step === 1 ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M1 1L17 17M17 1L1 17" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path d="M9 1L1 9L9 17" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
              marginBottom: 52,
            }}
          >
            {step === 1 ? (
              <>What's your<br />email address?</>
            ) : (
              <>Check your<br />inbox</>
            )}
          </h1>

          <div style={{ flex: 1 }}>
            {step === 1 ? (
              <>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  style={inputStyle}
                  autoFocus
                />
                <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  We'll send a verification code to confirm it's you.
                </p>
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  style={{ ...inputStyle, letterSpacing: 6, fontSize: 22 }}
                  autoFocus
                />
                <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Sent to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                </p>
              </>
            )}

            {error && (
              <p style={{ marginTop: 16, fontSize: 13, color: "var(--rabbitty-pink)", fontWeight: 500 }}>
                {error}
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.button
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        onClick={handleNext}
        disabled={loading}
        className="active:scale-[0.98] transition-transform"
        style={{
          width: "100%",
          backgroundColor: loading ? "var(--bg-subtle)" : "var(--text-primary)",
          color: loading ? "var(--text-muted)" : "var(--bg-primary)",
          fontSize: 16,
          fontWeight: 600,
          padding: "17px 0",
          borderRadius: 100,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "var(--font-family-base)",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Please wait…" : step === 1 ? "Send Code" : "Verify & Create Account"}
      </motion.button>

      <p
        style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)", cursor: "pointer" }}
        onClick={() => router.push('/login')}
      >
        Already have an account? <span style={{ color: "var(--rabbitty-pink)", fontWeight: 600 }}>Login</span>
      </p>
    </div>
  );
}
