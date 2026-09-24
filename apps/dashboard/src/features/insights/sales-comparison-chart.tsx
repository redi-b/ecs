"use client";

import type { SalesBucket } from "./sales-report-model";

const WIDTH = 960;
const HEIGHT = 320;
const LEFT = 8;
const RIGHT = 8;
const TOP = 25;
const BOTTOM = 35;

/** Range-aligned comparison: each fine vertical connector is an observed difference. */
export function SalesComparisonChart({
  buckets,
  selected,
  onSelect,
  amount,
  axisAmount,
  date,
  label,
}: {
  buckets: SalesBucket[];
  selected: number;
  onSelect: (index: number) => void;
  amount: (value: number | null) => string;
  axisAmount: (value: number) => string;
  date: (value: string) => string;
  label: string;
}) {
  const max = Math.max(2, ...buckets.flatMap((p) => [p.current ?? 0, p.previous ?? 0]));
  const x = (index: number) =>
    LEFT + (buckets.length === 1 ? 0.5 : index / (buckets.length - 1)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - value / max) * (HEIGHT - TOP - BOTTOM);
  function path(key: "current" | "previous") {
    let connected = false;
    return buckets
      .map((point, index) => {
        const value = point[key];
        if (value === null) {
          connected = false;
          return "";
        }
        const command = `${connected ? "L" : "M"}${x(index).toFixed(2)},${y(value).toFixed(2)}`;
        connected = true;
        return command;
      })
      .join(" ");
  }
  const point = buckets[selected];
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, buckets.length - 1)}
      aria-valuenow={selected}
      aria-valuetext={point ? `${date(point.from)}: ${amount(point.current)}` : undefined}
      className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(event) => {
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buckets.length - 1
              : event.key === "ArrowLeft" || event.key === "ArrowDown"
                ? selected - 1
                : event.key === "ArrowRight" || event.key === "ArrowUp"
                  ? selected + 1
                  : null;
        if (next !== null) {
          event.preventDefault();
          onSelect(Math.max(0, Math.min(buckets.length - 1, next)));
        }
      }}
      onPointerDown={(event) => {
        event.currentTarget.focus();
        const bounds = event.currentTarget.querySelector("svg")!.getBoundingClientRect();
        const position =
          (((event.clientX - bounds.left) / bounds.width) * WIDTH - LEFT) / (WIDTH - LEFT - RIGHT);
        onSelect(
          Math.max(0, Math.min(buckets.length - 1, Math.round(position * (buckets.length - 1)))),
        );
      }}
    >
      <div className="flex gap-3">
        <div
          aria-hidden="true"
          className="relative w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground"
        >
          {[0, 0.5, 1].map((ratio) => (
            <span
              key={ratio}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(y(max * ratio) / HEIGHT) * 100}%` }}
            >
              {axisAmount(max * ratio)}
            </span>
          ))}
        </div>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-64 min-w-0 flex-1 cursor-crosshair sm:h-80"
          preserveAspectRatio="none"
        >
          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(max * ratio)}
              y2={y(max * ratio)}
              stroke="var(--border)"
              strokeOpacity="0.5"
            />
          ))}
          {buckets.map((p, index) =>
            p.current !== null && p.previous !== null ? (
              <line
                key={p.from}
                x1={x(index)}
                x2={x(index)}
                y1={y(p.current)}
                y2={y(p.previous)}
                stroke="var(--primary)"
                strokeOpacity={index === selected ? 0.55 : 0.12}
              />
            ) : null,
          )}
          <path
            d={path("previous")}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.5"
            strokeDasharray="4 5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path("current")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {(["current", "previous"] as const).flatMap((key) =>
            buckets.map((p, index) =>
              p[key] !== null &&
              (buckets[index - 1]?.[key] ?? null) === null &&
              (buckets[index + 1]?.[key] ?? null) === null ? (
                <circle
                  key={`${key}:${p.from}`}
                  cx={x(index)}
                  cy={y(p[key])}
                  r="3"
                  fill={key === "current" ? "var(--primary)" : "var(--muted-foreground)"}
                />
              ) : null,
            ),
          )}
          {point ? (
            <g>
              <line
                x1={x(selected)}
                x2={x(selected)}
                y1={TOP}
                y2={HEIGHT - BOTTOM}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
              {point.current !== null ? (
                <circle
                  cx={x(selected)}
                  cy={y(point.current)}
                  r="5"
                  fill="var(--card)"
                  stroke="var(--primary)"
                  strokeWidth="2"
                />
              ) : null}
              {point.previous !== null ? (
                <circle
                  cx={x(selected)}
                  cy={y(point.previous)}
                  r="3"
                  fill="var(--muted-foreground)"
                />
              ) : null}
            </g>
          ) : null}
        </svg>
      </div>
      <div
        aria-hidden="true"
        className="ml-20 flex justify-between gap-4 text-xs text-muted-foreground"
      >
        <span>{buckets[0] ? date(buckets[0].from) : ""}</span>
        {buckets.length > 1 ? <span className="text-right">{date(buckets.at(-1)!.to)}</span> : null}
      </div>
    </div>
  );
}
