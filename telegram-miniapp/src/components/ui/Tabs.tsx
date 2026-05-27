'use client';

import { motion } from 'framer-motion';

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
  isScrolled?: boolean;
  isDark?: boolean;
}

export default function Tabs({ tabs, activeTab, onChange, isScrolled = false, isDark = false }: TabsProps) {
  return (
    <nav
      className={`flex w-full pt-2 px-0 transition-colors duration-500 ${isDark ? 'bg-transparent' : 'bg-white'}`}
      style={isScrolled ? {
        position: 'absolute',
        left: '16px',
        right: 'auto',
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: 'transparent',
        paddingTop: '0px',
        zIndex: 20,
        gap: '32px',
        width: 'auto',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      } : {
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        gap: '0px'
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: isScrolled ? '0 0 auto' : '1 1 0%',
            paddingBottom: isScrolled ? '4px' : '12px',
            fontSize: isScrolled ? '12px' : '15px',
            letterSpacing: isScrolled ? '-0.025em' : 'normal',
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <span className={`${activeTab === tab 
            ? (isDark ? 'text-white font-normal' : 'text-[#111111] font-normal') 
            : (isDark ? 'text-white/40 font-light' : 'text-[#8A8A8A] font-light')}`}>
            {tab}
          </span>
          {activeTab === tab && (
            <motion.div
              layoutId="active-tab"
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E91E63]"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </nav>
  );
}
