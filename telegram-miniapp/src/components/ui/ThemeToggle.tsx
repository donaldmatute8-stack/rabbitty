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
      className="flex items-center gap-1 p-1 rounded-[14px]"
      style={{ background: 'var(--bg-pressed)', border: '1px solid var(--border-subtle)' }}
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[11px] text-[13px] font-bold transition-all active:scale-[0.97] cursor-pointer border-none"
            style={{
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Icon size={15} strokeWidth={2.4} color={isActive ? '#E91E63' : 'currentColor'} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
