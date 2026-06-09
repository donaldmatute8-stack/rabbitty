'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/ui/Header';

export default function RoleSelectionPage() {
  const router = useRouter();

  const handleSelectMember = () => {
    router.push('/');
  };

  const handleSelectBusiness = () => {
    router.push('/business');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F4F4F4]" style={{ fontFamily: "var(--font-family-base)" }}>
      <div style={{ height: 'var(--safe-top)' }} />
      <Header showBack={true} isScrolled={false} />

      <main className="flex-1 flex flex-col w-full max-w-[600px] mx-auto mt-4 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-3"
        >
          <h1 className="text-[38px] font-bold tracking-[-0.5px] leading-[1.15]" style={{ color: "var(--text-dark)" }}>
            Welcome, Bruce.
          </h1>
          <p className="mt-4 text-[15px] leading-[1.55] text-[#666]">
            Rabbitty is about Sharing Experiences,<br/>
            simply and efficiently use your time and<br/>
            social life. Benefit yourself with bunz.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-8 text-center"
        >
          <p className="text-[14px] font-bold" style={{ color: "var(--text-dark)" }}>
            You don't have any accounts
          </p>
        </motion.div>

        <div className="mt-4 flex flex-col gap-4">
          <motion.button 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={handleSelectMember}
            className="active:scale-[0.98] transition-transform text-left bg-white rounded-xl p-6 pb-5 cursor-pointer"
            style={{ border: "1px solid var(--border-light)" }}
          >
            <p className="text-[15px] font-bold mb-1" style={{ color: "var(--text-dark)" }}>
              Become a member.
            </p>
            <p className="text-xs text-[#888] mb-3.5">
              Enter the Rabbitty Experience
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[16px]" style={{ color: "var(--primary-color)" }}>→</span>
              <span className="text-[13px] font-medium" style={{ color: "var(--primary-color)" }}>Open an account</span>
            </div>
          </motion.button>

          <motion.button 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleSelectBusiness}
            className="active:scale-[0.98] transition-transform text-left bg-white rounded-xl p-6 pb-5 cursor-pointer"
            style={{ border: "1px solid var(--border-light)" }}
          >
            <p className="text-[15px] font-bold mb-3.5" style={{ color: "var(--text-dark)" }}>
              Own a Business? Affiliate now.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[16px]" style={{ color: "var(--primary-color)" }}>→</span>
              <span className="text-[13px] font-medium" style={{ color: "var(--primary-color)" }}>Open an account</span>
            </div>
          </motion.button>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="text-[14px] font-semibold text-[#999]">No activity</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-auto pb-8 pt-8 text-center"
        >
          <p className="text-xs text-[#bbb]">© Rabbitty</p>
        </motion.div>
      </main>
    </div>
  );
}
