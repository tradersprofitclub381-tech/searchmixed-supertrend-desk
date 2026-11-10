import type { Candle, Direction, Meta, Phase, Quote } from "@/lib/signal";

export type SuperPoint = {
  st: number;
  trend: 1 | -1;
  atr: number;
};

function wilderAtr(candles: Candle[], period: number): number[] {
  const atr = new Array<number>(candles.length).fill(Number.NaN);
  if (candles.length < period) return atr;

  const tr = new Array<number>(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i];
    if (!bar) continue;
    if (i === 0) {
      tr[i] = bar.high - bar.low;
      continue;
    }
    const prevClose = candles[i - 1]?.close ?? bar.close;
    tr[i] = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose),
    );
  }

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i] ?? 0;
  atr[period - 1] = sum / period;
  for (let i = period; i < candles.length; i++) {
    atr[i] = ((atr[i - 1] ?? 0) * (period - 1) + (tr[i] ?? 0)) / period;
  }
  return atr;
}

/** Classic Supertrend: ATR bands, trailing only in the trend direction. */
export function computeSupertrend(
  candles: Candle[],
  period: number,
  multiplier: number,
): Array<SuperPoint | null> {
  const atrs = wilderAtr(candles, period);
  const points: Array<SuperPoint | null> = new Array(candles.length).fill(null);
  let finalUpper = Number.NaN;
  let finalLower = Number.NaN;
  let st = Number.NaN;

  for (let i = 0; i < candles.length; i++) {
    const atr = atrs[i];
    const bar = candles[i];
    if (!bar || atr === undefined || !Number.isFinite(atr)) continue;

    const mid = (bar.high + bar.low) / 2;
    const basicUpper = mid + multiplier * atr;
    const basicLower = mid - multiplier * atr;

    if (!Number.isFinite(finalUpper)) {
      finalUpper = basicUpper;
      finalLower = basicLower;
      const trend: 1 | -1 = bar.close >= mid ? 1 : -1;
      st = trend === 1 ? finalLower : finalUpper;
      points[i] = { st, trend, atr };
      continue;
    }

    const prevUpper = finalUpper;
    const prevLower = finalLower;
    const prevClose = candles[i - 1]?.close ?? bar.close;
    finalUpper = basicUpper < prevUpper || prevClose > prevUpper ? basicUpper : prevUpper;
    finalLower = basicLower > prevLower || prevClose < prevLower ? basicLower : prevLower;

    const prevSt = st;
    let trend: 1 | -1;
    if (prevSt === prevUpper) {
      trend = bar.close <= finalUpper ? -1 : 1;
    } else {
      trend = bar.close >= finalLower ? 1 : -1;
    }
    st = trend === 1 ? finalLower : finalUpper;
    points[i] = { st, trend, atr };
  }

  return points;
}

export function buildQuote(
  meta: Meta,
  candles: Candle[],
  period: number,
  multiplier: number,
  quoteEpoch?: number,
): Quote | null {
  if (candles.length < period + 5) return null;
  const points = computeSupertrend(candles, period, multiplier);
  let last = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]) {
      last = i;
      break;
    }
  }
  const current = last >= 0 ? points[last] : null;
  const lastBar = candles[last];
  if (!current || !lastBar) return null;

  const direction: Direction = current.trend === 1 ? "buy" : "sell";
  let flip = last;
  while (flip > 0 && points[flip - 1]?.trend === current.trend) flip -= 1;
  const flipBar = candles[flip];
  const flipPoint = points[flip];
  if (!flipBar || !flipPoint) return null;

  const entry = flipBar.close;
  let sl = flipPoint.st;
  if (direction === "buy" && sl >= entry) sl = entry - current.atr * multiplier;
  if (direction === "sell" && sl <= entry) sl = entry + current.atr * multiplier;
  const risk = Math.abs(entry - sl);
  if (!Number.isFinite(risk) || risk <= 0) return null;

  const sign = direction === "buy" ? 1 : -1;
  const tp1 = entry + sign * risk * 1.5;
  const tp2 = entry + sign * risk * 2.5;
  const price = lastBar.close;
  let phase: Phase = "open";
  if (direction === "buy") {
    if (price >= tp2) phase = "tp2";
    else if (price >= tp1) phase = "tp1";
  } else if (price <= tp2) phase = "tp2";
  else if (price <= tp1) phase = "tp1";

  return {
    ...meta,
    direction,
    price,
    entry,
    sl,
    trail: current.st,
    tp1,
    tp2,
    atr: current.atr,
    signalEpoch: flipBar.epoch,
    phase,
    quoteEpoch: quoteEpoch ?? lastBar.epoch,
  };
}
