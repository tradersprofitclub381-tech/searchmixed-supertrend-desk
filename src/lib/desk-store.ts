import { create } from "zustand";
import {
  isMultiplier,
  isPeriod,
  isTimeframe,
  type Direction,
  type MarketName,
  type Meta,
  type Quote,
} from "@/lib/signal";

export type FeedStatus = "connecting" | "syncing" | "live" | "reconnecting" | "offline";
export type DeskView = "signals" | "tools";
export type BiasFilter = "all" | Direction;
export type SortMode = "desk" | "newest" | "name";

const STORAGE_KEY = "searchmixed-desk";

type LiveState = {
  status: FeedStatus;
  error: string | null;
  quotes: Record<string, Quote>;
  order: string[];
  metas: Record<string, Meta>;
  directions: Record<string, Direction>;
  epochs: Record<string, number>;
  selected: string | null;
  loaded: number;
  total: number;
  universe: number;
  select: (symbol: string) => void;
};

type SavedPrefs = {
  follows?: unknown;
  timeframe?: unknown;
  atrPeriod?: unknown;
  multiplier?: unknown;
};

type PrefState = {
  follows: string[];
  timeframe: number;
  atrPeriod: number;
  multiplier: number;
  view: DeskView;
  query: string;
  market: "All" | MarketName;
  bias: BiasFilter;
  followingOnly: boolean;
  sort: SortMode;
  modelOpen: boolean;
  hydrated: boolean;
  toggleFollow: (symbol: string) => void;
  setTimeframe: (timeframe: number) => void;
  setAtrPeriod: (atrPeriod: number) => void;
  setMultiplier: (multiplier: number) => void;
  setView: (view: DeskView) => void;
  setQuery: (query: string) => void;
  setMarket: (market: "All" | MarketName) => void;
  setBias: (bias: BiasFilter) => void;
  setFollowingOnly: (followingOnly: boolean) => void;
  setSort: (sort: SortMode) => void;
  setModelOpen: (modelOpen: boolean) => void;
};

export const useLive = create<LiveState>((set) => ({
  status: "connecting",
  error: null,
  quotes: {},
  order: [],
  metas: {},
  directions: {},
  epochs: {},
  selected: null,
  loaded: 0,
  total: 0,
  universe: 0,
  select: (symbol) => set({ selected: symbol }),
}));

export const usePrefs = create<PrefState>((set) => ({
  follows: [],
  timeframe: 900,
  atrPeriod: 10,
  multiplier: 3,
  view: "signals",
  query: "",
  market: "All",
  bias: "all",
  followingOnly: false,
  sort: "desk",
  modelOpen: false,
  hydrated: false,
  toggleFollow: (symbol) =>
    set((state) => ({
      follows: state.follows.includes(symbol)
        ? state.follows.filter((item) => item !== symbol)
        : [...state.follows, symbol],
    })),
  setTimeframe: (timeframe) => set({ timeframe }),
  setAtrPeriod: (atrPeriod) => set({ atrPeriod }),
  setMultiplier: (multiplier) => set({ multiplier }),
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  setMarket: (market) => set({ market }),
  setBias: (bias) => set({ bias }),
  setFollowingOnly: (followingOnly) => set({ followingOnly }),
  setSort: (sort) => set({ sort }),
  setModelOpen: (modelOpen) => set({ modelOpen }),
}));

export function hydratePrefs() {
  if (usePrefs.getState().hydrated) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      usePrefs.setState({ hydrated: true });
      return;
    }
    const data = JSON.parse(raw) as SavedPrefs;
    const follows = Array.isArray(data.follows)
      ? data.follows.filter((item): item is string => typeof item === "string")
      : [];
    const timeframe = typeof data.timeframe === "number" && isTimeframe(data.timeframe) ? data.timeframe : 900;
    const atrPeriod = typeof data.atrPeriod === "number" && isPeriod(data.atrPeriod) ? data.atrPeriod : 10;
    const multiplier =
      typeof data.multiplier === "number" && isMultiplier(data.multiplier) ? data.multiplier : 3;
    usePrefs.setState({ follows, timeframe, atrPeriod, multiplier, hydrated: true });
  } catch {
    usePrefs.setState({ hydrated: true });
  }
}

export function bindPrefPersistence() {
  usePrefs.subscribe((state) => {
    if (!state.hydrated) return;
    const payload = {
      follows: state.follows,
      timeframe: state.timeframe,
      atrPeriod: state.atrPeriod,
      multiplier: state.multiplier,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  });
}
