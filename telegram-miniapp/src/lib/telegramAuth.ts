import crypto from 'crypto';

/**
 * Validates the Telegram initData string using the Bot Token.
 * @param initData The raw initData string from Telegram Web App
 * @param botToken The secret bot token from BotFather
 * @returns boolean indicating if the data is valid
 */
export function validateTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) return false;
    
    urlParams.delete('hash');
    urlParams.sort();
    
    let dataCheckString = '';
    for (const [key, value] of urlParams.entries()) {
      dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1); // remove last newline

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch (e) {
    console.error('Error validating Telegram data:', e);
    return false;
  }
}

/**
 * Parses the initData to extract the user object.
 * @param initData The raw initData string
 * @returns The parsed user object or null
 */
export function parseTelegramUser(initData: string): any {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}
