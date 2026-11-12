import { decimalsFromPip } from "@/lib/format";
import { bindPrefPersistence, hydratePrefs, useLive, usePrefs } from "@/lib/desk-store";
import type { Candle, MarketName, Meta } from "@/lib/signal";
import { buildQuote, computeSupertrend } from "@/lib/supertrend";

const SOCKET_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const DESK_CAP = 100;

const PRIORITY = [
  "frxEURUSD",
  "frxGBPUSD",
  "frxUSDJPY",
  "frxXAUUSD",
  "frxAUDUSD",
  "frxUSDCAD",
  "frxUSDCHF",
  "frxNZDUSD",
  "frxEURJPY",
  "frxGBPJPY",
  "frxEURGBP",
  "frxXAGUSD",
  "cryBTCUSD",
  "cryETHUSD",
  "R_75",
  "R_100",
  "R_50",
  "R_25",
  "R_10",
  "1HZ75V",
  "1HZ100V",
  "1HZ50V",
  "BOOM1000",
  "BOOM500",
  "CRASH1000",
  "CRASH500",
];

type DerivRow = {
  symbol?: string;
  display_name?: string;
  market?: string;
  market_display_name?: string;
  submarket?: string;
  submarket_display_name?: string;
  pip?: number;
  pip_size?: number;
  is_trading_suspended?: number;
  symbol_type?: string;
  underlying_symbol?: string;
  underlying_symbol_name?: string;
  underlying_symbol_type?: string;
};

type DerivMessage = {
  msg_type?: string;
  req_id?: number;
  error?: { message?: string };
  active_symbols?: DerivRow[];
  candles?: Array<{ epoch: number; open: number; high: number; low: number; close: number }>;
  pip_size?: number;
  tick?: { symbol?: string; quote?: number; epoch?: number };
};

type Pending = {
  resolve: (message: DerivMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const books = new Map<string, Candle[]>();
const metaBySymbol = new Map<string, Meta>();
const pending = new Map<number, Pending>();
const subscribed = new Set<string>();

let started = false;
let socket: WebSocket | null = null;
let reqId = 1;
let token = 0;
let backoff = 800;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let catalog: Meta[] = [];
let failures = 0;

export type ChartPoint = {
  label: string;
  close: number;
  up: number | null;
  down: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pipIncrement(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 1) return undefined;
  return value;
}

function normalizeRow(row: DerivRow) {
  const symbol = row.symbol || row.underlying_symbol || "";
  if (!symbol) return null;
  return {
    symbol,
    displayName: row.display_name || row.underlying_symbol_name || symbol,
    market: (row.market ?? "").toLowerCase(),
    submarket: `${row.submarket ?? ""} ${row.submarket_display_name ?? ""}`.toLowerCase(),
    symbolType: row.symbol_type || row.underlying_symbol_type || "",
    pip: pipIncrement(typeof row.pip === "number" ? row.pip : row.pip_size),
    suspended: Boolean(row.is_trading_suspended),
  };
}

function classify(row: NonNullable<ReturnType<typeof normalizeRow>>): MarketName | null {
  if (row.suspended) return null;
  if (row.symbolType && /vanilla|digit|callput|lookback/i.test(row.symbolType)) return null;
  const { symbol, market, submarket } = row;
  if (submarket.includes("metal") || /XAU|XAG|XPT|XPD/.test(symbol)) return "Metals";
  if (market === "forex" || symbol.startsWith("frx")) return "Forex";
  if (market.includes("crypto") || symbol.startsWith("cry")) return "Crypto";
  if (
    market.includes("synthetic") ||
    /^(R_|1HZ|BOOM|CRASH|JD|STPRNG|WLD|RB|RDB)/i.test(symbol)
  ) {
    return "Synthetic";
  }
  if (market.includes("index") || market.includes("basket") || market.includes("commodit")) return "Index";
  return null;
}

function inferPip(symbol: string, pip: number | undefined, market: MarketName): number {
  if (typeof pip === "number" && Number.isFinite(pip) && pip > 0) return pip;
  if (market === "Forex" || market === "Metals") {
    if (/JPY|XAU|XAG/.test(symbol)) return 0.001;
    return 0.00001;
  }
  return 0.01;
}

function priorityOf(symbol: string) {
  const index = PRIORITY.indexOf(symbol);
  return index === -1 ? PRIORITY.length + 1 : index;
}

function rejectAll(error: Error) {
  for (const [id, item] of pending) {
    clearTimeout(item.timer);
    item.reject(error);
    pending.delete(id);
  }
}

function request(payload: Record<string, unknown>, timeout = 20000): Promise<DerivMessage> {
  const ws = socket;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("Deriv socket is closed"));
  }
  const id = reqId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Deriv request timed out"));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ ...payload, req_id: id }));
  });
}

