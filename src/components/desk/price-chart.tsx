import { useEffect, useState } from "react";
import type { ChartPoint } from "@/lib/deriv-engine";
import { formatPrice } from "@/lib/format";

type ChartModule = typeof import("recharts");

type TipPayload = {
  payload?: ChartPoint;
};

function Tip({
  active,
  payload,
  digits,
}: {
  active?: boolean;
  payload?: TipPayload[];
  digits: number;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const band = row.up ?? row.down;
  return (
    <div className="rounded-sm border border-line bg-panel px-3 py-2 text-xs">
      <div className="text-faint">{row.label}</div>
      <div className="mt-1 tabular-nums text-ink">{formatPrice(row.close, digits)}</div>
      {band !== null && band !== undefined ? (
        <div className="mt-1 tabular-nums text-mist">Band {formatPrice(band, digits)}</div>
      ) : null}
    </div>
  );
}

export function PriceChart({ points, digits }: { points: ChartPoint[]; digits: number }) {
  const [charts, setCharts] = useState<ChartModule | null>(null);

  useEffect(() => {
    let alive = true;
    void import("recharts").then((mod) => {
      if (alive) setCharts(mod);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (points.length < 2) {
    return <div className="h-60 rounded-sm bg-canvas" />;
  }

  if (!charts) {
    return <div className="h-60 animate-pulse rounded-sm bg-canvas" />;
  }

  const { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } = charts;
  const closes = points.map((point) => point.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pad = (max - min) * 0.12 || Math.abs(min) * 0.002 || 1;

  return (
    <div className="h-60 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tick={{ fill: "var(--color-faint)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(value: number) => formatPrice(Number(value), digits)}
          />
          <Tooltip
            content={(props) => (
              <Tip
                active={props.active}
                payload={props.payload as TipPayload[] | undefined}
                digits={digits}
              />
            )}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="var(--color-ink)"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="up"
            stroke="var(--color-rise)"
            strokeWidth={1.4}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="down"
            stroke="var(--color-fall)"
            strokeWidth={1.4}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
