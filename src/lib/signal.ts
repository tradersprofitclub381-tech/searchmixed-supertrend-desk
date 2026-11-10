export type Direction = "buy" | "sell";
export type Phase = "open" | "tp1" | "tp2";
export type MarketName = "Forex" | "Synthetic" | "Crypto" | "Metals" | "Index";

export type Candle = {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Meta = {
  symbol: string;
  displayName: string;
  market: MarketName;
  pip: number;
  digits: number;
};

export type Quote = Meta & {
  direction: Direction;
  price: number;
  entry: number;
  sl: number;
  trail: number;
  tp1: number;
  tp2: number;
  atr: number;
  signalEpoch: number;
  phase: Phase;
  quoteEpoch: number;
};

export const TIMEFRAMES = [
  { id: 60, label: "1m" },
  { id: 300, label: "5m" },
  { id: 900, label: "15m" },
  { id: 3600, label: "1h" },
  { id: 14400, label: "4h" },
  { id: 86400, label: "1d" },
] as const;

export const MARKETS: Array<"All" | MarketName> = [
  "All",
  "Forex",
  "Synthetic",
  "Crypto",
  "Metals",
  "Index",
];

export const ATR_PERIODS = [7, 10, 14] as const;
export const ATR_MULTIPLIERS = [2, 2.5, 3, 4] as const;

export function isTimeframe(value: number): boolean {
  return TIMEFRAMES.some((item) => item.id === value);
}

export function isPeriod(value: number): boolean {
  return ATR_PERIODS.some((item) => item === value);
}

export function isMultiplier(value: number): boolean {
  return ATR_MULTIPLIERS.some((item) => item === value);
}
