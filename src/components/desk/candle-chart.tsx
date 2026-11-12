import { useEffect, useRef, useState } from "react";
import { chartCandles } from "@/lib/deriv-engine";
import { formatPrice } from "@/lib/format";
import type { Candle, Quote } from "@/lib/signal";

const BUY = "#22d18b";
const SELL = "#ff5b6a";
const ACCENT = "#3b82f6";

type Geo = { left: number; width: number; count: number; plot: number };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function draw(
  canvas: HTMLCanvasElement,
  candles: Candle[],
  quote: Quote,
  hover: number | null,
): { text: string } | null {
  const parent = canvas.parentElement;
  if (!parent || candles.length < 2) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(280, Math.floor(parent.clientWidth));
  const height = Math.min(360, Math.max(230, Math.round(Math.min(width, 640) * 0.62)));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1016";
  ctx.fillRect(0, 0, width, height);

  let sigIdx = candles.findIndex((bar) => bar.epoch >= quote.signalEpoch);
  if (sigIdx < 0) sigIdx = candles.length - 1;

  const levels = [quote.entry, quote.sl, quote.tp1, quote.tp2, quote.price];
  let low = Math.min(...levels, ...candles.map((bar) => bar.low));
  let high = Math.max(...levels, ...candles.map((bar) => bar.high));
  const pad = (high - low) * 0.08 || Math.abs(quote.price) * 0.002 || 1;
  low -= pad;
  high += pad;

  const left = 8;
  const right = width - 74;
  const top = 12;
  const bottom = height - 10;
  const slot = (right - left) / candles.length;
  const xAt = (index: number) => left + slot * (index + 0.5);
  const yAt = (price: number) => top + ((high - price) / (high - low)) * (bottom - top);

  ctx.font = "700 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let step = 0; step <= 4; step += 1) {
    const price = low + ((high - low) * step) / 4;
    const y = Math.round(yAt(price)) + 0.5;
    ctx.strokeStyle = "#16202d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = "#5d6b80";
    ctx.textAlign = "left";
    ctx.fillText(formatPrice(price, quote.digits), right + 8, y);
  }

  const zoneX = xAt(sigIdx);
  const entryY = yAt(quote.entry);
  const tpY = yAt(quote.tp2);
  const slY = yAt(quote.sl);
  ctx.fillStyle = "rgba(34,209,139,.13)";
  ctx.fillRect(zoneX, Math.min(entryY, tpY), right - zoneX, Math.abs(tpY - entryY));
  ctx.fillStyle = "rgba(255,91,106,.13)";
  ctx.fillRect(zoneX, Math.min(entryY, slY), right - zoneX, Math.abs(slY - entryY));

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
  const body = Math.max(1.6, slot * 0.62);
  for (let index = 0; index < candles.length; index += 1) {
    const bar = candles[index];
    if (!bar) continue;
    const up = bar.close >= bar.open;
    const color = up ? BUY : SELL;
    const x = xAt(index);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yAt(bar.high));
    ctx.lineTo(x, yAt(bar.low));
    ctx.stroke();
    const openY = yAt(bar.open);
    const closeY = yAt(bar.close);
    ctx.fillStyle = color;
    ctx.fillRect(x - body / 2, Math.min(openY, closeY), body, Math.max(1, Math.abs(closeY - openY)));
  }
  ctx.restore();

  const level = (price: number, color: string, label: string, dashed: boolean) => {
    const y = Math.round(yAt(price)) + 0.5;
    ctx.save();
    ctx.setLineDash(dashed ? [3, 3] : []);
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 1 : 1.4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.restore();
    ctx.font = "800 9px ui-sans-serif, system-ui, sans-serif";
    const textWidth = Math.min(ctx.measureText(label).width + 12, 68);
    ctx.fillStyle = color;
    roundRect(ctx, right + 4, y - 8, textWidth, 16, 4);
    ctx.fill();
    ctx.fillStyle = dashed ? "#fff" : "#04120c";
    ctx.textAlign = "center";
    ctx.fillText(label, right + 4 + textWidth / 2, y);
  };

  level(quote.tp2, BUY, formatPrice(quote.tp2, quote.digits), false);
  level(quote.tp1, BUY, formatPrice(quote.tp1, quote.digits), true);
  level(quote.sl, SELL, formatPrice(quote.sl, quote.digits), false);
  level(quote.entry, ACCENT, formatPrice(quote.entry, quote.digits), true);

  const markerX = xAt(sigIdx);
  const markerY = yAt(quote.entry);
  ctx.beginPath();
  ctx.arc(markerX, markerY, 4, 0, Math.PI * 2);
  ctx.fillStyle = quote.direction === "buy" ? BUY : SELL;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#0b1016";
  ctx.stroke();

  const focus = hover != null ? candles[hover] : candles[candles.length - 1];
  if (hover != null && focus) {
    const x = Math.round(xAt(hover)) + 0.5;
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(180,200,225,.45)";
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  }

  const geo: Geo = { left, width: slot, count: candles.length, plot: width };
  canvas.dataset.left = String(geo.left);
  canvas.dataset.slot = String(geo.width);
  canvas.dataset.count = String(geo.count);
  canvas.dataset.plot = String(width);

  if (!focus) return null;
  const tone = focus.close >= focus.open ? BUY : SELL;
  return {
    text: `O ${formatPrice(focus.open, quote.digits)}   H ${formatPrice(focus.high, quote.digits)}   L ${formatPrice(focus.low, quote.digits)}   C ${formatPrice(focus.close, quote.digits)}|${tone}`,
  };
}

export function CandleChart({ quote }: { quote: Quote }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [readout, setReadout] = useState("Waiting for Deriv candles");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const candles = chartCandles(quote.symbol);
    const paint = () => {
      const next = draw(canvas, candles, quote, hover);
      const text = next?.text.split("|")[0] ?? "Waiting for Deriv candles";
      setReadout((current) => (current === text ? current : text));
    };
    paint();
    const parent = canvas.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(paint);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [quote, hover]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#0b1016]">
      <p className="px-3 pt-3 text-[11px] font-extrabold tracking-wide text-mist">{readout}</p>
      <canvas
        ref={canvasRef}
        className="block w-full touch-pan-y"
        role="img"
        aria-label={`${quote.displayName} candles with entry, stop, and targets`}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const left = Number(canvas.dataset.left);
          const slot = Number(canvas.dataset.slot);
          const count = Number(canvas.dataset.count);
          const plot = Number(canvas.dataset.plot);
          if (!slot || !count || !plot) return;
          const rect = canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * plot;
          const index = Math.max(0, Math.min(count - 1, Math.floor((x - left) / slot)));
          setHover(index);
        }}
        onPointerLeave={() => setHover(null)}
      />
      <div className="flex gap-4 px-3 pb-3 text-[11px] font-extrabold text-mist">
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2 rounded-sm bg-rise" /> Reward
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2 rounded-sm bg-fall" /> Risk
        </span>
      </div>
    </div>
  );
}
