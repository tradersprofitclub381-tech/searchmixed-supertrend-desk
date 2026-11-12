import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CandleChart } from "@/components/desk/candle-chart";
import { Button } from "@/components/ui/button";
import { retryFeed } from "@/lib/deriv-engine";
import { useLive, usePrefs } from "@/lib/desk-store";
import { formatAge, formatPrice } from "@/lib/format";
import type { Phase, Quote } from "@/lib/signal";
import { TIMEFRAMES } from "@/lib/signal";
import { cn } from "@/lib/utils";

function useNow(interval = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

function useVisible() {
  const order = useLive((state) => state.order);
  const metas = useLive((state) => state.metas);
  const directions = useLive((state) => state.directions);
  const epochs = useLive((state) => state.epochs);
  const query = usePrefs((state) => state.query);
  const market = usePrefs((state) => state.market);
  const bias = usePrefs((state) => state.bias);
  const followingOnly = usePrefs((state) => state.followingOnly);
  const sort = usePrefs((state) => state.sort);
  const follows = usePrefs((state) => state.follows);

  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    const followed = new Set(follows);
    let symbols = order.filter((symbol) => {
      const meta = metas[symbol];
      if (!meta) return false;
      if (market !== "All" && meta.market !== market) return false;
      if (bias !== "all" && directions[symbol] !== bias) return false;
      if (followingOnly && !followed.has(symbol)) return false;
      if (!needle) return true;
      return symbol.toLowerCase().includes(needle) || meta.displayName.toLowerCase().includes(needle);
    });
    if (sort === "newest") {
      symbols = [...symbols].sort((a, b) => (epochs[b] ?? 0) - (epochs[a] ?? 0));
    } else if (sort === "name") {
      symbols = [...symbols].sort((a, b) =>
        (metas[a]?.displayName ?? a).localeCompare(metas[b]?.displayName ?? b),
      );
    }
    let buys = 0;
    let sells = 0;
    for (const symbol of symbols) {
      if (directions[symbol] === "buy") buys += 1;
      else if (directions[symbol] === "sell") sells += 1;
    }
    return { symbols, buys, sells };
  }, [order, metas, directions, epochs, query, market, bias, followingOnly, sort, follows]);
}

function phaseLabel(phase: Phase) {
  if (phase === "tp1") return "TP1 hit";
  if (phase === "tp2") return "TP2 hit";
  return "Open";
}

function FollowButton({ symbol }: { symbol: string }) {
  const followed = usePrefs((state) => state.follows.includes(symbol));
  const toggle = usePrefs((state) => state.toggleFollow);
  return (
    <button
      type="button"
      className="inline-flex size-9 items-center justify-center rounded-full text-ink"
      aria-pressed={followed}
      aria-label={followed ? `Unfollow ${symbol}` : `Follow ${symbol}`}
      onClick={(event) => {
        event.stopPropagation();
        toggle(symbol);
      }}
    >
      <Star className={cn("size-4", followed && "fill-current")} aria-hidden />
    </button>
  );
}

