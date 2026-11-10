import type { Direction } from "@/lib/signal";

export function decimalsFromPip(pip: number): number {
  if (!Number.isFinite(pip) || pip <= 0) return 2;
  const digits = Math.round(-Math.log10(pip));
  return Math.max(0, Math.min(8, digits));
}

export function formatPrice(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pipsBetween(from: number, to: number, pip: number, direction: Direction): number {
  if (!Number.isFinite(pip) || pip <= 0) return 0;
  const raw = (to - from) / pip;
  return direction === "buy" ? raw : -raw;
}

export function formatPips(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

export function formatAge(epochSec: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round(nowMs / 1000 - epochSec));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatClock(epochSec: number): string {
  if (!epochSec) return "—";
  return new Date(epochSec * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
