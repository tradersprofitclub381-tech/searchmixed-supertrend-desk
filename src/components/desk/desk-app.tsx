import { useEffect, useRef, useState, type ReactNode } from "react";
import { SignalBoard } from "@/components/desk/signal-board";
import { ToolsView } from "@/components/desk/tools-view";
import { useLive, usePrefs } from "@/lib/desk-store";
import { LINKS } from "@/lib/links";
import { ATR_MULTIPLIERS, ATR_PERIODS, MARKETS, TIMEFRAMES, type MarketName } from "@/lib/signal";
import { cn } from "@/lib/utils";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" width="36" height="36" className="brand-mark size-9 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="6" fill="var(--color-ink)" />
      <g fill="var(--color-canvas)">
        <rect x="7" y="6" width="18" height="4" />
        <rect x="7" y="10" width="4" height="4" />
        <rect x="7" y="14" width="18" height="4" />
        <rect x="21" y="18" width="4" height="4" />
        <rect x="7" y="22" width="18" height="4" />
      </g>
    </svg>
  );
}

function statusCopy(status: string, loaded: number, total: number) {
  if (status === "live") return "Live";
  if (status === "syncing") return total > 0 ? `Reading ${loaded}/${total}` : "Reading markets";
  if (status === "reconnecting") return "Reconnecting";
  if (status === "offline") return "Feed paused";
  return "Opening Deriv";
}

export function DeskApp() {
  const view = usePrefs((state) => state.view);
  const setView = usePrefs((state) => state.setView);
  const status = useLive((state) => state.status);
  const loaded = useLive((state) => state.loaded);
  const total = useLive((state) => state.total);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  return (
    <div className="term min-h-dvh text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mark />
              <div>
                <h1 className="text-2xl leading-none font-extrabold tracking-tight">Searchmixed</h1>
                <p className="mt-1 text-xs font-extrabold tracking-wide text-mist uppercase">Supertrend desk</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-extrabold tracking-wide text-mist" aria-live="polite">
              <span
                className={cn(
                  "size-2 rounded-full",
                  status === "live" ? "bg-rise" : status === "offline" ? "bg-fall" : "bg-mist",
                )}
                aria-hidden
              />
              {statusCopy(status, loaded, total)}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <a className="menu-btn primary shrink-0" href={LINKS.signup} target="_blank" rel="noreferrer noopener">
              Sign up
            </a>
            <a className="menu-btn shrink-0" href={LINKS.signup} target="_blank" rel="noreferrer noopener">
              Log in
            </a>
            <a className="menu-btn shrink-0" href={LINKS.vps} target="_blank" rel="noreferrer noopener">
              Buy VPS
            </a>
            <a className="menu-btn shrink-0" href={LINKS.whatsapp} target="_blank" rel="noreferrer noopener">
              WhatsApp
            </a>
            <button
              type="button"
              className={cn("menu-btn shrink-0", view === "signals" && "primary")}
              onClick={() => setView("signals")}
            >
              Signals
            </button>
            <button
              type="button"
              className={cn("menu-btn shrink-0", view === "tools" && "primary")}
              onClick={() => setView("tools")}
            >
              Tools
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-6">
        {view === "signals" ? (
          <>
            <p className="hidden max-w-3xl text-sm text-mist lg:block">
              A Supertrend flip opens the signal. The stop starts on the band. TP1 is 1.5R and TP2 is 2.5R. Price stays live from Deriv.
            </p>
            <Filters />
            <SignalBoard
              mobilePane={mobilePane}
              onOpen={(symbol) => {
                useLive.getState().select(symbol);
                setMobilePane("detail");
              }}
              onBack={() => setMobilePane("list")}
            />
          </>
        ) : (
          <ToolsView />
        )}
        <footer className="border-t border-line py-6 text-sm text-faint">
          Searchmixed studies public Deriv candles with Supertrend. It is not a broker and it is not advice. Trading can lose money.
        </footer>
      </main>
    </div>
  );
}

