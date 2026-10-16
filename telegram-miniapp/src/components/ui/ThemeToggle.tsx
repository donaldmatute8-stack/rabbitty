'use client';

import { Moon, Sun, Smartphone } from 'lucide-react';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { PlatformBridge } from '@/lib/platform';

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Auto', Icon: Smartphone },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className="flex items-center gap-1 p-0.5 rounded-xl"
      style={{ background: 'transparent', border: '1px solid var(--border-subtle)' }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setTheme(value);
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[12px] font-bold transition-all active:scale-[0.97] cursor-pointer border-none"
            style={{
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Icon size={13} strokeWidth={2.4} color={isActive ? '#E91E63' : 'currentColor'} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
