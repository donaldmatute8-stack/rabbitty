'use client';

import { Toaster as Sonner, toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ToastProps {
  position?: 'top-center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function Toaster({ position = 'top-center', className }: ToastProps) {
  return (
    <Sonner
      position={position}
      toastOptions={{
        classNames: {
          toast: cn(
            'group rounded-[var(--radius-lg)] border border-[var(--border-default)]',
            'bg-[var(--bg-elevated)] text-[var(--text-primary)]',
            'shadow-[var(--shadow-lg)] p-4 gap-3',
            'data-[type=success]:border-l-4 data-[type=success]:border-l-[var(--success)]',
            'data-[type=error]:border-l-4 data-[type=error]:border-l-[var(--error)]',
            'data-[type=warning]:border-l-4 data-[type=warning]:border-l-[var(--warning)]',
            'data-[type=info]:border-l-4 data-[type=info]:border-l-[var(--info)]',
            className
          ),
          title: 'text-[var(--text-body)] font-semibold',
          description: 'text-[var(--text-caption)] text-[var(--text-muted)]',
          actionButton: 'bg-[var(--rabbitty-pink)] text-white text-[var(--text-small)] font-medium px-3 py-1.5 rounded-[var(--radius-md)]',
          cancelButton: 'text-[var(--text-muted)] text-[var(--text-small)] hover:text-[var(--text-primary)]',
          closeButton: 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
        },
      }}
      duration={4000}
      closeButton
      richColors
      visibleToasts={3}
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
