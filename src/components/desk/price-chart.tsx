import { useState } from "react";
import type { ChartPoint } from "@/lib/deriv-engine";
import { formatPrice } from "@/lib/format";

const WIDTH = 640;
const HEIGHT = 240;
const PAD_L = 74;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

export function PriceChart({ points, digits }: { points: ChartPoint[]; digits: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="h-60 rounded-sm bg-canvas" />;

  const closes = points.map((point) => point.close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const pad = (high - low) * 0.12 || Math.abs(low) * 0.002 || 1;
  const y0 = low - pad;
  const y1 = high + pad;
  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const xAt = (index: number) => PAD_L + (index / (points.length - 1)) * innerW;
  const yAt = (value: number) => PAD_T + ((y1 - value) / (y1 - y0)) * innerH;

  const line = (key: "close" | "up" | "down") => {
    let path = "";
    let drawing = false;
    points.forEach((point, index) => {
      const value = point[key];
      if (value == null) {
        drawing = false;
        return;
      }
      path += `${drawing ? "L" : "M"}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`;
      drawing = true;
    });
    return path;
  };

  const yTicks = [0, 1, 2, 3].map((step) => y0 + ((y1 - y0) * step) / 3);
  const xStep = Math.max(1, Math.ceil(points.length / 5));
  const active = hover == null ? null : points[hover];
  const band = active ? (active.up ?? active.down) : null;

  return (
    <div className="relative h-60 w-full min-w-0">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="Price and Supertrend">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={WIDTH - PAD_R} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--color-line)" />
            <text x={PAD_L - 8} y={yAt(tick) + 4} textAnchor="end" fill="var(--color-faint)" fontSize="11">
              {formatPrice(tick, Math.min(digits, 5))}
            </text>
          </g>
        ))}
        {points.map((point, index) =>
          index % xStep === 0 ? (
            <text key={`${point.label}-${index}`} x={xAt(index)} y={HEIGHT - 8} textAnchor="middle" fill="var(--color-faint)" fontSize="11">
              {point.label}
            </text>
          ) : null,
        )}
        <path d={line("down")} fill="none" stroke="var(--color-fall)" strokeWidth="1.4" />
        <path d={line("up")} fill="none" stroke="var(--color-rise)" strokeWidth="1.4" />
        <path d={line("close")} fill="none" stroke="var(--color-ink)" strokeWidth="1.6" />
        {hover != null ? (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD_T} y2={HEIGHT - PAD_B} stroke="var(--color-faint)" />
        ) : null}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width;
            const index = Math.round(ratio * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, index)));
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {active ? (
        <div className="pointer-events-none absolute top-2 right-2 rounded-sm border border-line bg-panel px-3 py-2 text-xs">
          <div className="text-faint">{active.label}</div>
          <div className="mt-1 tabular-nums text-ink">{formatPrice(active.close, digits)}</div>
          {band != null ? <div className="mt-1 tabular-nums text-mist">Band {formatPrice(band, digits)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
