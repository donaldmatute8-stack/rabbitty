// Telegram WebApp Auth Service
// Validación de initData y generación de JWT

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
}

interface WebAppInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: any;
  start_param?: string;
  can_send_after?: number;
    auth_date: number;
    hash: string;
}

// Validar initData de Telegram
// NOTA: La validación real SIEMPRE debe hacerse server-side.
// Esta función client-side es solo una cortesía — NO confiar en ella para seguridad.
export function validateTelegramWebAppData(initData: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    return true;
  } catch {
    return false;
  }
}

// Extraer usuario de initData
export function extractUserFromInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    
    if (!userJson) return null;
    
    return JSON.parse(decodeURIComponent(userJson));
  } catch (error) {
    console.error('Error extracting user:', error);
    return null;
  }
}

// Guardar JWT en localStorage
export function saveToken(token: string): void {
  localStorage.setItem('jwt_token', token);
}

// Obtener JWT de localStorage
export function getToken(): string | null {
  return localStorage.getItem('jwt_token');
}

// Eliminar JWT (logout)
export function removeToken(): void {
  localStorage.removeItem('jwt_token');
}

// Verificar si token está expirado
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Auth service
export const authService = {
  // Login con Telegram
  async loginWithTelegram(initData: string): Promise<{ token: string; user: TelegramUser }> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    
    const data = await response.json();
    saveToken(data.token);
    
    return data;
  },
  
  // Refresh token
  async refreshToken(): Promise<string> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Refresh failed');
    }
    
    const data = await response.json();
    saveToken(data.token);
    
    return data.token;
  },
  
  // Logout
  logout(): void {
    removeToken();
  },
  
  // Check if authenticated
  isAuthenticated(): boolean {
    const token = getToken();
    return !!token && !isTokenExpired(token);
  },
};

// Haptic feedback (vibración)
export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium'): void {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    (window as any).Telegram.WebApp.HapticFeedback.impactOccurred(type);
  }
}

// Native alerts removed in favor of React ToastContext

// Show confirm nativo de Telegram
export function showConfirm(message: string): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return new Promise((resolve) => {
      (window as any).Telegram.WebApp.showConfirm(message, resolve);
    });
  }
  return Promise.resolve(confirm(message));
}

// Expand WebApp to full screen
export function expandWebApp(): void {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    (window as any).Telegram.WebApp.expand();
  }
}
