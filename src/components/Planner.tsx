"use client";

import { useEffect, useRef, useState } from "react";
import { BUFFER_OPTIONS, updateSettings } from "@/lib/client/settings";
import { courtSlots } from "@/lib/planning";
import { clubDaysBetween, formatClock } from "@/lib/time";
import { MinusIcon, PlusIcon } from "./icons";

type PlannerProps = { now: Date; courtAt: Date | null; bufferMin: number };

const DAYS = [
  { offset: 0, label: "Today" },
  { offset: 1, label: "Tomorrow" },
];

export function Planner({ now, courtAt, bufferMin }: PlannerProps) {
  const [dayChoice, setDayChoice] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const todayHasSlots = courtSlots(now, 0).length > 0;
  const courtDay = courtAt ? Math.min(1, Math.max(0, clubDaysBetween(now, courtAt))) : null;
  const day = dayChoice ?? courtDay ?? (todayHasSlots ? 0 : 1);
  const slots = courtSlots(now, day);
  const selectedIso = courtAt?.toISOString() ?? null;

  // Centre the selected time in its strip without moving the page.
  useEffect(() => {
    const strip = scroller.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !chip) return;
    strip.scrollTo({ left: chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [selectedIso, day]);

  const bufferIndex = Math.max(0, BUFFER_OPTIONS.findIndex((option) => option >= bufferMin));
  const stepBuffer = (direction: -1 | 1) => {
    const next = BUFFER_OPTIONS[bufferIndex + direction];
    if (next !== undefined) updateSettings({ bufferMin: next });
  };

  return (
    <section className="card rise p-5" style={{ animationDelay: "60ms" }}>
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Court time</h2>
        {courtAt && (
          <button
            type="button"
            onClick={() => updateSettings({ courtAt: null })}
            className="-my-2 rounded-full px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {courtAt
          ? `Booked for ${formatClock(courtAt)}. We count down to the moment you need to leave.`
          : "Pick your court time for a leave-by countdown."}
      </p>

      <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1" role="group" aria-label="Day">
        {DAYS.map(({ offset, label }) => (
          <button
            key={offset}
            type="button"
            aria-pressed={day === offset}
            onClick={() => setDayChoice(offset)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              day === offset ? "bg-white/15 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        ref={scroller}
        className="no-scrollbar relative -mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 py-1"
        role="group"
        aria-label="Court start time"
      >
        {slots.length === 0 && <p className="py-2 text-sm text-muted">No more courts today. Try tomorrow.</p>}
        {slots.map((slot) => {
          const iso = slot.toISOString();
          const selected = iso === selectedIso;
          return (
            <button
              key={iso}
              type="button"
              aria-pressed={selected}
              onClick={() => updateSettings({ courtAt: selected ? null : iso })}
              className={`tnum shrink-0 snap-center rounded-2xl border px-4 py-2.5 text-[15px] font-semibold transition-all active:scale-95 ${
                selected
                  ? "border-ball bg-ball text-bg shadow-[0_0_24px_-6px_var(--color-ball)]"
                  : "border-white/10 bg-white/5 text-ink hover:border-white/25"
              }`}
            >
              {formatClock(slot)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <div>
          <p className="text-sm font-medium">Arrive early</p>
          <p className="mt-0.5 text-xs text-muted">Time to park, change and warm up</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => stepBuffer(-1)}
            disabled={bufferIndex === 0}
            className="grid size-8 place-items-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-30"
            aria-label="Arrive less early"
          >
            <MinusIcon size={16} />
          </button>
          <output className="tnum w-14 text-center text-sm font-semibold" aria-live="polite">
            {bufferMin} min
          </output>
          <button
            type="button"
            onClick={() => stepBuffer(1)}
            disabled={bufferIndex === BUFFER_OPTIONS.length - 1}
            className="grid size-8 place-items-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-30"
            aria-label="Arrive earlier"
          >
            <PlusIcon size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
