/** Binance REST rate-limit idarəçisi — IP ban (418) qarşısını alır */

const WEIGHT_BUDGET_PER_MIN = 550;
const MIN_GAP_MS = 50;

let bannedUntil = 0;
let weightUsed = 0;
let windowStart = Date.now();
let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

export class BinanceBanError extends Error {
  readonly bannedUntil: number;
  constructor(until: number) {
    const mins = Math.ceil((until - Date.now()) / 60_000);
    super(`Binance IP müvəqqəti bloklanıb. ~${mins} dəq gözləyin və ya VPN/IP dəyişin.`);
    this.name = 'BinanceBanError';
    this.bannedUntil = until;
  }
}

export function isBinanceBanned(): boolean {
  return Date.now() < bannedUntil;
}

export function getBinanceBanUntil(): number {
  return bannedUntil;
}

function resetWindowIfNeeded() {
  if (Date.now() - windowStart >= 60_000) {
    windowStart = Date.now();
    weightUsed = 0;
  }
}

function parseBanUntil(body: string): number | null {
  try {
    const json = JSON.parse(body) as { msg?: string; code?: number };
    if (json.code !== -1003 || !json.msg) return null;
    const m = json.msg.match(/until (\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch {
    return null;
  }
}

function klineWeight(limit: number): number {
  if (limit <= 100) return 1;
  if (limit <= 500) return 2;
  return 5;
}

export function estimateKlineWeight(limit: number, timeframeCount: number): number {
  return klineWeight(limit) * timeframeCount;
}

async function waitForSlot(weight: number): Promise<void> {
  if (isBinanceBanned()) {
    throw new BinanceBanError(bannedUntil);
  }

  resetWindowIfNeeded();

  if (weightUsed + weight > WEIGHT_BUDGET_PER_MIN) {
    const wait = 60_000 - (Date.now() - windowStart) + 200;
    await sleep(wait);
    windowStart = Date.now();
    weightUsed = 0;
  }

  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_GAP_MS) {
    await sleep(MIN_GAP_MS - sinceLast);
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Bütün Binance REST sorğuları bu funksiyadan keçməlidir */
export async function binanceFetch(
  url: string,
  weight = 1,
): Promise<Response> {
  if (isBinanceBanned()) {
    throw new BinanceBanError(bannedUntil);
  }

  const run = async () => {
    await waitForSlot(weight);
    lastRequestAt = Date.now();
    weightUsed += weight;

    const res = await fetch(url);

    if (res.status === 418 || res.status === 429) {
      const body = await res.clone().text();
      const until = parseBanUntil(body);
      if (until && until > Date.now()) {
        bannedUntil = until;
        throw new BinanceBanError(until);
      }
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '30', 10);
      bannedUntil = Date.now() + Math.max(retryAfter, 30) * 1000;
      throw new BinanceBanError(bannedUntil);
    }

    return res;
  };

  const result = queue.then(run, run);
  queue = result.then(() => {}, () => {});
  return result;
}
