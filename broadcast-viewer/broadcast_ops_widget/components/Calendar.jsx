import React, { useMemo } from "react";
import { Tv, ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Flag } from "lucide-react";
import { CHANNELS, SHOW_DETAILS } from "../constants.js";
import { TODAY, DATE_RANGE, dateKey, formatShortDate, formatDayName, formatDayNumber, formatFullDate, isSameDay } from "../utils.js";
import { SectionHeader } from "./Shared.jsx";

export function Calendar360({
  viewMode, setViewMode,
  currentWeek, weekStartIndex, setWeekStartIndex,
  selectedDate, selectedDateKey, setSelectedDateKey,
  selectedChannels, toggleChannel,
  weekSchedule, daySchedule,
  role, onReportIssue, onViewShow, onDayClick,
}) {
  const weekLabel = `${formatShortDate(currentWeek[0])} – ${formatShortDate(currentWeek[currentWeek.length - 1])}`;
  const canGoPrev = weekStartIndex > 0;
  const canGoNext = weekStartIndex + 4 < 14;

  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Programming"
        title="Schedule Calendar"
        subtitle="Two-week rolling window in 4-day blocks. Click any day to see the hourly timeline."
      />

      {/* Toolbar */}
      <div className="rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: "white", border: "1px solid #e5e2d8" }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid #e5e2d8" }}>
            {[{ id: "week", Icon: LayoutGrid, label: "4-Day" }, { id: "day", Icon: CalendarDays, label: "Day" }].map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setViewMode(id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors" style={{ background: viewMode === id ? "#1a2744" : "white", color: viewMode === id ? "white" : "#1a2744" }}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {viewMode === "week" && (
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => canGoPrev && setWeekStartIndex(Math.max(0, weekStartIndex - 4))} disabled={!canGoPrev} className="p-1.5 rounded" style={{ background: canGoPrev ? "#f5f3ee" : "transparent", color: canGoPrev ? "#1a2744" : "#cbc9c0", cursor: canGoPrev ? "pointer" : "not-allowed" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold px-2" style={{ color: "#1a2744" }}>{weekLabel}</div>
              <button onClick={() => canGoNext && setWeekStartIndex(Math.min(10, weekStartIndex + 4))} disabled={!canGoNext} className="p-1.5 rounded" style={{ background: canGoNext ? "#f5f3ee" : "transparent", color: canGoNext ? "#1a2744" : "#cbc9c0", cursor: canGoNext ? "pointer" : "not-allowed" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {viewMode === "day" && (
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => { const i = DATE_RANGE.findIndex((d) => dateKey(d) === selectedDateKey); if (i > 0) setSelectedDateKey(dateKey(DATE_RANGE[i - 1])); }} className="p-1.5 rounded" style={{ background: "#f5f3ee", color: "#1a2744" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold px-2" style={{ color: "#1a2744" }}>{formatFullDate(selectedDate)}</div>
              <button onClick={() => { const i = DATE_RANGE.findIndex((d) => dateKey(d) === selectedDateKey); if (i < DATE_RANGE.length - 1) setSelectedDateKey(dateKey(DATE_RANGE[i + 1])); }} className="p-1.5 rounded" style={{ background: "#f5f3ee", color: "#1a2744" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <button onClick={() => { setSelectedDateKey(dateKey(TODAY)); setWeekStartIndex(0); }} className="text-xs font-semibold px-3 py-1.5 rounded" style={{ background: "#f5a623", color: "#1a2744" }}>
          Today
        </button>
      </div>

      {/* Channel filter */}
      <div className="rounded-lg p-4" style={{ background: "white", border: "1px solid #e5e2d8" }}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6b6a63" }}>
          <Tv className="w-3.5 h-3.5" /> Channels ({selectedChannels.length}/{CHANNELS.length})
        </div>
        <div className="flex gap-2 flex-wrap">
          {CHANNELS.map((c) => {
            const on = selectedChannels.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggleChannel(c.id)} className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-all" style={{ background: on ? c.color : "#f5f3ee", color: on ? "white" : "#1a2744", border: `1px solid ${on ? c.color : "#e5e2d8"}` }}>
                <span className="w-2 h-2 rounded-full" style={{ background: on ? "white" : c.color }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === "week" ? (
        <WeekGrid currentWeek={currentWeek} weekSchedule={weekSchedule} onDayClick={onDayClick} />
      ) : (
        <DayTimeline selectedDate={selectedDate} daySchedule={daySchedule} onViewShow={onViewShow} onReportIssue={onReportIssue} role={role} />
      )}
    </div>
  );
}

function WeekGrid({ currentWeek, weekSchedule, onDayClick }) {
  const scheduleByDay = useMemo(() => {
    const m = {};
    currentWeek.forEach((d) => (m[dateKey(d)] = []));
    weekSchedule.forEach((s) => { if (m[s.dateKey]) m[s.dateKey].push(s); });
    return m;
  }, [currentWeek, weekSchedule]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e5e2d8" }}>
      <div className="grid grid-cols-4">
        {currentWeek.map((d) => {
          const isToday   = isSameDay(d, TODAY);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayItems  = scheduleByDay[dateKey(d)] || [];
          return (
            <button key={dateKey(d)} onClick={() => onDayClick(d)} className="text-left p-4 transition-colors hover:bg-gray-50 flex flex-col min-w-0" style={{ borderRight: "1px solid #e5e2d8", borderBottom: "1px solid #e5e2d8", minHeight: 420, background: isToday ? "#fef9e7" : isWeekend ? "#faf8f3" : "white" }}>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>{formatDayName(d)}</div>
                  <div className="font-display font-black text-3xl leading-none" style={{ color: isToday ? "#f5a623" : "#1a2744" }}>{formatDayNumber(d)}</div>
                </div>
                {isToday && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "#f5a623", color: "#1a2744" }}>Today</span>}
              </div>
              <div className="space-y-1.5 flex-1 overflow-hidden">
                {dayItems.slice(0, 9).map((s) => {
                  const ch = CHANNELS.find((c) => c.id === s.channel);
                  return (
                    <div key={s.id} className="rounded px-2.5 py-1.5 text-[11px] leading-tight overflow-hidden" style={{ background: `${ch.color}12`, borderLeft: `3px solid ${ch.color}` }}>
                      <div className="font-bold truncate" style={{ color: "#1a2744" }}>{s.time} · {s.episode}</div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: "#6b6a63" }}>{ch.label} · {s.duration}m</div>
                    </div>
                  );
                })}
                {dayItems.length > 9 && <div className="text-[11px] font-semibold mt-1" style={{ color: "#f5a623" }}>+{dayItems.length - 9} more</div>}
                {dayItems.length === 0 && <div className="text-xs italic" style={{ color: "#a8a59a" }}>No programming</div>}
              </div>
              <div className="text-[11px] mt-3 pt-3 flex items-center gap-1 font-semibold" style={{ color: "#1a2744", borderTop: "1px solid #e5e2d8" }}>
                <CalendarDays className="w-3 h-3" /> View day timeline
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayTimeline({ selectedDate, daySchedule, onViewShow, onReportIssue, role }) {
  const HOURS   = Array.from({ length: 19 }, (_, i) => i + 5);
  const isToday = isSameDay(selectedDate, TODAY);

  const scheduleByHour = useMemo(() => {
    const m = {};
    daySchedule.forEach((s) => { if (!m[s.hour]) m[s.hour] = []; m[s.hour].push(s); });
    return m;
  }, [daySchedule]);

  const fmtHour = (h) => h === 0 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e5e2d8" }}>
      <div className="px-5 py-4" style={{ background: isToday ? "#fef9e7" : "#f5f3ee", borderBottom: "1px solid #e5e2d8" }}>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg flex flex-col items-center justify-center flex-shrink-0" style={{ background: isToday ? "#f5a623" : "#1a2744" }}>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isToday ? "#1a2744" : "#f5a623" }}>{formatDayName(selectedDate)}</div>
            <div className="font-display font-black text-xl leading-none" style={{ color: isToday ? "#1a2744" : "white" }}>{formatDayNumber(selectedDate)}</div>
          </div>
          <div>
            <div className="font-display font-bold text-lg" style={{ color: "#1a2744" }}>{formatFullDate(selectedDate)}</div>
            <div className="text-xs" style={{ color: "#6b6a63" }}>{daySchedule.length} program{daySchedule.length === 1 ? "" : "s"} scheduled</div>
          </div>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "#e5e2d8" }}>
        {HOURS.map((h) => {
          const items = scheduleByHour[h] || [];
          return (
            <div key={h} className="flex">
              <div className="w-20 px-4 py-3 text-xs font-semibold flex-shrink-0" style={{ background: "#faf8f3", color: "#6b6a63", borderRight: "1px solid #e5e2d8" }}>
                {fmtHour(h)}
              </div>
              <div className="flex-1 py-3 px-3 space-y-2">
                {items.length === 0 ? (
                  <div className="text-xs italic py-1" style={{ color: "#cbc9c0" }}>—</div>
                ) : items.map((s) => {
                  const ch         = CHANNELS.find((c) => c.id === s.channel);
                  const hasDetails = !!SHOW_DETAILS[s.show];
                  return (
                    <div key={s.id} className="rounded-lg p-3 flex items-center gap-3 transition-shadow hover:shadow-sm" style={{ background: `${ch.color}08`, border: `1px solid ${ch.color}30`, borderLeft: `3px solid ${ch.color}` }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: ch.color, color: "white" }}>{ch.label}</span>
                          <span className="text-xs font-bold" style={{ color: "#1a2744" }}>{s.time}</span>
                          <span className="text-xs" style={{ color: "#6b6a63" }}>· {s.duration} min</span>
                        </div>
                        <div className="font-display font-bold text-sm mt-0.5" style={{ color: "#1a2744" }}>{s.episode}</div>
                        {s.teaser && <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "#6b6a63" }}>{s.teaser}</div>}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => onViewShow(s)} disabled={!hasDetails} className="text-[11px] font-semibold px-2.5 py-1.5 rounded flex items-center gap-1" style={{ background: "white", color: hasDetails ? "#1a2744" : "#a8a59a", border: "1px solid #e5e2d8", cursor: hasDetails ? "pointer" : "not-allowed" }}>
                          Details <ChevronRight className="w-3 h-3" />
                        </button>
                        {role === "station" && (
                          <button onClick={() => onReportIssue(s)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded flex items-center gap-1" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                            <Flag className="w-3 h-3" /> Report
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
