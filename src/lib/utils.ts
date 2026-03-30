import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Timing & Delays
// ---------------------------------------------------------------------------

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(min: number, max: number): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

// ---------------------------------------------------------------------------
// Address / City Extraction (German format)
// ---------------------------------------------------------------------------

/**
 * Extract city from a German formatted address.
 * Handles "Straße 123, 45678 Stadtname, Deutschland" etc.
 */
export function extractCity(address: string, fallbackCity: string): string {
  if (!address) return fallbackCity;

  // German format: "Straße 123, 45678 Stadtname, Deutschland"
  const plzMatch = address.match(/\d{5}\s+([\wäöüÄÖÜß]+(?:\s+(?:am|an|im|bei|ob)\s+[\wäöüÄÖÜß]+)?)/i);
  if (plzMatch) return plzMatch[1].trim();

  // Try city from comma-separated parts (second-to-last part often is the city)
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2] || parts[parts.length - 1];
    const cityFromPart = cityPart.replace(/^\d{5}\s*/, '').trim();
    if (cityFromPart.length >= 2 && cityFromPart !== 'Deutschland') {
      return cityFromPart;
    }
  }

  return fallbackCity;
}

// ---------------------------------------------------------------------------
// Website Normalization
// ---------------------------------------------------------------------------

export function normalizeWebsite(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').toLowerCase().split('/')[0];
  }
}

// ---------------------------------------------------------------------------
// Password Hashing (PBKDF2, 100k iterations, SHA-512)
// ---------------------------------------------------------------------------

/**
 * Hash a password. Returns "salt:hash" string for storage.
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify a password against a stored "salt:hash" string.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const { hash: computed } = hashPassword(password, salt);
  return timingSafeEqual(computed, hash);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
