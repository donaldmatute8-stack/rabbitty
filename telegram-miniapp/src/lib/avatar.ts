'use client';

import { useState, useEffect } from 'react';
import type { UserProfile } from '@/features/auth/AuthProvider';

export const AVATAR_UPDATED_EVENT = 'rabbitty:avatar-updated';

export function getStoredAvatar(userId?: string | null): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    return localStorage.getItem(`rabbitty_avatar_${userId}`);
  } catch {
    return null;
  }
}

export function setStoredAvatar(userId: string, avatarUrl: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.setItem(`rabbitty_avatar_${userId}`, avatarUrl);
    window.dispatchEvent(
      new CustomEvent(AVATAR_UPDATED_EVENT, {
        detail: { userId, avatarUrl },
      })
    );
  } catch (e) {
    console.error('Failed to store avatar:', e);
  }
}

export function getDefaultAvatarUrl(name?: string | null, bg: string = 'E91E63'): string {
  const seed = encodeURIComponent(name || 'Rabbitty');
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=${bg}`;
}

export function useUserAvatar(user?: UserProfile | null, defaultBg: string = 'E91E63'): string {
  const [avatar, setAvatar] = useState<string>(() => {
    return getStoredAvatar(user?.id) || getDefaultAvatarUrl(user?.firstName, defaultBg);
  });

  useEffect(() => {
    const current = getStoredAvatar(user?.id) || getDefaultAvatarUrl(user?.firstName, defaultBg);
    setAvatar(current);

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId: string; avatarUrl: string }>;
      if (!user?.id || (customEvent.detail && customEvent.detail.userId === user.id)) {
        const updated = customEvent.detail?.avatarUrl || getStoredAvatar(user?.id) || getDefaultAvatarUrl(user?.firstName, defaultBg);
        setAvatar(updated);
      }
    };

    window.addEventListener(AVATAR_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user?.id, user?.firstName, defaultBg]);

  return avatar;
}