async function requestRetry(payload: Record<string, unknown>): Promise<DerivMessage> {
  try {
    return await request(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/rate|limit|throttl/i.test(message)) {
      await sleep(1200);
      return request(payload);
    }
    throw error;
  }
}

function clearFeed() {
  books.clear();
  subscribed.clear();
  useLive.setState({
    quotes: {},
    order: [],
    metas: {},
    directions: {},
    epochs: {},
    loaded: 0,
  });
}

function publish(meta: Meta, quoteEpoch?: number) {
  const candles = books.get(meta.symbol);
  if (!candles) return;
  const { atrPeriod, multiplier } = usePrefs.getState();
  const quote = buildQuote(meta, candles, atrPeriod, multiplier, quoteEpoch);
  if (!quote) return;

  const live = useLive.getState();
  const prev = live.quotes[meta.symbol];
  if (
    prev &&
    prev.price === quote.price &&
    prev.trail === quote.trail &&
    prev.phase === quote.phase &&
    prev.direction === quote.direction &&
    prev.signalEpoch === quote.signalEpoch
  ) {
    return;
  }

  const patch: Partial<ReturnType<typeof useLive.getState>> = {
    quotes: { ...live.quotes, [meta.symbol]: quote },
  };
  if (!prev) {
    const order = [...live.order, meta.symbol];
    patch.order = order;
    patch.metas = { ...live.metas, [meta.symbol]: meta };
    patch.directions = { ...live.directions, [meta.symbol]: quote.direction };
    patch.epochs = { ...live.epochs, [meta.symbol]: quote.signalEpoch };
    patch.loaded = order.length;
    if (!live.selected) patch.selected = meta.symbol;
    if (live.status === "syncing" || live.status === "connecting" || live.status === "reconnecting") {
      patch.status = "live";
      patch.error = null;
    }
  } else {
    if (prev.direction !== quote.direction) {
      patch.directions = { ...live.directions, [meta.symbol]: quote.direction };
    }
    if (prev.signalEpoch !== quote.signalEpoch) {
      patch.epochs = { ...live.epochs, [meta.symbol]: quote.signalEpoch };
    }
  }
  useLive.setState(patch);
}

function onTick(symbol: string, quote: number, epoch: number) {
  if (!Number.isFinite(quote)) return;
  const candles = books.get(symbol);
  const meta = metaBySymbol.get(symbol);
  if (!candles || candles.length === 0 || !meta) return;
  const gran = usePrefs.getState().timeframe;
  const bucket = Math.floor(epoch / gran) * gran;
  const last = candles[candles.length - 1];
  if (!last) return;
  if (bucket > last.epoch) {
    candles.push({ epoch: bucket, open: quote, high: quote, low: quote, close: quote });
    if (candles.length > 220) candles.splice(0, candles.length - 200);
  } else {
    last.close = quote;
    if (quote > last.high) last.high = quote;
    if (quote < last.low) last.low = quote;
  }
  publish(meta, epoch);
}

function onMessage(raw: string) {
  let message: DerivMessage;
  try {
    message = JSON.parse(raw) as DerivMessage;
  } catch {
    return;
  }
  if (message.msg_type === "tick" && message.tick?.symbol) {
    onTick(message.tick.symbol, Number(message.tick.quote), Number(message.tick.epoch));
  }
  if (!message.req_id || !pending.has(message.req_id)) return;
  const item = pending.get(message.req_id);
  if (!item) return;
  clearTimeout(item.timer);
  pending.delete(message.req_id);
  if (message.error) item.reject(new Error(message.error.message || "Deriv error"));
  else item.resolve(message);
}

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (current === undefined) continue;
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

