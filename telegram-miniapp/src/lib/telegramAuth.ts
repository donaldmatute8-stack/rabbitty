import crypto from 'crypto';

/**
 * Validates the Telegram initData string using the Bot Token.
 * @param initData The raw initData string from Telegram Web App
 * @param botToken The secret bot token from BotFather
 * @returns boolean indicating if the data is valid
 */
export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) return false;

    if (maxAgeSeconds > 0) {
      const authDateRaw = urlParams.get('auth_date');
      const authDate = authDateRaw && /^\d+$/.test(authDateRaw) ? Number(authDateRaw) : null;
      if (authDate === null) return false;
      if (authDate * 1000 + maxAgeSeconds * 1000 < Date.now()) return false;
    }

    urlParams.delete('hash');
    urlParams.sort();
    
    let dataCheckString = '';
    for (const [key, value] of urlParams.entries()) {
      dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1); // remove last newline

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const calcBuf = Buffer.from(calculatedHash, 'hex');
    const recvBuf = Buffer.from(hash, 'hex');
    if (calcBuf.length !== recvBuf.length) return false;
    return crypto.timingSafeEqual(calcBuf, recvBuf);
  } catch (e) {
    console.error('Error validating Telegram data:', e);
    return false;
  }
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Parses the initData to extract the user object.
 * @param initData The raw initData string
 * @returns The parsed user object or null
 */
export function parseTelegramUser(initData: string): TelegramUser | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}
