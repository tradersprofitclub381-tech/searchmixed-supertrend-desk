import { Star } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { PriceChart } from "@/components/desk/price-chart";
import { Button } from "@/components/ui/button";
import { chartSeries, retryFeed } from "@/lib/deriv-engine";
import { useLive, usePrefs } from "@/lib/desk-store";
import { formatAge, formatClock, formatPips, formatPrice, pipsBetween } from "@/lib/format";
import type { Direction, Phase, Quote } from "@/lib/signal";
import { cn } from "@/lib/utils";

function useNow(interval = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return reduced;
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

function Bias({ direction }: { direction: Direction }) {
  const buy = direction === "buy";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium",
        buy ? "bg-rise-soft text-rise" : "bg-fall-soft text-fall",
      )}
    >
      {buy ? "Buy" : "Sell"}
    </span>
  );
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
      className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-canvas"
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

const SignalRow = memo(function SignalRow({
  symbol,
  now,
  onOpen,
}: {
  symbol: string;
  now: number;
  onOpen: (symbol: string) => void;
}) {
  const quote = useLive((state) => state.quotes[symbol]);
  const selected = useLive((state) => state.selected === symbol);
  const reduced = useReducedMotion();
  const flashTimer = useRef<number | null>(null);
  const previous = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!quote) return;
    const last = previous.current;
    previous.current = quote.price;
    if (reduced || last === null || last === quote.price) return;
    setFlash(quote.price > last ? "up" : "down");
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 450);
  }, [quote, reduced]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  if (!quote) return null;
  const pips = pipsBetween(quote.entry, quote.price, quote.pip, quote.direction);

  return (
    <tr
      className={cn(
        "cursor-pointer border-b border-line border-l-2 transition-colors duration-150",
        selected ? "border-l-paper bg-panel-2" : "border-l-transparent hover:bg-panel",
        flash === "up" && "bg-rise-soft",
        flash === "down" && "bg-fall-soft",
      )}
      onClick={() => onOpen(symbol)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(symbol);
        }
      }}
      tabIndex={0}
    >
      <td className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium">{quote.displayName}</div>
            <div className="text-xs text-faint">{quote.market}</div>
          </div>
          <FollowButton symbol={symbol} />
        </div>
      </td>
      <td className="px-3 py-3">
        <Bias direction={quote.direction} />
      </td>
      <td className="px-3 py-3">
        <div className="tabular-nums">{formatPrice(quote.price, quote.digits)}</div>
        <div className={cn("text-xs tabular-nums", pips >= 0 ? "text-rise" : "text-fall")}>
          {formatPips(pips)} pips
        </div>
      </td>
      <td className="px-3 py-3 tabular-nums text-mist">{formatPrice(quote.entry, quote.digits)}</td>
      <td className="px-3 py-3 tabular-nums text-mist">{formatPrice(quote.sl, quote.digits)}</td>
      <td className="px-3 py-3 tabular-nums">{formatPrice(quote.tp1, quote.digits)}</td>
      <td className="px-3 py-3 tabular-nums">{formatPrice(quote.tp2, quote.digits)}</td>
      <td className="px-3 py-3 text-mist">{formatAge(quote.signalEpoch, now)}</td>
    </tr>
  );
});

