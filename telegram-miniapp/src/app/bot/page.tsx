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
      className="min-h-[100dvh] bg-[#F4F4F4] flex flex-col overflow-hidden"
      style={{
        fontFamily: "var(--font-family-base)",
      }}
    >
      <div style={{ height: 'var(--safe-top)' }} />
      <div className="flex items-center justify-between px-6 py-6 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 items-center">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="size-2 rounded-full bg-[#E91E63]" />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="size-2 rounded-full bg-[#E91E63] opacity-[0.55]" />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="size-2 rounded-full bg-[#E91E63] opacity-[0.25]" />
          </div>
          <span className="text-[15px] font-bold ml-1" style={{ color: "var(--text-dark)" }}>RabbitBot</span>
        </div>
        <button
          onClick={() => router.back()}
          className="bg-transparent border-none cursor-pointer p-1"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1L17 17M17 1L1 17" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 px-5 flex flex-col gap-3 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-[18px] rounded-bl-[4px] px-[18px] py-[14px] max-w-[84%] text-[15px] leading-[1.5] shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          style={{ color: "var(--text-dark)" }}
        >
          Hi, Bruce. Let's get started by understanding what you want.
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-[18px] rounded-bl-[4px] px-[18px] py-[14px] max-w-[84%] text-[15px] leading-[1.5] shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          style={{ color: "var(--text-dark)" }}
        >
          <p className="font-semibold mb-1">What are you interested in?</p>
          <p className="text-[13px] text-[#AAA]">Select all that apply</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-white rounded-[20px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <div className="grid grid-cols-4 gap-[10px]">
            {INTERESTS.map((label, i) => {
              const isSelected = selectedInterests.has(label);
              return (
                <motion.div
                  key={i}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleInterest(label)}
                  className="aspect-square rounded-[14px] flex flex-col items-center justify-center cursor-pointer gap-1"
                  style={{
                    backgroundColor: isSelected ? "#FFE0EC" : "#F7F7F7",
                    border: isSelected ? "1px solid #E91E63" : "1px solid #EBEBEB",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div className="size-[22px] rounded-full flex items-center justify-center text-white text-[12px]" style={{ backgroundColor: isSelected ? "#E91E63" : "#E5E5E5" }}>
                    {isSelected && "✓"}
                  </div>
                  <span className="text-[9px] font-semibold" style={{ color: isSelected ? "#E91E63" : "#AAA" }}>{label}</span>
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
        className="px-6 pt-4 pb-9"
      >
        <button
          onClick={() => router.push('/')}
          className="w-full text-[16px] font-medium py-[17px] rounded-[100px] border-none cursor-pointer active:scale-[0.98] transition-transform"
          style={{
            backgroundColor: selectedInterests.size > 0 ? "#111" : "var(--background-light)",
            color: selectedInterests.size > 0 ? "#fff" : "#888",
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
