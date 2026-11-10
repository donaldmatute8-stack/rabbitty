'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@rabbitty/ui';

export function PremiumHero({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  right,
  children,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[28px] border p-5"
      style={{
        borderColor: 'rgba(233,30,99,.28)',
        background: 'linear-gradient(145deg, rgba(233,30,99,.18) 0%, rgba(28,8,20,.94) 52%, rgba(7,3,8,1) 100%)',
        boxShadow: '0 18px 40px -24px rgba(233,30,99,.55)',
      }}
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#E91E63]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-[#7C3AED]/20 blur-3xl" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E91E63]/30 bg-[#E91E63]/15 text-[#FF5FA8]">
                <Icon size={20} strokeWidth={2.1} />
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF5FA8]/80">{eyebrow}</p>
              )}
              <h1 className="truncate text-[20px] font-black leading-tight text-white">{title}</h1>
              {subtitle && <p className="mt-0.5 text-[11px] text-white/50">{subtitle}</p>}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

export function PremiumSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-1">
          {title && <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--text-muted)">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PremiumCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-elevated)', className)}>
      {children}
    </div>
  );
}

export function PremiumRow({
  icon,
  title,
  desc,
  href,
  onClick,
  trailing,
  className,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  className?: string;
}) {
  const content = (
    <>
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--border-subtle) bg-white/[.04] text-[#E91E63]">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold text-(--text-primary)">{title}</span>
        {desc && <span className="block text-[10px] text-(--text-muted)">{desc}</span>}
      </span>
      {trailing ?? <ChevronRight size={15} className="text-(--text-muted)" />}
    </>
  );

  const cls = cn('flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-(--bg-pressed)', className);

  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

export function PremiumStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'green' | 'rose' | 'blue';
}) {
  const colors = {
    default: 'text-(--text-primary)',
    green: 'text-emerald-300',
    rose: 'text-rose-300',
    blue: 'text-sky-300',
  };
  return (
    <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-3 py-2.5 text-center">
      <p className={cn('text-[15px] font-black', colors[tone])}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">{label}</p>
    </div>
  );
}
