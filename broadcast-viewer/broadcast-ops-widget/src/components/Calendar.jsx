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
    <div className="fade-in-up" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionHeader
        eyebrow="Programming"
        title="Schedule Calendar"
        subtitle="Two-week rolling window in 4-day blocks. Click any day to see the hourly timeline."
      />

      {/* Toolbar */}
      <div style={{ borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", background: "white", border: "1px solid #e5e2d8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", borderRadius: "6px", overflow: "hidden", border: "1px solid #e5e2d8" }}>
            {[{ id: "week", Icon: LayoutGrid, label: "4-Day" }, { id: "day", Icon: CalendarDays, label: "Day" }].map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setViewMode(id)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, background: viewMode === id ? "#1a2744" : "white", color: viewMode === id ? "white" : "#1a2744", border: "none", cursor: "pointer" }}>
                <Icon style={{ width: "14px", height: "14px" }} /> {label}
              </button>
            ))}
          </div>

          {viewMode === "week" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "8px" }}>
              <button onClick={() => canGoPrev && setWeekStartIndex(Math.max(0, weekStartIndex - 4))} disabled={!canGoPrev} style={{ padding: "6px", borderRadius: "4px", background: canGoPrev ? "#f5f3ee" : "transparent", color: canGoPrev ? "#1a2744" : "#cbc9c0", cursor: canGoPrev ? "pointer" : "not-allowed", border: "none" }}>
                <ChevronLeft style={{ width: "16px", height: "16px" }} />
              </button>
              <div style={{ fontSize: "14px", fontWeight: 600, padding: "0 8px", color: "#1a2744" }}>{weekLabel}</div>
              <button onClick={() => canGoNext && setWeekStartIndex(Math.min(10, weekStartIndex + 4))} disabled={!canGoNext} style={{ padding: "6px", borderRadius: "4px", background: canGoNext ? "#f5f3ee" : "transparent", color: canGoNext ? "#1a2744" : "#cbc9c0", cursor: canGoNext ? "pointer" : "not-allowed", border: "none" }}>
                <ChevronRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          )}

          {viewMode === "day" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "8px" }}>
              <button onClick={() => { const i = DATE_RANGE.findIndex((d) => dateKey(d) === selectedDateKey); if (i > 0) setSelectedDateKey(dateKey(DATE_RANGE[i - 1])); }} style={{ padding: "6px", borderRadius: "4px", background: "#f5f3ee", color: "#1a2744", border: "none", cursor: "pointer" }}>
                <ChevronLeft style={{ width: "16px", height: "16px" }} />
              </button>
              <div style={{ fontSize: "14px", fontWeight: 600, padding: "0 8px", color: "#1a2744" }}>{formatFullDate(selectedDate)}</div>
              <button onClick={() => { const i = DATE_RANGE.findIndex((d) => dateKey(d) === selectedDateKey); if (i < DATE_RANGE.length - 1) setSelectedDateKey(dateKey(DATE_RANGE[i + 1])); }} style={{ padding: "6px", borderRadius: "4px", background: "#f5f3ee", color: "#1a2744", border: "none", cursor: "pointer" }}>
                <ChevronRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          )}
        </div>

        <button onClick={() => { setSelectedDateKey(dateKey(TODAY)); setWeekStartIndex(0); }} style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "4px", background: "#f5a623", color: "#1a2744", border: "none", cursor: "pointer" }}>
          Today
        </button>
      </div>

      {/* Channel filter */}
      <div style={{ borderRadius: "8px", padding: "16px", background: "white", border: "1px solid #e5e2d8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", color: "#6b6a63" }}>
          <Tv style={{ width: "14px", height: "14px" }} /> Channels ({selectedChannels.length}/{CHANNELS.length})
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {CHANNELS.map((c) => {
            const on = selectedChannels.includes(c.id);
            return (
              <button key={c.id} onClick={() => toggleChannel(c.id)} style={{ padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", background: on ? c.color : "#f5f3ee", color: on ? "white" : "#1a2744", border: `1px solid ${on ? c.color : "#e5e2d8"}`, cursor: "pointer" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "9999px", display: "inline-block", background: on ? "white" : c.color, flexShrink: 0 }} />
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
    <div style={{ borderRadius: "8px", overflow: "hidden", background: "white", border: "1px solid #e5e2d8" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {currentWeek.map((d) => {
          const isToday   = isSameDay(d, TODAY);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayItems  = scheduleByDay[dateKey(d)] || [];
          return (
            <button key={dateKey(d)} onClick={() => onDayClick(d)} style={{ textAlign: "left", padding: "16px", display: "flex", flexDirection: "column", minWidth: 0, borderRight: "1px solid #e5e2d8", borderBottom: "1px solid #e5e2d8", minHeight: "420px", background: isToday ? "#fef9e7" : isWeekend ? "#faf8f3" : "white", cursor: "pointer", border: "none", borderRight: "1px solid #e5e2d8", borderBottom: "1px solid #e5e2d8", boxSizing: "border-box" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a63" }}>{formatDayName(d)}</div>
                  <div className="font-display" style={{ fontWeight: 900, fontSize: "30px", lineHeight: 1, color: isToday ? "#f5a623" : "#1a2744" }}>{formatDayNumber(d)}</div>
                </div>
                {isToday && <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 8px", borderRadius: "4px", background: "#f5a623", color: "#1a2744" }}>Today</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 0%", overflow: "hidden" }}>
                {dayItems.slice(0, 9).map((s) => {
                  const ch = CHANNELS.find((c) => c.id === s.channel);
                  return (
                    <div key={s.id} style={{ borderRadius: "4px", padding: "6px 10px", fontSize: "12px", lineHeight: "1.3", overflow: "hidden", background: `${ch.color}12`, borderLeft: `3px solid ${ch.color}` }}>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a2744" }}>{s.time} · {ch.label}</div>
                      <div style={{ fontSize: "11px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#6b6a63" }}>{s.duration}m</div>
                    </div>
                  );
                })}
                {dayItems.length > 9 && <div style={{ fontSize: "12px", fontWeight: 600, marginTop: "4px", color: "#f5a623" }}>+{dayItems.length - 9} more</div>}
                {dayItems.length === 0 && <div style={{ fontSize: "12px", fontStyle: "italic", color: "#a8a59a" }}>No programming</div>}
              </div>
              <div style={{ fontSize: "12px", marginTop: "12px", paddingTop: "12px", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600, color: "#1a2744", borderTop: "1px solid #e5e2d8" }}>
                <CalendarDays style={{ width: "12px", height: "12px" }} /> View day timeline
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOUR_PX = 96;

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
    <div style={{ borderRadius: "8px", overflow: "hidden", background: "white", border: "1px solid #e5e2d8" }}>
      <div style={{ padding: "16px 20px", background: isToday ? "#fef9e7" : "#f5f3ee", borderBottom: "1px solid #e5e2d8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, background: isToday ? "#f5a623" : "#1a2744" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: isToday ? "#1a2744" : "#f5a623" }}>{formatDayName(selectedDate)}</div>
            <div className="font-display" style={{ fontWeight: 900, fontSize: "20px", lineHeight: 1, color: isToday ? "#1a2744" : "white" }}>{formatDayNumber(selectedDate)}</div>
          </div>
          <div>
            <div className="font-display" style={{ fontWeight: 700, fontSize: "18px", color: "#1a2744" }}>{formatFullDate(selectedDate)}</div>
            <div style={{ fontSize: "12px", color: "#6b6a63" }}>{daySchedule.length} program{daySchedule.length === 1 ? "" : "s"} scheduled</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", minHeight: totalH }}>
        {/* Hour labels */}
        <div style={{ width: "80px", flexShrink: 0, position: "relative", borderRight: "1px solid #e5e2d8" }}>
          {HOURS.map((h) => (
            <div key={h} style={{ padding: "4px 12px", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "flex-start", paddingTop: "4px", height: HOUR_PX, color: h === nowHour && isToday ? "#dc2626" : "#6b6a63", background: h === nowHour && isToday ? "#fff5f5" : "transparent", borderBottom: "1px solid #e5e2d8", boxSizing: "border-box" }}>
              {fmtHour(h)}
            </div>
          ))}
        </div>

        {/* Timeline body */}
        <div style={{ flex: 1, position: "relative", height: totalH }}>
          {HOURS.map((h, i) => (
            <div key={h} style={{ position: "absolute", top: i * HOUR_PX, left: 0, right: 0, height: HOUR_PX, borderBottom: "1px solid #e5e2d8", boxSizing: "border-box", background: h === nowHour && isToday ? "#fff5f5" : "transparent" }} />
          ))}

          {nowTop !== null && nowTop >= 0 && nowTop <= totalH && (
            <div style={{ position: "absolute", top: nowTop, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center" }}>
              <div style={{ height: 2, flex: 1, background: "#dc2626" }} />
              <div style={{ padding: "0 8px", fontSize: "12px", fontWeight: 700, flexShrink: 0, color: "#dc2626", background: "white" }}>{nowLabel}</div>
            </div>
          )}

          {laidOut.map((s) => {
            const ch         = CHANNELS.find((c) => c.id === s.channel);
            const hasDetails = !!SHOW_DETAILS[s.show];
            const top    = ((s.hour - MIN_HOUR) + s.minute / 60) * HOUR_PX;
            const height = (s.duration / 60) * HOUR_PX;
            const colW   = 1 / s.totalCols;
            return (
              <div key={s.id} style={{ position: "absolute", top: top + 2, left: `calc(${s.col * colW * 100}% + 4px)`, width: `calc(${colW * 100}% - 8px)`, height: height - 4, borderRadius: 6, background: `${ch.color}10`, border: `1px solid ${ch.color}40`, borderLeft: `4px solid ${ch.color}`, boxSizing: "border-box", zIndex: 5, overflow: "hidden", display: "flex", flexDirection: "column", padding: height - 4 < 28 ? "2px 6px" : "6px 8px" }}>
                {height - 4 >= 20 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "4px", flexShrink: 0, lineHeight: 1, background: ch.color, color: "white" }}>{ch.label}</span>
                    {height - 4 >= 26 && <span style={{ fontSize: "11px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1a2744" }}>{s.time} · {s.duration}m</span>}
                  </div>
                )}
                {height - 4 >= 52 && <div style={{ fontSize: "11px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#3a3833" }}>{s.episode}</div>}
                {height - 4 >= 80 && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "auto", paddingTop: "4px", flexWrap: "wrap" }}>
                    <button onClick={() => onViewShow(s)} disabled={!hasDetails} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "2px", background: "white", color: hasDetails ? "#1a2744" : "#a8a59a", border: "1px solid #e5e2d8", cursor: hasDetails ? "pointer" : "not-allowed" }}>
                      Details <ChevronRight style={{ width: "10px", height: "10px" }} />
                    </button>
                    {role === "station" && (
                      <button onClick={() => onReportIssue(s)} style={{ fontSize: "11px", fontWeight: 600, padding: "4px 8px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "2px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", cursor: "pointer" }}>
                        <Flag style={{ width: "10px", height: "10px" }} /> Report
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