function SignalCard({ symbol, now, onOpen }: { symbol: string; now: number; onOpen: (symbol: string) => void }) {
  const quote = useLive((state) => state.quotes[symbol]);
  const timeframe = usePrefs((state) => state.timeframe);
  if (!quote) return null;
  const reward = Math.abs(quote.tp2 - quote.entry);
  const risk = Math.abs(quote.entry - quote.sl);
  const rr = risk > 0 ? reward / risk : 0;
  const riskW = rr > 0 ? 100 / (1 + rr) : 50;
  const frame = TIMEFRAMES.find((item) => item.id === timeframe)?.label ?? "";
  return (
    <div className="sig-card" data-side={quote.direction}>
      <button type="button" className="w-full text-left" onClick={() => onOpen(symbol)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[15px] font-extrabold">
            {quote.displayName}
            <small className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-mist">
              {frame}
            </small>
          </div>
          <span className="side-pill">{quote.direction === "buy" ? "BUY" : "SELL"}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <small className="text-[9px] font-extrabold tracking-widest text-mist uppercase">Entry</small>
            <b className="text-[12.5px] font-extrabold tabular-nums">{formatPrice(quote.entry, quote.digits)}</b>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <small className="text-[9px] font-extrabold tracking-widest text-mist uppercase">Stop</small>
            <b className="text-[12.5px] font-extrabold text-fall tabular-nums">{formatPrice(quote.sl, quote.digits)}</b>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <small className="text-[9px] font-extrabold tracking-widest text-mist uppercase">Target</small>
            <b className="text-[12.5px] font-extrabold text-rise tabular-nums">{formatPrice(quote.tp2, quote.digits)}</b>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <small className="text-[9px] font-extrabold tracking-widest text-mist uppercase">R:R</small>
            <b className="text-[12.5px] font-extrabold tabular-nums">1:{rr.toFixed(1)}</b>
          </div>
        </div>
        <div className="rr-bar" aria-hidden>
          <i className="risk" style={{ width: `${riskW}%` }} />
          <i className="rew" style={{ width: `${100 - riskW}%` }} />
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between text-[10px] font-extrabold tracking-wide text-mist">
        <span>{formatAge(quote.signalEpoch, now)} ago</span>
        <span className="flex items-center gap-1">
          <button type="button" className="text-accent" onClick={() => onOpen(symbol)}>
            Chart ›
          </button>
          <FollowButton symbol={symbol} />
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-sm bg-canvas px-3 py-3">
      <dt className="text-xs tracking-wide text-faint uppercase">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums text-ink">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-mist">{hint}</p> : null}
    </div>
  );
}

function Detail({ onBack }: { onBack: () => void }) {
  const selected = useLive((state) => state.selected);
  const quote = useLive((state) => (selected ? state.quotes[selected] : undefined));
  const now = useNow();

  return (
    <aside className="chart-screen rounded-2xl border border-line bg-panel lg:sticky lg:top-4 lg:block">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button type="button" className="menu-btn size-9 px-0 lg:hidden" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="min-w-0">
          <b className="block truncate text-[15px]">{quote ? quote.displayName : "Chart"}</b>
          <small className="text-[10px] font-extrabold tracking-wide text-mist">
            {quote ? `${quote.market} · Deriv candles` : "Select a signal"}
          </small>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rise/15 px-2.5 py-1.5 text-[10px] font-black tracking-widest text-rise">
          <i className="live-dot" /> LIVE
        </span>
      </div>
      <div className="p-3">
        {quote ? <DetailBody quote={quote} now={now} /> : <DetailEmpty />}
      </div>
    </aside>
  );
}

function DetailEmpty() {
  return (
    <div className="flex min-h-64 flex-col justify-end">
      <h2 className="font-display text-3xl tracking-tight">Select a market</h2>
      <p className="mt-2 text-sm text-mist">
        The chart, trail, and targets sit here. Every row is the current Supertrend bias.
      </p>
    </div>
  );
}

function DetailBody({ quote, now }: { quote: Quote; now: number }) {
  const risk = Math.abs(quote.entry - quote.sl);
  const reward = Math.abs(quote.tp2 - quote.entry);
  const rr = risk > 0 ? reward / risk : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="side-pill" data-side={quote.direction} style={{ color: quote.direction === "buy" ? "#22d18b" : "#ff5b6a", background: quote.direction === "buy" ? "rgba(34,209,139,.16)" : "rgba(255,91,106,.16)" }}>
          {quote.direction.toUpperCase()}
        </span>
        <span className="rounded-md border border-line px-2 py-1 text-[10px] font-extrabold text-mist">R:R 1:{rr.toFixed(1)}</span>
        <span className="ml-auto text-[10px] font-extrabold text-mist">{formatAge(quote.signalEpoch, now)} ago</span>
        <FollowButton symbol={quote.symbol} />
      </div>
      <CandleChart quote={quote} />
      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <b className="text-[13px]">Trade plan</b>
          <span className="rounded-full bg-accent/15 px-2 py-1 text-[9px] font-black tracking-widest text-accent">
            {phaseLabel(quote.phase).toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Entry" value={formatPrice(quote.entry, quote.digits)} />
          <Stat label="Stop loss" value={formatPrice(quote.sl, quote.digits)} />
          <Stat label="TP1 · 1.5R" value={formatPrice(quote.tp1, quote.digits)} />
          <Stat label="TP2 · 2.5R" value={formatPrice(quote.tp2, quote.digits)} />
        </div>
      </div>
    </div>
  );
}

