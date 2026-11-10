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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-(--border-subtle) bg-white/[.06] text-(--text-primary)">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-extrabold text-(--text-primary)">{title}</h3>
      <p className="mb-6 max-w-[240px] text-sm text-(--text-muted)">{description}</p>
      {action}
    </motion.div>
  );
}
