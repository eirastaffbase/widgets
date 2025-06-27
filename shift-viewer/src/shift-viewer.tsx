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

import React, { ReactElement, useState, useEffect } from "react";
import { BlockAttributes } from "widget-sdk";
import { DateTime } from "luxon";
import { defaultShifts } from "./configuration-schema";
// NEW: Import the icon from react-icons
import { FaBuilding } from "react-icons/fa";

// ... (Interfaces and Helper Functions remain the same) ...
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
  dateLabel: string;
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

const getDateLabel = (date: DateTime): string => {
    const today = DateTime.now().startOf("day");
    if (date.hasSame(today, "day")) return "Today";
    if (date.hasSame(today.plus({ days: 1 }), "day")) return "Tomorrow";
    // CHANGED: Match "31st July" format from screenshot
    return date.toFormat("d'st' LLLL");
};


export const ShiftViewer = ({ shifts, shiftsastext, detailview, detailpagelink }: ShiftViewerProps): ReactElement => {
  const isDetailViewEnabled = String(detailview) === 'true';

  const [processedShifts, setProcessedShifts] = useState<ProcessedShift[]>([]);

  useEffect(() => {
    let dataToProcess: Shift[] = [];
    if (shiftsastext) {
      try {
        const parsedFromText = JSON.parse(shiftsastext);
        if (Array.isArray(parsedFromText)) {
            dataToProcess = parsedFromText;
        }
      } catch (e) {
        console.error("Error parsing shiftsastext JSON, falling back.", e);
      }
    }
    if (dataToProcess.length === 0 && Array.isArray(shifts) && shifts.length > 0) {
      dataToProcess = shifts;
    }
    if (dataToProcess.length === 0) {
      dataToProcess = defaultShifts;
    }
    const allShifts = dataToProcess.map((shift, index) => {
      const { start, end } = parseShiftDateTime(shift);
      const dateLabel = getDateLabel(start);
      return {
        ...shift,
        id: `${shift.shiftname}-${index}`,
        startDateTime: start,
        endDateTime: end,
        dateLabel: dateLabel,
      };
    });
    const sortedShifts = allShifts.sort((a, b) => a.startDateTime.toMillis() - b.startDateTime.toMillis());
    setProcessedShifts(sortedShifts);
  }, [shifts, shiftsastext]);

  const now = DateTime.now();
  const upcomingShifts = processedShifts.filter(shift => shift.endDateTime > now);

  // --- RENDER LOGIC ---
  if (isDetailViewEnabled) {
    // --- DETAIL VIEW (CALENDAR) ---
    // This remains a simple list for now, as requested.
    return (
      <div className="shifts-widget shifts-widget--detail-view" style={{ fontFamily: "sans-serif" }}>
        <h2 className="shifts-widget__title" style={{ marginTop: 0 }}>Upcoming Shifts</h2>
        <ul className="shifts-widget__list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
          {upcomingShifts.map((shift) => (
            <li key={shift.id} className="shifts-widget__list-item" style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "16px" }}>
              {/* ... list item content ... */}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // --- SUMMARY VIEW (SINGLE SHIFT CARD) ---
  const nextShift = upcomingShifts[0];

  if (!nextShift) {
    return <div className="shifts-widget shifts-widget--no-shifts" style={{ padding: "16px" }}>No upcoming shifts.</div>;
  }

  // NEW: JSX for the single card view based on the screenshot
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
          <div className="shifts-widget__date-value" style={{ fontSize: "1.1em", fontWeight: "bold" }}>{nextShift.dateLabel}</div>
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