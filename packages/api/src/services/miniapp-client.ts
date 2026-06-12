interface MiniappConfig {
  url: string;
  apiSecret: string;
}

let config: MiniappConfig | null = null;

export function configureMiniapp(url: string, apiSecret: string) {
  config = { url: url.replace(/\/$/, ""), apiSecret };
}

export function getMiniappConfig() {
  return config;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!config) {
    const url = process.env.RABBITTY_MINIAPP_URL;
    const secret = process.env.RABBITTY_API_SECRET;
    if (url && secret) {
      config = { url: url.replace(/\/$/, ""), apiSecret: secret };
    } else {
      throw new Error(
        "Miniapp no configurada. Define RABBITTY_MINIAPP_URL y RABBITTY_API_SECRET o llama a configureMiniapp()."
      );
    }
  }

  const res = await fetch(`${config.url}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiSecret}`,
      ...(options.headers as Record<string, string>),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Miniapp API error (${res.status}): ${body.slice(0, 200)}`
    );
  }

  return res.json();
}

export interface RewardResult {
  success: boolean;
  message: string;
  bunz: number;
  expiresAt?: string;
  userId?: string;
}

export interface ChargeResult {
  success: boolean;
  message: string;
  balance_remaining: number;
}

export interface Transaction {
  id: string;
  fiatAmount: number;
  bunzMinted: number;
  status: string;
  createdAt: string;
  userFirstName?: string;
  businessName?: string;
  businessCategory?: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  description?: string;
  address: string;
  lat: number;
  lng: number;
  rewardPercentage: number;
  rarity: string;
  givesBunz: boolean;
  acceptsBunz: boolean;
  status: string;
}

export interface Gamification {
  hops: number;
  level: { id: string; name: string; requiredHops: number; bunzMultiplier: number } | null;
  achievements: Array<{
    id: string; name: string; description: string; iconUrl: string;
    unlocked: boolean; unlockedAt: string | null;
  }>;
  missions: Array<{
    id: string; title: string; description: string;
    progressValue: number; isCompleted: boolean;
  }>;
}

export interface FeedItem {
  id: string;
  user: string;
  category: string;
  bunz: number;
  givesBunz: boolean;
  acceptsBunz: boolean;
  lat: number;
  lng: number;
}

export interface MintResult {
  success: boolean;
  bunzRewarded: number;
}

export interface ReservationResult {
  success: boolean;
  reservation?: { id: string; status: string };
}

export interface NotificationResult {
  success: boolean;
  notification?: { id: string };
}

export const miniappClient = {
  async rewardBunz(phone: string, amountUsd: number, orderId?: string, businessId?: string): Promise<RewardResult> {
    return fetchApi("/api/pos/reward", {
      method: "POST",
      body: JSON.stringify({ phone, amount_usd: amountUsd, order_id: orderId, business_id: businessId, source: "rabbitty_pos" }),
    });
  },

  async chargeBunz(rabbittyId: string, amountUsd: number, orderId?: string, businessId?: string): Promise<ChargeResult> {
    return fetchApi("/api/pos/charge", {
      method: "POST",
      body: JSON.stringify({ rabbitty_id: rabbittyId, amount_usd: amountUsd, order_id: orderId, business_id: businessId }),
    });
  },

  async getBusinessTransactions(telegramId?: string, businessId?: string): Promise<{ success: boolean; transactions: Transaction[] }> {
    const params = new URLSearchParams();
    if (telegramId) params.set("telegramId", telegramId);
    if (businessId) params.set("businessId", businessId);
    return fetchApi(`/api/business/transactions?${params}`);
  },

  async getHistory(telegramId: string): Promise<{ success: boolean; history: Transaction[] }> {
    return fetchApi(`/api/history?telegramId=${encodeURIComponent(telegramId)}`);
  },

  async getGamification(userId: string): Promise<{ success: boolean } & Gamification> {
    return fetchApi(`/api/gamification?userId=${encodeURIComponent(userId)}`);
  },

  async getBusiness(telegramId?: string, wallet?: string): Promise<{ success: boolean; business: Business | null }> {
    const params = new URLSearchParams();
    if (telegramId) params.set("telegramId", telegramId);
    if (wallet) params.set("wallet", wallet);
    return fetchApi(`/api/business?${params}`);
  },

  async createBusiness(data: {
    name: string; description?: string; category: string; address: string;
    rewardPercentage: number; telegramId: string;
  }): Promise<{ success: boolean; business: Business }> {
    return fetchApi("/api/business", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async mintBunz(telegramId: string, businessId: string, fiatAmount: number): Promise<MintResult> {
    return fetchApi("/api/business/scan/mint", {
      method: "POST",
      body: JSON.stringify({ telegramId, businessId, fiatAmount }),
    });
  },

  async getFeed(): Promise<{ success: boolean; data: FeedItem[] }> {
    return fetchApi("/api/feed");
  },

  async testConnection(): Promise<boolean> {
    try {
      await fetchApi("/api/feed", { method: "GET" });
      return true;
    } catch {
      return false;
    }
  },

  async createReservation(data: {
    telegramId: string; businessName: string; offerTitle: string; bunzCost: number;
  }): Promise<ReservationResult> {
    return fetchApi("/api/reservations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async sendNotification(data: {
    userId: string; title: string; message: string; type?: string;
  }): Promise<NotificationResult> {
    return fetchApi("/api/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async lookupUserByPhone(phone: string): Promise<{ exists: boolean; userId?: string }> {
    try {
      const res = await fetch(`${config!.url}/api/pos/reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config!.apiSecret}`,
        },
        body: JSON.stringify({ phone, amount_usd: 1, source: "lookup" }),
      });
      const data = await res.json();
      return { exists: data.success, userId: data.userId };
    } catch {
      return { exists: false };
    }
  },

  async generateQRSession(): Promise<{ success: boolean; sessionId: string; qrToken: string; expiresAt: string }> {
    return fetchApi("/api/auth/qr/generate", { method: "POST" });
  },

  async pollQRSession(sessionId: string): Promise<{ success: boolean; authenticated: boolean; user?: { id: string; telegramId: string; username?: string }; expired?: boolean }> {
    return fetchApi(`/api/auth/qr/poll?sessionId=${encodeURIComponent(sessionId)}`);
  },
};
