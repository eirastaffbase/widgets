/*!
 * Copyright 2024, Staffbase GmbH and contributors.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement, useState, useEffect, useMemo } from "react";
import { BlockAttributes } from "widget-sdk";
import { DateTime } from "luxon";
import { defaultShifts } from "./configuration-schema";
import { FaBuilding, FaChevronLeft, FaChevronRight } from "react-icons/fa";

import Calendar from 'react-calendar';

interface Shift {
  shiftdate: string;
  shiftduration: number;
  shifttimestart: string;
  shiftlocation: string;
  shiftname: string;
}

interface ProcessedShift extends Shift {
  id: string;
  startDateTime: DateTime;
  endDateTime: DateTime;
}

export interface ShiftViewerProps extends BlockAttributes {
  shifts: Shift[];
  shiftsastext: string;
  detailview: boolean | string;
  detailpagelink: string;
}

const parseShiftDateTime = (shift: Shift): { start: DateTime; end: DateTime } => {
    const { shiftdate, shifttimestart, shiftduration } = shift;
    let baseDate: DateTime;
    const today = DateTime.now().startOf("day");
    const relativeMatch = shiftdate.trim().match(/^today(?:\s*\+\s*(\d+))?$/i);
    if (relativeMatch) {
      const daysToAdd = relativeMatch[1] ? parseInt(relativeMatch[1], 10) : 0;
      baseDate = today.plus({ days: daysToAdd });
    } else {
      baseDate = DateTime.fromISO(shiftdate).startOf("day");
    }
    const [hour, minute] = shifttimestart.split(":").map(Number);
    const startDateTime = baseDate.set({ hour, minute });
    const endDateTime = startDateTime.plus({ hours: shiftduration });
    return { start: startDateTime, end: endDateTime };
};

const getDayWithOrdinal = (dt: DateTime): string => {
  const day = dt.day;
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
};

const getDateLabel = (date: DateTime): string => {
    const today = DateTime.now().startOf("day");
    if (date.hasSame(today, "day")) return "Today";
    if (date.hasSame(today.plus({ days: 1 }), "day")) return "Tomorrow";
    return `${getDayWithOrdinal(date)} ${date.toFormat("LLLL")}`;
};

export const ShiftViewer = ({ shifts, shiftsastext, detailview, detailpagelink }: ShiftViewerProps): ReactElement => {
  const isDetailViewEnabled = String(detailview) === 'true';

  const [processedShifts, setProcessedShifts] = useState<ProcessedShift[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    let dataToProcess: Shift[] = [];
    if (shiftsastext) {
      try {
        const parsedFromText = JSON.parse(shiftsastext);
        if (Array.isArray(parsedFromText)) { dataToProcess = parsedFromText; }
      } catch (e) { console.error("Error parsing shiftsastext JSON, falling back.", e); }
    }
    if (dataToProcess.length === 0 && Array.isArray(shifts) && shifts.length > 0) { dataToProcess = shifts; }
    if (dataToProcess.length === 0) { dataToProcess = defaultShifts; }
    
    const allShifts = dataToProcess.map((shift, index) => {
      const { start, end } = parseShiftDateTime(shift);
      return { ...shift, id: `${shift.shiftname}-${index}`, startDateTime: start, endDateTime: end };
    });
    const sortedShifts = allShifts.sort((a, b) => a.startDateTime.toMillis() - b.startDateTime.toMillis());
    setProcessedShifts(sortedShifts);
  }, [shifts, shiftsastext]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ProcessedShift[]>();
    processedShifts.forEach(shift => {
      const dateKey = shift.startDateTime.toISODate(); // "YYYY-MM-DD"
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(shift);
    });
    return map;
  }, [processedShifts]);


  // --- RENDER LOGIC ---

  if (isDetailViewEnabled) {
    // --- DETAIL VIEW (CALENDAR) ---
    const selectedDateISO = DateTime.fromJSDate(selectedDate).toISODate();
    const shiftsForSelectedDay = shiftsByDate.get(selectedDateISO) || [];

    return (
      <div className="shifts-widget shifts-widget--detail-view" style={{ fontFamily: "sans-serif" }}>
        <style>{`
          .react-calendar { border: none; font-family: sans-serif; }
          .react-calendar__navigation button { font-size: 1.25em; font-weight: bold; }
          .react-calendar__month-view__weekdays__weekday { text-align: center; }
          .react-calendar__tile { position: relative; }
          .react-calendar__tile--now { background: #e6e6e6; }
          .react-calendar__tile--active { background: #198374; color: white; }
          .shift-dot { height: 6px; width: 6px; background-color: #198374; border-radius: 50%; position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); }
        `}</style>
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          className="shifts-widget__calendar"
          prevLabel={<FaChevronLeft />}
          nextLabel={<FaChevronRight />}
          // NEW: Function to render dots on days that have shifts
          tileContent={({ date, view }) => {
            if (view === 'month') {
              const dateKey = DateTime.fromJSDate(date).toISODate();
              if (shiftsByDate.has(dateKey)) {
                return <div className="shift-dot"></div>;
              }
            }
            return null;
          }}
        />
        
        {/* --- SHIFTS FOR SELECTED DAY --- */}
        <div className="shifts-widget__day-details" style={{ marginTop: '24px' }}>
          {shiftsForSelectedDay.map(shift => (
            <div key={shift.id} className="shifts-widget__day-shift-item" style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div className="shifts-widget__day-time" style={{ flexShrink: 0, fontWeight: 'bold' }}>
                {shift.startDateTime.toFormat("h:mm a")}
              </div>
              <div className="shifts-widget__day-shift-card" style={{ flexGrow: 1, backgroundColor: '#498374', color: 'white', borderRadius: '8px', padding: '16px' }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d0e0dc", fontSize: '0.9em', marginBottom: '4px' }}>
                    <FaBuilding />
                    <span>{shift.shiftlocation}</span>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{shift.shiftname}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- SUMMARY VIEW (SINGLE SHIFT CARD) ---
  const now = DateTime.now();
  const upcomingShifts = processedShifts.filter(shift => shift.endDateTime > now);
  const nextShift = upcomingShifts[0];

  if (!nextShift) {
    return <div className="shifts-widget shifts-widget--no-shifts" style={{ padding: "16px" }}>No upcoming shifts.</div>;
  }
  
  return (
    <div
      className="shifts-widget shifts-widget--summary-view"
      style={{
        backgroundColor: "#198374",
        color: "white",
        borderRadius: "16px",
        padding: "24px",
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* --- Top Section: Location & Details Button --- */}
      <div className="shifts-widget__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="shifts-widget__location" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d0e0dc", fontSize: '0.9em' }}>
            <FaBuilding className="shifts-widget__location-icon" />
            <span className="shifts-widget__location-text">{nextShift.shiftlocation}</span>
          </div>
          <h2 className="shifts-widget__shift-name" style={{ margin: 0, fontSize: "1.75em" }}>{nextShift.shiftname}</h2>
        </div>
        {detailpagelink && (
          <a
            href={detailpagelink}
            className="shifts-widget__details-button"
            style={{
              padding: "10px 24px",
              border: "1px solid white",
              borderRadius: "24px",
              color: "white",
              textDecoration: "none",
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            Details
          </a>
        )}
      </div>

      {/* --- Bottom Section: Date & Time --- */}
      <div className="shifts-widget__footer" style={{ display: "flex", gap: "48px", paddingTop: '16px' }}>
        <div className="shifts-widget__date-info">
          <div className="shifts-widget__label" style={{ fontSize: "0.8em", color: "#d0e0dc", marginBottom: "4px" }}>DATE</div>
          <div className="shifts-widget__date-value" style={{ fontSize: "1.1em", fontWeight: "bold" }}>{getDateLabel(nextShift.startDateTime)}</div>
        </div>
        <div className="shifts-widget__time-info">
          <div className="shifts-widget__label" style={{ fontSize: "0.8em", color: "#d0e0dc", marginBottom: "4px" }}>TIME</div>
          <div className="shifts-widget__time-value" style={{ fontSize: "1.1em", fontWeight: "bold" }}>
            {nextShift.startDateTime.toFormat("h:mm a")} - {nextShift.endDateTime.toFormat("h:mm a")}
          </div>
        </div>
      </div>
    </div>
  );
};