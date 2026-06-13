const FNG_URL = 'https://api.alternative.me/fng/?limit=1';

export interface FearGreedData {
  value: number;
  classification: string;
}

export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    const res = await fetch(FNG_URL);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.data?.[0];
    if (!item) return null;
    return {
      value: parseInt(item.value, 10),
      classification: item.value_classification ?? 'Neutral',
    };
  } catch {
    return null;
  }
}
