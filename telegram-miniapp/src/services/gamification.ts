import { api } from "./api";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface UserLevel {
  id: string;
  name: string;
  level: number;
  minBunz: number;
  multiplier: number;
  color: string;
}

export async function getAchievements(userId: string): Promise<Achievement[]> {
  try {
    return await api.users.me() as unknown as Achievement[];
  } catch {
    return [];
  }
}

export async function checkAchievements(userId: string): Promise<Achievement[]> {
  try {
    const data = await api.users.me() as any;
    return data?.achievements ?? [];
  } catch {
    return [];
  }
}

export async function getUserLevel(userId: string): Promise<UserLevel | null> {
  try {
    const data = await api.users.me() as any;
    return data?.level ?? null;
  } catch {
    return null;
  }
}
