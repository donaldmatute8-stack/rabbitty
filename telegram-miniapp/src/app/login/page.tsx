'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { inAppWallet } from "thirdweb/wallets";
import { useConnect } from "thirdweb/react";
import { client, activeChain } from "@/features/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { connect } = useConnect();

  const [step, setStep] = useState(1); // 1=email, 2=code
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await preAuthenticate({ client, strategy: "email", email });
      setStep(2);
    } catch {
      setError('Could not send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          chain: activeChain,
          sponsorGas: true,
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

      const smartWalletAddress = connectedWallet?.getAccount()?.address ?? '';
      // In v5, inAppWallet configured with smartAccount returns the Smart Account via getAccount().
      // To get the personal wallet address if needed, you typically rely on the backend via the smart wallet address.
      // For now we will use the smartWalletAddress for both fields, or leave signer_wallet empty/same as smart_wallet if inaccessible directly.
      const signerAddress = smartWalletAddress;

      // Upsert profile — also re-creates if this is a new device
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          smart_wallet_address: smartWalletAddress,
          signer_wallet: signerAddress,
        }),
      });

      // Check role to decide where to send the user
      const profileRes = await fetch(`/api/auth/profile?wallet=${smartWalletAddress}`);
      const { profile } = await profileRes.json();

      if (profile?.role === 'AFFILIATE') {
        router.push('/business');
      } else {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
      setError('Invalid code or connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => step === 1 ? handleSendCode() : handleVerify();

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
      {/* Back */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => step === 2 ? setStep(1) : router.push('/onboarding')}
          style={{ padding: 4, background: "none", border: "none", cursor: "pointer" }}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          fontSize: 36,
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
          lineHeight: 1.15,
          marginBottom: 52,
        }}
      >
        {step === 1 ? "Welcome back" : "Check your inbox"}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ flex: 1 }}
      >
        {step === 1 ? (
          <>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              style={inputStyle}
              autoFocus
            />
            <p style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              We'll send a quick verification code to your email.
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
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}
      >
        <button
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
          {loading ? "Please wait…" : step === 1 ? "Send Code" : "Login"}
        </button>

        <button
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-family-base)",
          }}
          onClick={() => router.push('/signup')}
        >
          Don't have an account? <span style={{ color: "var(--rabbitty-pink)", fontWeight: 600 }}>Sign up</span>
        </button>
      </motion.div>
    </div>
  );
}
