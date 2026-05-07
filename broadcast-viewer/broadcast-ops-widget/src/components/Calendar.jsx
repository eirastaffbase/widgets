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
                    <div key={s.id} className="rounded px-2.5 py-1.5 text-xs leading-tight overflow-hidden" style={{ background: `${ch.color}12`, borderLeft: `3px solid ${ch.color}` }}>
                      <div className="font-bold truncate" style={{ color: "#1a2744" }}>{s.time} · {ch.label}</div>
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: "#6b6a63" }}>{s.duration}m</div>
                    </div>
                  );
                })}
                {dayItems.length > 9 && <div className="text-xs font-semibold mt-1" style={{ color: "#f5a623" }}>+{dayItems.length - 9} more</div>}
                {dayItems.length === 0 && <div className="text-xs italic" style={{ color: "#a8a59a" }}>No programming</div>}
              </div>
              <div className="text-xs mt-3 pt-3 flex items-center gap-1 font-semibold" style={{ color: "#1a2744", borderTop: "1px solid #e5e2d8" }}>
                <CalendarDays className="w-3 h-3" /> View day timeline
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOUR_PX = 96; // pixels per hour

function layoutShows(shows) {
  const timed = shows.map((s) => ({
    ...s,
    startMin: s.hour * 60 + s.minute,
    endMin:   s.hour * 60 + s.minute + s.duration,
    col: 0,
    totalCols: 1,
  })).sort((a, b) => a.startMin - b.startMin);

  const cols = [];
  for (const s of timed) {
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c][cols[c].length - 1].endMin <= s.startMin) {
        cols[c].push(s); s.col = c; placed = true; break;
      }
    }
    if (!placed) { s.col = cols.length; cols.push([s]); }
  }

  for (const s of timed) {
    let max = s.col + 1;
    for (const o of timed) {
      if (o !== s && o.startMin < s.endMin && s.startMin < o.endMin) max = Math.max(max, o.col + 1);
    }
    s.totalCols = max;
  }
  return timed;
}

function DayTimeline({ selectedDate, daySchedule, onViewShow, onReportIssue, role }) {
  const HOURS   = Array.from({ length: 19 }, (_, i) => i + 5);
  const MIN_HOUR = HOURS[0];
  const isToday = isSameDay(selectedDate, TODAY);

  const nowET     = new Date(Date.now() - 4 * 3600 * 1000);
  const nowHour   = isToday ? nowET.getUTCHours() : -1;
  const nowMinute = isToday ? nowET.getUTCMinutes() : 0;

  const fmtHour = (h) => h === 0 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
  const nowLabel = (() => {
    const ampm = nowHour < 12 ? "AM" : "PM";
    const h12  = nowHour === 0 ? 12 : nowHour > 12 ? nowHour - 12 : nowHour;
    return nowMinute > 0 ? `${h12}:${String(nowMinute).padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
  })();

  const laidOut  = useMemo(() => layoutShows(daySchedule), [daySchedule]);
  const totalH   = HOURS.length * HOUR_PX;
  const nowTop   = isToday ? ((nowHour - MIN_HOUR) + nowMinute / 60) * HOUR_PX : null;

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

      <div className="flex" style={{ minHeight: totalH }}>
        {/* Hour labels */}
        <div className="w-20 flex-shrink-0 relative" style={{ borderRight: "1px solid #e5e2d8" }}>
          {HOURS.map((h) => (
            <div key={h} className="px-3 text-sm font-semibold flex items-start pt-1" style={{ height: HOUR_PX, color: h === nowHour && isToday ? "#dc2626" : "#6b6a63", background: h === nowHour && isToday ? "#fff5f5" : "transparent", borderBottom: "1px solid #e5e2d8", boxSizing: "border-box" }}>
              {fmtHour(h)}
            </div>
          ))}
        </div>

        {/* Timeline body */}
        <div className="flex-1 relative" style={{ height: totalH }}>
          {/* Hour grid lines */}
          {HOURS.map((h, i) => (
            <div key={h} style={{ position: "absolute", top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX, borderBottom: "1px solid #e5e2d8", boxSizing: "border-box", background: h === nowHour && isToday ? "#fff5f5" : "transparent" }} />
          ))}

          {/* NOW line */}
          {nowTop !== null && nowTop >= 0 && nowTop <= totalH && (
            <div style={{ position: "absolute", top: nowTop, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center" }}>
              <div style={{ height: 2, flex: 1, background: "#dc2626" }} />
              <div className="px-2 text-xs font-bold flex-shrink-0" style={{ color: "#dc2626", background: "white" }}>{nowLabel}</div>
            </div>
          )}

          {/* Show cards */}
          {laidOut.map((s) => {
            const ch         = CHANNELS.find((c) => c.id === s.channel);
            const hasDetails = !!SHOW_DETAILS[s.show];
            const top    = ((s.hour - MIN_HOUR) + s.minute / 60) * HOUR_PX;
            const height = (s.duration / 60) * HOUR_PX;
            const colW   = 1 / s.totalCols;
            return (
              <div key={s.id} style={{ position: "absolute", top: top + 2, left: `calc(${s.col * colW * 100}% + 4px)`, width: `calc(${colW * 100}% - 8px)`, height: height - 4, borderRadius: 6, background: `${ch.color}10`, border: `1px solid ${ch.color}40`, borderLeft: `4px solid ${ch.color}`, boxSizing: "border-box", zIndex: 5, overflow: "hidden", display: "flex", flexDirection: "column", padding: height - 4 < 28 ? "2px 6px" : "6px 8px" }}>
                {height - 4 >= 20 && (
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 leading-none" style={{ background: ch.color, color: "white" }}>{ch.label}</span>
                    {height - 4 >= 26 && <span className="text-[11px] font-bold truncate" style={{ color: "#1a2744" }}>{s.time} · {s.duration}m</span>}
                  </div>
                )}
                {height - 4 >= 52 && <div className="text-[11px] mt-0.5 truncate" style={{ color: "#3a3833" }}>{s.episode}</div>}
                {height - 4 >= 80 && (
                  <div className="flex gap-1.5 mt-auto pt-1 flex-wrap">
                    <button onClick={() => onViewShow(s)} disabled={!hasDetails} className="text-[11px] font-semibold px-2 py-1 rounded flex items-center gap-0.5" style={{ background: "white", color: hasDetails ? "#1a2744" : "#a8a59a", border: "1px solid #e5e2d8", cursor: hasDetails ? "pointer" : "not-allowed" }}>
                      Details <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                    {role === "station" && (
                      <button onClick={() => onReportIssue(s)} className="text-[11px] font-semibold px-2 py-1 rounded flex items-center gap-0.5" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        <Flag className="w-2.5 h-2.5" /> Report
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
