// Servicio API para Rabbitty
// Este archivo conecta el frontend con el backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rabbitty.com/v1';

// Helper para requests
async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('jwt_token');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  // Auth
  auth: {
    telegram: (initData: string) => 
      fetchWithAuth('/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      }),
    
    refresh: () =>
      fetchWithAuth('/auth/refresh', {
        method: 'POST',
      }),
  },
  
  // Users
  users: {
    me: () => fetchWithAuth('/users/me'),
    
    update: (data: any) =>
      fetchWithAuth('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    
    balance: () => fetchWithAuth('/users/me/balance'),
    
    feed: () => fetchWithAuth('/users/me/feed'),
    
    history: () => fetchWithAuth('/users/me/history'),
    
    referrals: () => fetchWithAuth('/users/me/referrals'),
    
    createReferral: () =>
      fetchWithAuth('/users/me/referrals', {
        method: 'POST',
      }),
  },
  
  // Businesses
  businesses: {
    list: () => fetchWithAuth('/businesses'),
    
    nearby: (lat: number, lng: number, radius: number = 5000) =>
      fetchWithAuth(`/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    
    get: (id: string) => fetchWithAuth(`/businesses/${id}`),
    
    updateRate: (id: string, rate: number) =>
      fetchWithAuth(`/businesses/${id}/rate`, {
        method: 'PATCH',
        body: JSON.stringify({ rate }),
      }),
    
    analytics: (id: string) => fetchWithAuth(`/businesses/${id}/analytics`),
    
    generateQR: (id: string) =>
      fetchWithAuth(`/businesses/${id}/qr`, {
        method: 'POST',
      }),
  },
  
  // Transactions
  transactions: {
    scan: (businessId: string, qrData: string) =>
      fetchWithAuth('/transactions/scan', {
        method: 'POST',
        body: JSON.stringify({ businessId, qrData }),
      }),
    
    pay: (businessId: string, amount: number) =>
      fetchWithAuth('/transactions/pay', {
        method: 'POST',
        body: JSON.stringify({ businessId, amount }),
      }),
    
    receipt: (id: string) => fetchWithAuth(`/transactions/${id}/receipt`),
  },
  
  // Feed / Social
  feed: {
    get: (tab: string = "bunz'in") =>
      fetchWithAuth(`/feed?tab=${tab}`),
    
    like: (postId: string) =>
      fetchWithAuth(`/feed/${postId}/like`, {
        method: 'POST',
      }),
    
    comment: (postId: string, text: string) =>
      fetchWithAuth(`/feed/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
  },
  
  // Discover
  discover: {
    categories: () => fetchWithAuth('/discover/categories'),
    
    trending: () => fetchWithAuth('/discover/trending'),
    
    nearby: (lat: number, lng: number) =>
      fetchWithAuth(`/discover/nearby?lat=${lat}&lng=${lng}`),
    
    search: (query: string) =>
      fetchWithAuth(`/discover/search?q=${encodeURIComponent(query)}`),
  },
};

// WebSocket para notificaciones en tiempo real
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  connect(token: string) {
    const wsUrl = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');
    this.ws = new WebSocket(`${wsUrl}/ws?token=${token}`);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Dispatch custom events
      window.dispatchEvent(new CustomEvent('ws:message', { detail: data }));
    };
    
    this.ws.onclose = () => {
      // Reconectar después de 5 segundos
      this.reconnectTimer = setTimeout(() => this.connect(token), 5000);
    };
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}

// Analytics tracking
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    // Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, properties);
    }
    
    // Telegram WebApp events
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.sendData(JSON.stringify({ event, properties }));
    }
    
    // Backend analytics
    fetchWithAuth('/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ event, properties, timestamp: new Date().toISOString() }),
    }).catch(() => {}); // Non-blocking
  },
  
  pageView: (page: string) => analytics.track('page_view', { page }),
  
  bunzEarned: (amount: number, business: string) =>
    analytics.track('bunz_earned', { amount, business }),
  
  bunzSpent: (amount: number, business: string) =>
    analytics.track('bunz_spent', { amount, business }),
  
  referral: (code: string, source: string) =>
    analytics.track('referral_used', { code, source }),
};
