'use client';

import { motion } from 'framer-motion';

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <nav className="flex items-center gap-6 px-4 pt-4 bg-white">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`pb-2 relative text-[14px] transition-colors ${
            activeTab === tab ? 'text-[#111111] font-medium' : 'text-[#8A8A8A] font-normal'
          }`}
        >
          {tab}
          {activeTab === tab && (
            <motion.div
              layoutId="active-tab"
              className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#E91E63]"
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </nav>
  );
}
