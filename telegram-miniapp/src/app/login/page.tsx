'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { preAuthenticate } from "thirdweb/wallets/in-app";
import { inAppWallet } from "thirdweb/wallets";
import { useConnect } from "thirdweb/react";

const client = createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID! });
const activeChain = sepolia;

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
      const signerAddress = smartWalletAddress;

      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          smart_wallet_address: smartWalletAddress,
          signer_wallet: signerAddress,
        }),
      });

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

  const inputBaseClassName = "w-full bg-transparent border-none py-3 text-[17px] outline-none";
  const inputBaseStyle: React.CSSProperties = {
    borderBottom: "1px solid var(--border-default)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-family-base)",
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col pt-14 px-7 pb-10"
      style={{
        fontFamily: "var(--font-family-base)",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      {/* Back */}
      <div className="mb-7">
        <button
          onClick={() => step === 2 ? setStep(1) : router.push('/onboarding')}
          className="p-1 bg-none border-none cursor-pointer"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[36px] font-extrabold tracking-[-0.5px] leading-[1.15] mb-13"
        style={{ color: "var(--text-primary)" }}
      >
        {step === 1 ? "Welcome back" : "Check your inbox"}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1"
      >
        {step === 1 ? (
          <>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              className={inputBaseClassName}
              style={inputBaseStyle}
              autoFocus
            />
            <p className="mt-4 text-[13px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
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
              className={`${inputBaseClassName} tracking-[6px] text-[22px]`}
              style={inputBaseStyle}
              autoFocus
            />
            <p className="mt-4 text-[13px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
              Sent to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
            </p>
          </>
        )}

        {error && (
          <p className="mt-4 text-[13px] font-medium" style={{ color: "var(--rabbitty-pink)" }}>
            {error}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-5"
      >
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full text-base font-semibold py-[17px] rounded-full border-none transition-all duration-200 active:scale-[0.98]"
          style={{
            backgroundColor: loading ? "var(--bg-subtle)" : "var(--text-primary)",
            color: loading ? "var(--text-muted)" : "var(--bg-primary)",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "var(--font-family-base)",
          }}
        >
          {loading ? "Please wait\u2026" : step === 1 ? "Send Code" : "Login"}
        </button>

        <button
          className="bg-none border-none text-sm font-medium cursor-pointer"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-family-base)",
          }}
          onClick={() => router.push('/signup')}
        >
          Don't have an account? <span className="font-semibold" style={{ color: "var(--rabbitty-pink)" }}>Sign up</span>
        </button>
      </motion.div>
    </div>
  );
}
