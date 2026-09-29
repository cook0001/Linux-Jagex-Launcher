import { spawn } from 'child_process';

export interface WorldPingResult {
  game: 'rs3' | 'osrs';
  world: number;
  serverSubId?: number;
  hostname: string;
  ping: number;
  region: string;
  flag: string;
}

function detectRegionFromHostOrOutput(output: string): { region: string; flag: string } {
  const lower = output.toLowerCase();
  if (lower.includes('ushe') || lower.includes('virginia') || lower.includes('ashburn') || lower.includes('east')) {
    return { region: 'US East', flag: '🇺🇸' };
  }
  if (lower.includes('usla') || lower.includes('losangeles') || lower.includes('west')) {
    return { region: 'US West', flag: '🇺🇸' };
  }
  if (lower.includes('uksl') || lower.includes('l3uk') || lower.includes('slough') || lower.includes('london')) {
    return { region: 'United Kingdom', flag: '🇬🇧' };
  }
  if (lower.includes('defr') || lower.includes('l3de') || lower.includes('frankfurt')) {
    return { region: 'Germany', flag: '🇩🇪' };
  }
  if (lower.includes('aus') || lower.includes('l3au') || lower.includes('sydney')) {
    return { region: 'Australia', flag: '🇦🇺' };
  }
  return { region: 'Global', flag: '🌐' };
}

async function asyncPool<T, R>(poolLimit: number, items: T[], iteratorFn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = [];
  const executing: Set<Promise<any>> = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p as any);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(ret);
}

export class WorldPingManager {
  private isPinging: boolean = false;

  public isBusy(): boolean {
    return this.isPinging;
  }

  public async pingHost(hostname: string): Promise<{ ping: number; rawOutput: string } | null> {
    if (!hostname || typeof hostname !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(hostname) || hostname.startsWith('-')) {
      return null;
    }

    return new Promise((resolve) => {
      const isMac = process.platform === 'darwin';
      const args = isMac
        ? ['-c', '1', '-t', '1', hostname]
        : ['-c', '1', '-W', '1', hostname];

      const proc = spawn('ping', args);
      let out = '';

      proc.stdout.on('data', (d) => { out += d; });
      proc.stderr.on('data', (d) => { out += d; });

      proc.on('close', (code) => {
        if (code !== 0) return resolve(null);
        const avgMatch = out.match(/(?:min\/avg\/max|rtt)[^=]*=\s*[\d.]+\/([\d.]+)\//i);
        const timeMatch = out.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i);
        const ping = avgMatch ? parseFloat(avgMatch[1]) : (timeMatch ? parseFloat(timeMatch[1]) : null);
        if (ping === null || isNaN(ping)) return resolve(null);
        resolve({ ping: Math.round(ping * 10) / 10, rawOutput: out });
      });

      proc.on('error', () => resolve(null));
    });
  }

  /**
   * Pings RS3 game worlds (1..141) in parallel
   */
  public async pingRs3Worlds(worldIds?: number[]): Promise<WorldPingResult[]> {
    this.isPinging = true;
    try {
      const targetIds = worldIds && worldIds.length > 0
        ? worldIds
        : Array.from({ length: 141 }, (_, i) => i + 1);

      const probeWorld = async (w: number): Promise<WorldPingResult | null> => {
        const hostname = `world${w}.runescape.com`;
        const res = await this.pingHost(hostname);
        if (!res) return null;
        const { region, flag } = detectRegionFromHostOrOutput(res.rawOutput);
        return {
          game: 'rs3',
          world: w,
          hostname,
          ping: res.ping,
          region,
          flag
        };
      };

      const results = await asyncPool(25, targetIds, probeWorld);
      return results
        .filter((r): r is WorldPingResult => r !== null)
        .sort((a, b) => a.ping - b.ping);
    } finally {
      this.isPinging = false;
    }
  }

  /**
   * Pings OSRS game worlds (where in-game world = 300 + subId) in parallel
   */
  public async pingOsrsWorlds(subIds?: number[]): Promise<WorldPingResult[]> {
    this.isPinging = true;
    try {
      // Common OSRS world sub-IDs up to 295 (Worlds 301..595)
      const targetSubIds = subIds && subIds.length > 0
        ? subIds
        : Array.from({ length: 295 }, (_, i) => i + 1);

      const probeOsrsWorld = async (sub: number): Promise<WorldPingResult | null> => {
        const hostname = `oldschool${sub}.runescape.com`;
        const res = await this.pingHost(hostname);
        if (!res) return null;
        const inGameWorld = 300 + sub;
        const { region, flag } = detectRegionFromHostOrOutput(res.rawOutput);
        return {
          game: 'osrs',
          world: inGameWorld,
          serverSubId: sub,
          hostname,
          ping: res.ping,
          region,
          flag
        };
      };

      const results = await asyncPool(25, targetSubIds, probeOsrsWorld);
      return results
        .filter((r): r is WorldPingResult => r !== null)
        .sort((a, b) => a.ping - b.ping);
    } finally {
      this.isPinging = false;
    }
  }
}

export const worldPing = new WorldPingManager();
