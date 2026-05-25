'use client';

import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-[#111111] mb-2">{title}</h3>
      <p className="text-sm text-[#8A8A8A] mb-6 max-w-[240px]">{description}</p>
      {action}
    </motion.div>
  );
}
