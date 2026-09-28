export const CLEAN_USER_AGENT = process.platform === 'darwin'
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36'
  : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.130 Safari/537.36';

/**
 * Accurately determines if a Jagex character has an active membership subscription.
 * Checks API payload entitlements, and falls back to verifying active status via official RuneScape hiscores.
 */
export async function checkMembershipStatus(displayName: string, item: any, timeoutMs = 2500): Promise<boolean> {
  // 1. Explicit API boolean flag if present
  if (typeof item?.isMember === 'boolean') {
    return item.isMember;
  }

  // 2. Direct API membership entitlements array/object
  if (Array.isArray(item?.membership) && item.membership.length > 0) {
    return true;
  }
  if (item?.membership && typeof item.membership === 'object' && Object.keys(item.membership).length > 0) {
    return true;
  }

  // 3. Fallback verification: RuneScape 3 Hiscores
  // In RuneScape 3, Free-to-Play accounts are excluded from hiscores;
  // only accounts with an active membership subscription are returned.
  if (!displayName || displayName === 'Character') {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`https://secure.runescape.com/m=hiscore/index_lite.ws?player=${encodeURIComponent(displayName)}`, {
      headers: { 'User-Agent': CLEAN_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const firstLine = text.trim().split('\n')[0];
      const parts = firstLine.split(',');
      if (parts.length >= 3 && parseInt(parts[0], 10) > 0) {
        return true;
      }
    }
  } catch {
    // Abort or network failure -> fall back to false (Free to Play)
  }

  return false;
}
