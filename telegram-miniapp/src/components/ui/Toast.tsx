'use client';

/**
 * Toaster de sonner con la identidad de Rabbitty.
 *
 * Se monta una sola vez en el layout. Lo usan las pantallas que llaman
 * `toast.*` directamente (cobro del escáner del negocio, QR del POS); antes el
 * <Toaster> no estaba montado y esos avisos nunca se veían.
 */

import { Toaster as Sonner, toast } from 'sonner';

interface ToastProps {
  position?: 'top-center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function Toaster({ position = 'top-center', className }: ToastProps) {
  return (
    <Sonner
      position={position}
      offset={76}
      gap={10}
      duration={4000}
      visibleToasts={3}
      closeButton={false}
      richColors={false}
      className={className}
      toastOptions={{
        style: {
          // Mismo cristal que los toasts de la app (ToastContext).
          background: 'color-mix(in srgb, var(--bg-elevated, #14101c) 82%, transparent)',
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          border: '1px solid color-mix(in srgb, var(--border-subtle, rgba(255,255,255,0.12)) 85%, transparent)',
          borderRadius: '20px',
          boxShadow: '0 18px 40px -22px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
          color: 'var(--text-primary, #ffffff)',
          padding: '12px 14px',
        },
        classNames: {
          title: 'text-[13.5px] font-semibold leading-snug',
          description: 'text-[11.5px] text-[var(--text-muted)]',
          actionButton:
            'bg-[var(--rabbitty-pink)] text-white text-[12px] font-bold px-3 py-1.5 rounded-xl',
          cancelButton: 'text-[var(--text-muted)] text-[12px] font-semibold',
        },
      }}
    />
  );
}

// Toast helpers
export function toastSuccess(message: string, description?: string) {
  toast.success(message, { description });
}

export function toastError(message: string, description?: string) {
  toast.error(message, { description });
}

export function toastWarning(message: string, description?: string) {
  toast.warning(message, { description });
}

export function toastInfo(message: string, description?: string) {
  toast.info(message, { description });
}

export function toastLoading(message: string) {
  return toast.loading(message);
}

export function toastPromise(promise: Promise<unknown>, messages: { loading: string; success: string; error: string }) {
  return toast.promise(promise, messages);
}