export function SignalBoard({
  mobilePane,
  onOpen,
  onBack,
}: {
  mobilePane: "list" | "detail";
  onOpen: (symbol: string) => void;
  onBack: () => void;
}) {
  const { symbols, buys, sells } = useVisible();
  const status = useLive((state) => state.status);
  const error = useLive((state) => state.error);
  const loaded = useLive((state) => state.loaded);
  const now = useNow();
  const waiting = loaded === 0 && status !== "offline";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
      <section className={cn("min-w-0", mobilePane === "detail" ? "hidden lg:block" : "block")}>
        <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-extrabold tracking-wide text-mist">
          <p>
            {symbols.length} signal{symbols.length === 1 ? "" : "s"}
            {loaded > 0 ? ` · ${buys} buy · ${sells} sell` : ""}
          </p>
          <p>{loaded > 0 ? `${loaded} live` : "Waiting"}</p>
        </div>
        {waiting ? <SkeletonList /> : null}
        {!waiting && symbols.length === 0 ? (
          <EmptyBoard status={status} error={error} loaded={loaded} />
        ) : null}
        {symbols.length > 0 ? (
          <div className="flex flex-col gap-2.5 lg:max-h-[calc(100dvh-220px)] lg:overflow-auto lg:pr-1">
            {symbols.map((symbol) => (
              <SignalCard key={symbol} symbol={symbol} now={now} onOpen={onOpen} />
            ))}
          </div>
        ) : null}
      </section>
      <div className={cn(mobilePane === "list" ? "hidden lg:block" : "chart-screen is-open lg:static")}>
        <Detail onBack={onBack} />
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-line px-4 py-4">
          <div className="h-4 w-28 animate-pulse rounded-sm bg-panel-2" />
          <div className="h-4 w-14 animate-pulse rounded-sm bg-panel-2" />
          <div className="ml-auto h-4 w-20 animate-pulse rounded-sm bg-panel-2" />
        </div>
      ))}
    </div>
  );
}

function EmptyBoard({
  status,
  error,
  loaded,
}: {
  status: string;
  error: string | null;
  loaded: number;
}) {
  const followingOnly = usePrefs((state) => state.followingOnly);
  const query = usePrefs((state) => state.query);
  if (loaded > 0 || status === "live") {
    return (
      <div className="rounded-xl border border-line bg-panel px-4 py-10">
        <h2 className="font-display text-3xl tracking-tight">Nothing in this filter</h2>
        <p className="mt-2 max-w-md text-sm text-mist">
          {followingOnly
            ? "You have not followed a market yet. Star a row and it stays on this device."
            : query
              ? "No symbol matches that search."
              : "Try another market or bias. The feed is still live."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-10">
      <h2 className="font-display text-3xl tracking-tight">
        {status === "offline" ? "Feed paused" : "Opening the Deriv feed"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-mist">
        {error ?? "Quotes, stops, and targets fill in as each market answers. The model is Supertrend."}
      </p>
      {status === "offline" ? (
        <Button className="mt-5" onClick={() => retryFeed()}>
          Retry feed
        </Button>
      ) : null}
    </div>
  );
}