async function fetchCatalog(my: number): Promise<Meta[]> {
  let rows: DerivRow[] = [];
  try {
    const message = await requestRetry({ active_symbols: "brief" });
    rows = message.active_symbols ?? [];
  } catch {
    const basic = await requestRetry({ active_symbols: "brief", product_type: "basic" });
    let synthetic: DerivRow[] = [];
    try {
      const extra = await requestRetry({ active_symbols: "brief", product_type: "synthetic" });
      synthetic = extra.active_symbols ?? [];
    } catch {
      synthetic = [];
    }
    rows = [...(basic.active_symbols ?? []), ...synthetic];
  }
  if (my !== token) return [];
  const next: Meta[] = [];
  for (const raw of rows) {
    const row = normalizeRow(raw);
    if (!row) continue;
    const market = classify(row);
    if (!market) continue;
    const pip = inferPip(row.symbol, row.pip, market);
    next.push({
      symbol: row.symbol,
      displayName: row.displayName,
      market,
      pip,
      digits: decimalsFromPip(pip),
    });
  }
  next.sort(
    (a, b) => priorityOf(a.symbol) - priorityOf(b.symbol) || a.displayName.localeCompare(b.displayName),
  );
  return next;
}

async function fetchCandles(symbol: string, my: number): Promise<{ candles: Candle[]; pip?: number } | null> {
  if (my !== token) return null;
  const granularity = usePrefs.getState().timeframe;
  const message = await requestRetry({
    ticks_history: symbol,
    end: "latest",
    count: 180,
    granularity,
    style: "candles",
    adjust_start_time: 1,
  });
  if (my !== token) return null;
  const rows = message.candles;
  if (!Array.isArray(rows) || rows.length < 30) return null;
  const candles = rows
    .map((bar) => ({
      epoch: Number(bar.epoch),
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
    }))
    .filter((bar) => Number.isFinite(bar.close) && Number.isFinite(bar.epoch));
  if (candles.length < 30) return null;
  return { candles };
}

async function subscribeTick(symbol: string, my: number) {
  if (my !== token || subscribed.has(symbol)) return;
  subscribed.add(symbol);
  try {
    await request({ ticks: symbol, subscribe: 1 }, 15000);
  } catch {
    subscribed.delete(symbol);
  }
}

async function loadCandles(list: Meta[], my: number) {
  await mapPool(list, 5, async (meta) => {
    if (my !== token) return;
    try {
      const history = await fetchCandles(meta.symbol, my);
      if (my !== token || !history) return;
      const nextMeta =
        history.pip && history.pip !== meta.pip
          ? { ...meta, pip: history.pip, digits: decimalsFromPip(history.pip) }
          : meta;
      books.set(nextMeta.symbol, history.candles);
      metaBySymbol.set(nextMeta.symbol, nextMeta);
      publish(nextMeta);
      await subscribeTick(meta.symbol, my);
    } catch {
      /* Skip a market that has no candle history. */
    }
  });
  if (my !== token) return;
  const loaded = useLive.getState().loaded;
  if (loaded === 0) {
    useLive.setState({
      status: "offline",
      error: "Deriv did not return candle history for this desk.",
    });
  } else {
    useLive.setState({ status: "live", error: null });
  }
}