function Filters() {
  const timeframe = usePrefs((state) => state.timeframe);
  const setTimeframe = usePrefs((state) => state.setTimeframe);
  const atrPeriod = usePrefs((state) => state.atrPeriod);
  const multiplier = usePrefs((state) => state.multiplier);
  const setAtrPeriod = usePrefs((state) => state.setAtrPeriod);
  const setMultiplier = usePrefs((state) => state.setMultiplier);
  const modelOpen = usePrefs((state) => state.modelOpen);
  const setModelOpen = usePrefs((state) => state.setModelOpen);
  const query = usePrefs((state) => state.query);
  const setQuery = usePrefs((state) => state.setQuery);
  const market = usePrefs((state) => state.market);
  const setMarket = usePrefs((state) => state.setMarket);
  const bias = usePrefs((state) => state.bias);
  const setBias = usePrefs((state) => state.setBias);
  const followingOnly = usePrefs((state) => state.followingOnly);
  const setFollowingOnly = usePrefs((state) => state.setFollowingOnly);
  const follows = usePrefs((state) => state.follows);
  const sort = usePrefs((state) => state.sort);
  const setSort = usePrefs((state) => state.setSort);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModelOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && modelRef.current && !modelRef.current.contains(target)) {
        setModelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [modelOpen, setModelOpen]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Timeframe">
          {TIMEFRAMES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={timeframe === item.id}
              className={cn("tf-chip", timeframe === item.id && "on")}
              onClick={() => setTimeframe(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative" ref={modelRef}>
          <button
            type="button"
            className="h-11 rounded-full bg-panel px-4 text-sm text-ink"
            aria-expanded={modelOpen}
            onClick={() => setModelOpen(!modelOpen)}
          >
            ATR {atrPeriod} · {multiplier}×
          </button>
          {modelOpen ? (
            <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-line bg-panel p-4">
              <p className="text-xs tracking-wide text-faint uppercase">Period</p>
              <div className="mt-2 flex gap-2">
                {ATR_PERIODS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={cn(
                      "h-10 flex-1 rounded-full text-sm",
                      atrPeriod === period ? "bg-paper text-ink-btn" : "bg-canvas text-mist",
                    )}
                    onClick={() => setAtrPeriod(period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs tracking-wide text-faint uppercase">Multiplier</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {ATR_MULTIPLIERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "h-10 rounded-full text-sm",
                      multiplier === value ? "bg-paper text-ink-btn" : "bg-canvas text-mist",
                    )}
                    onClick={() => setMultiplier(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="sr-only" htmlFor="symbol-search">
          Search symbols
        </label>
        <input
          id="symbol-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search symbol"
          className="h-11 w-full rounded-full border border-line bg-panel px-4 text-base text-ink outline-none placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper lg:max-w-xs"
        />
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Market">
          {MARKETS.map((item) => (
            <FilterChip key={item} pressed={market === item} onClick={() => setMarket(item as "All" | MarketName)}>
              {item}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-2xl border border-line bg-white/3 p-1" role="group" aria-label="Bias">
          {(
            [
              ["all", "All"],
              ["buy", "Buy"],
              ["sell", "Sell"],
            ] as const
          ).map(([id, label]) => (
            <FilterChip key={id} pressed={bias === id} onClick={() => setBias(id)}>
              {label}
            </FilterChip>
          ))}
        </div>
        <FilterChip pressed={followingOnly} onClick={() => setFollowingOnly(!followingOnly)}>
          Following{follows.length > 0 ? ` ${follows.length}` : ""}
        </FilterChip>
        <label className="sr-only" htmlFor="sort-mode">
          Sort
        </label>
        <select
          id="sort-mode"
          value={sort}
          onChange={(event) => setSort(event.target.value as "desk" | "newest" | "name")}
          className="h-11 rounded-full border border-line bg-panel px-3 text-sm text-ink"
        >
          <option value="desk">Desk order</option>
          <option value="newest">Newest signal</option>
          <option value="name">Name</option>
        </select>
      </div>
    </div>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-10 flex-1 rounded-xl px-3 text-sm font-extrabold",
        pressed ? "bg-panel-2 text-ink" : "text-mist",
      )}
    >
      {children}
    </button>
  );
}