function SignalCard({ symbol, now, onOpen }: { symbol: string; now: number; onOpen: (symbol: string) => void }) {
  const quote = useLive((state) => state.quotes[symbol]);
  if (!quote) return null;
  return (
    <article className="rounded-xl border border-line bg-panel p-4">
      <button type="button" className="w-full text-left" onClick={() => onOpen(symbol)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{quote.displayName}</div>
            <div className="text-xs text-faint">
              {quote.market} · {formatAge(quote.signalEpoch, now)}
            </div>
          </div>
          <Bias direction={quote.direction} />
        </div>
        <div className="mt-3 font-display text-3xl tracking-tight tabular-nums">
          {formatPrice(quote.price, quote.digits)}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Entry" value={formatPrice(quote.entry, quote.digits)} />
          <Stat label="Stop" value={formatPrice(quote.sl, quote.digits)} />
          <Stat label="TP1" value={formatPrice(quote.tp1, quote.digits)} />
          <Stat label="TP2" value={formatPrice(quote.tp2, quote.digits)} />
        </dl>
      </button>
      <div className="mt-2 flex justify-end">
        <FollowButton symbol={symbol} />
      </div>
    </article>
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
  const series = quote ? chartSeries(quote.symbol) : [];

  return (
    <aside className="rounded-xl border border-line bg-panel p-4 lg:sticky lg:top-4">
      <button type="button" className="mb-3 text-sm text-mist lg:hidden" onClick={onBack}>
        Back to signals
      </button>
      {quote ? <DetailBody quote={quote} now={now} series={series} /> : <DetailEmpty />}
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

function DetailBody({
  quote,
  now,
  series,
}: {
  quote: Quote;
  now: number;
  series: ReturnType<typeof chartSeries>;
}) {
  const pips = pipsBetween(quote.entry, quote.price, quote.pip, quote.direction);
  const risk = Math.abs(quote.entry - quote.sl);
  const stopPips = risk / quote.pip;
  const sentence =
    quote.direction === "buy"
      ? "Buy bias while price holds above the band. The trail is the live Supertrend."
      : "Sell bias while price holds below the band. The trail is the live Supertrend.";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs tracking-wide text-faint uppercase">{quote.market}</div>
          <h2 className="font-display text-3xl tracking-tight">{quote.displayName}</h2>
          <p className="mt-1 text-sm text-mist">
            {phaseLabel(quote.phase)} · {formatAge(quote.signalEpoch, now)} · {formatClock(quote.signalEpoch)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Bias direction={quote.direction} />
          <FollowButton symbol={quote.symbol} />
        </div>
      </div>
      <div>
        <div className="font-display text-4xl tracking-tight tabular-nums">
          {formatPrice(quote.price, quote.digits)}
        </div>
        <p className={cn("mt-1 text-sm tabular-nums", pips >= 0 ? "text-rise" : "text-fall")}>
          {formatPips(pips)} pips from entry
        </p>
      </div>
      <PriceChart points={series} digits={quote.digits} />
      <p className="text-xs text-faint">Price in ink. Rising band in green. Falling band in red.</p>
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Entry" value={formatPrice(quote.entry, quote.digits)} hint="Close of the flip" />
        <Stat label="Stop" value={formatPrice(quote.sl, quote.digits)} hint={`${stopPips.toFixed(1)} pips risk`} />
        <Stat label="Trail" value={formatPrice(quote.trail, quote.digits)} hint="Live Supertrend" />
        <Stat label="ATR" value={formatPrice(quote.atr, quote.digits)} />
        <Stat label="TP1" value={formatPrice(quote.tp1, quote.digits)} hint="1.5R" />
        <Stat label="TP2" value={formatPrice(quote.tp2, quote.digits)} hint="2.5R" />
      </dl>
      <p className="text-sm text-mist">{sentence} Follows stay on this device.</p>
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
  const total = useLive((state) => state.total);
  const universe = useLive((state) => state.universe);
  const now = useNow();
  const waiting = loaded === 0 && status !== "offline";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
      <section className={cn("min-w-0", mobilePane === "detail" ? "hidden lg:block" : "block")}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-mist">
          <p>
            {symbols.length} on screen
            {loaded > 0 ? ` · ${buys} buy · ${sells} sell` : ""}
          </p>
          <p>
            {loaded > 0 ? `${loaded} live` : "Waiting"}
            {universe > total && total > 0 ? ` · ${total} of ${universe}` : ""}
          </p>
        </div>
        {waiting ? <SkeletonList /> : null}
        {!waiting && symbols.length === 0 ? (
          <EmptyBoard status={status} error={error} loaded={loaded} />
        ) : null}
        {symbols.length > 0 ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-line bg-panel md:block">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-panel text-xs tracking-wide text-faint uppercase">
                    <tr>
                      {["Market", "Signal", "Price", "Entry", "Stop", "TP1", "TP2", "Age"].map((label) => (
                        <th key={label} className="px-3 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {symbols.map((symbol) => (
                      <SignalRow key={symbol} symbol={symbol} now={now} onOpen={onOpen} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              {symbols.map((symbol) => (
                <SignalCard key={symbol} symbol={symbol} now={now} onOpen={onOpen} />
              ))}
            </div>
          </>
        ) : null}
      </section>
      <div className={cn(mobilePane === "list" ? "hidden lg:block" : "block")}>
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
