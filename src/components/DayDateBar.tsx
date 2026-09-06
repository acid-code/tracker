"use client";

import type { ReactNode } from "react";
import { todayISODate } from "@/lib/tdee";

function clampDate(d: string): string {
  const today = todayISODate();
  return d > today ? today : d;
}

function shiftISODate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISODate(d);
}

const navBtn =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-lg leading-none min-h-[44px] min-w-[44px] disabled:opacity-35 disabled:pointer-events-none hover:bg-[var(--surface-2)]";

export function DayDateBar({
  date,
  onChange,
  inputClassName,
  label = "Date",
  todayLabel = "Today",
  className = "",
  children,
}: {
  date: string;
  onChange: (next: string) => void;
  inputClassName: string;
  label?: string;
  todayLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const today = todayISODate();
  const atToday = date >= today;

  function go(delta: number) {
    onChange(clampDate(shiftISODate(date, delta)));
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`.trim()}>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--muted)] shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => go(-1)}
            className={navBtn}
          >
            ‹
          </button>
          <input
            type="date"
            className={inputClassName}
            value={date}
            max={today}
            onChange={(e) => onChange(clampDate(e.target.value))}
          />
          <button
            type="button"
            aria-label="Next day"
            disabled={atToday}
            onClick={() => go(1)}
            className={navBtn}
          >
            ›
          </button>
        </div>
      </div>
      {!atToday ? (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="text-xs text-[var(--accent)] hover:underline min-h-[44px]"
        >
          {todayLabel}
        </button>
      ) : null}
      {children}
    </div>
  );
}