async function boot(my: number) {
  try {
    if (catalog.length === 0) {
      const full = await fetchCatalog(my);
      if (my !== token) return;
      catalog = full.slice(0, DESK_CAP);
      useLive.setState({ universe: full.length, total: catalog.length });
    } else {
      useLive.setState({ total: catalog.length });
    }
    if (my !== token) return;
    if (catalog.length === 0) {
      useLive.setState({ status: "offline", error: "No Deriv markets were returned." });
      return;
    }
    await loadCandles(catalog, my);
  } catch (error) {
    if (my !== token) return;
    const message = error instanceof Error ? error.message : "Could not open the Deriv feed.";
    useLive.setState({ status: "offline", error: message });
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const wait = backoff;
  backoff = Math.min(12000, Math.round(backoff * 1.7));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, wait);
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  useLive.setState((state) => ({
    status: state.loaded > 0 ? "reconnecting" : state.status === "offline" ? "connecting" : state.status,
    error: null,
  }));
  const ws = new WebSocket(SOCKET_URL);
  socket = ws;
  const openTimer = setTimeout(() => {
    if (socket === ws && ws.readyState !== WebSocket.OPEN) ws.close();
  }, 7000);
  ws.onmessage = (event) => {
    if (typeof event.data === "string") onMessage(event.data);
  };
  ws.onopen = () => {
    clearTimeout(openTimer);
    if (socket !== ws) return;
    failures = 0;
    backoff = 800;
    token += 1;
    const my = token;
    subscribed.clear();
    useLive.setState({ status: useLive.getState().loaded > 0 ? "live" : "syncing", error: null });
    void boot(my);
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ ping: 1 }));
    }, 25000);
  };
  ws.onerror = () => {
    /* Close handler owns the retry. The browser may also report the failed socket. */
  };
  ws.onclose = () => {
    clearTimeout(openTimer);
    if (socket === ws) socket = null;
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    token += 1;
    rejectAll(new Error("Deriv feed closed"));
    failures += 1;
    useLive.setState({
      status: "reconnecting",
      error:
        useLive.getState().loaded === 0
          ? "Still opening the Deriv feed."
          : null,
    });
    scheduleReconnect();
  };
}

async function reloadTimeframe() {
  const old = socket;
  token += 1;
  const my = token;
  clearFeed();
  subscribed.clear();
  useLive.setState({ status: "syncing", error: null });
  if (!old || old.readyState !== WebSocket.OPEN) return;
  try {
    await request({ forget_all: "ticks" }, 8000);
  } catch {
    /* Nothing to forget yet. */
  }
  if (my !== token) return;
  await loadCandles(catalog, my);
}

function recomputeAll() {
  for (const meta of catalog) {
    if (books.has(meta.symbol)) publish(meta);
  }
}

function watchPrefs() {
  let prev = usePrefs.getState();
  usePrefs.subscribe((state) => {
    const previous = prev;
    prev = state;
    if (!state.hydrated) return;
    if (state.timeframe !== previous.timeframe) {
      void reloadTimeframe();
      return;
    }
    if (state.atrPeriod !== previous.atrPeriod || state.multiplier !== previous.multiplier) {
      recomputeAll();
    }
  });
}

export function startDesk() {
  if (started || typeof window === "undefined") return;
  started = true;
  hydratePrefs();
  bindPrefPersistence();
  watchPrefs();
  connect();
}

export function retryFeed() {
  if (typeof window === "undefined") return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const old = socket;
  socket = null;
  if (old) {
    old.onclose = null;
    old.onerror = null;
    old.onmessage = null;
    old.close();
  }
  token += 1;
  rejectAll(new Error("retry"));
  failures = 0;
  backoff = 800;
  catalog = [];
  clearFeed();
  useLive.setState({ status: "connecting", error: null, total: 0, universe: 0 });
  connect();
}

export function chartCandles(symbol: string): Candle[] {
  const candles = books.get(symbol);
  if (!candles || candles.length === 0) return [];
  return candles.slice(-140);
}

export function chartSeries(symbol: string): ChartPoint[] {
  const candles = books.get(symbol);
  if (!candles || candles.length === 0) return [];
  const { atrPeriod, multiplier, timeframe } = usePrefs.getState();
  const points = computeSupertrend(candles, atrPeriod, multiplier);
  const start = Math.max(0, candles.length - 90);
  const series: ChartPoint[] = [];
  for (let i = start; i < candles.length; i++) {
    const point = points[i];
    const bar = candles[i];
    if (!point || !bar) continue;
    const date = new Date(bar.epoch * 1000);
    const label =
      timeframe >= 86400
        ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    series.push({
      label,
      close: bar.close,
      up: point.trend === 1 ? point.st : null,
      down: point.trend === -1 ? point.st : null,
    });
  }
  return series;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    token += 1;
    started = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    const old = socket;
    socket = null;
    if (old) {
      old.onclose = null;
      old.onerror = null;
      old.onmessage = null;
      old.close();
    }
    rejectAll(new Error("reload"));
  });
}

if (typeof window !== "undefined") {
  queueMicrotask(() => startDesk());
}
