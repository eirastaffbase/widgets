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

import React, {
  ReactElement,
  useState,
  useEffect,
  useMemo,
} from "react";
import { BlockAttributes } from "widget-sdk";
import { DateTime } from "luxon";
import { defaultShifts } from "./configuration-schema";
import { FaBuilding } from "react-icons/fa";

import Calendar from "react-calendar";

// Interfaces and helper functions remain the same...
interface Shift {
  shiftdate: string;
  shiftduration: number;
  shifttimestart: string;
  shiftlocation: string;
  shiftname: string;
  coworkerimages?: string[];
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

const parseShiftDateTime = (
  shift: Shift
): { start: DateTime; end: DateTime } | null => {
  const { shiftdate, shifttimestart, shiftduration } = shift;
  let baseDate: DateTime;
  const today = DateTime.now().startOf("day");

  const relativeMatch = shiftdate.trim().match(/^today\s*([+-])\s*(\d+)/i);
  const todayMatch = shiftdate.trim().match(/^today$/i);

  if (relativeMatch) {
    const operator = relativeMatch[1];
    const days = parseInt(relativeMatch[2], 10);
    if (operator === "+") {
      baseDate = today.plus({ days });
    } else {
      baseDate = today.minus({ days });
    }
  } else if (todayMatch) {
    baseDate = today;
  } else {
    baseDate = DateTime.fromISO(shiftdate).startOf("day");
  }

  if (!baseDate.isValid) {
    console.error("Invalid base date parsed from:", shiftdate);
    return null;
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
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

const getDateLabel = (date: DateTime): string => {
  const today = DateTime.now().startOf("day");
  if (date.hasSame(today, "day")) return "Today";
  if (date.hasSame(today.plus({ days: 1 }), "day")) return "Tomorrow";
  return `${getDayWithOrdinal(date)} ${date.toFormat("LLLL")}`;
};

export const ShiftViewer = ({
  shifts,
  shiftsastext,
  detailview,
  detailpagelink,
}: ShiftViewerProps): ReactElement => {
  const isDetailViewEnabled = String(detailview) === "true";

  const [processedShifts, setProcessedShifts] = useState<ProcessedShift[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeStartDate, setActiveStartDate] = useState<Date>(new Date());

  useEffect(() => {
    let dataToProcess: Shift[] = [];
    if (shiftsastext) {
      try {
        const parsedFromText = JSON.parse(shiftsastext);
        if (Array.isArray(parsedFromText)) {
          dataToProcess = parsedFromText;
        }
      } catch (e) {
        // Fallback is handled below
      }
    }
    if (
      dataToProcess.length === 0 &&
      Array.isArray(shifts) &&
      shifts.length > 0
    ) {
      dataToProcess = shifts;
    }
    if (dataToProcess.length === 0) {
      dataToProcess = defaultShifts;
    }

    const allShifts = dataToProcess
      .map((shift, index) => {
        const parsed = parseShiftDateTime(shift);
        if (!parsed) return null;
        return {
          ...shift,
          id: `${shift.shiftname}-${index}`,
          startDateTime: parsed.start,
          endDateTime: parsed.end,
        };
      })
      .filter((s): s is ProcessedShift => s !== null);

    const sortedShifts = allShifts.sort(
      (a, b) => a.startDateTime.toMillis() - b.startDateTime.toMillis()
    );
    setProcessedShifts(sortedShifts);
  }, [shifts, shiftsastext]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ProcessedShift[]>();
    processedShifts.forEach((shift) => {
      const dateKey = shift.startDateTime.toISODate() as string;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(shift);
    });
    return map;
  }, [processedShifts]);

  if (isDetailViewEnabled) {
    const selectedDateISO = DateTime.fromJSDate(selectedDate).toISODate();
    const shiftsForSelectedDay = selectedDateISO
      ? shiftsByDate.get(selectedDateISO) || []
      : [];

    const handleTodayClick = () => {
      const today = new Date();
      setActiveStartDate(today);
      setSelectedDate(today);
    };

    const handlePreviousMonth = () => {
      setActiveStartDate((prev) =>
        DateTime.fromJSDate(prev).minus({ months: 1 }).toJSDate()
      );
    };

    const handleNextMonth = () => {
      setActiveStartDate((prev) =>
        DateTime.fromJSDate(prev).plus({ months: 1 }).toJSDate()
      );
    };

    return (
      <div
        className="shifts-widget shifts-widget--detail-view"
        style={{ fontFamily: "sans-serif" }}
      >
        <style>{`
          .react-calendar { width: 100%; background: transparent; border: none; font-family: sans-serif; }
          .react-calendar button { margin: 0; border: 0; outline: none; background: none; transition: background-color 0.2s; }
          .react-calendar button:enabled:hover { cursor: pointer; }
          .react-calendar__navigation { display: none; }
          .react-calendar__month-view__weekdays { text-align: center; font-weight: bold; font-size: 0.9em; }
          .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }

          .react-calendar__tile {
            position: relative;
            max-width: 100%;
            padding: 10px 6px;
            text-align: center;
            font-size: 0.9em;
            background-color: transparent;
          }
          
          .shifts-widget__calendar .react-calendar__tile { color: #545459; }
          .shifts-widget__calendar .react-calendar__month-view__days__day--neighboringMonth { color: #80C2B7; }

          .shifts-widget__calendar .react-calendar__tile--active {
            font-weight: bold;
            color: white;
            background: transparent !important;
            isolation: isolate;
          }
          .shifts-widget__calendar .react-calendar__tile--active:enabled:hover {
            background: transparent !important;
          }

          .shifts-widget__calendar .react-calendar__tile--active::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: #0071E3;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            z-index: -1;
          }
          
          .shifts-widget__calendar .react-calendar__tile--now { font-weight: bold; }
          .shift-dot { height: 4px; width: 4px; background-color: #198374; border-radius: 50%; position: absolute; left: 50%; transform: translateX(-50%); }


        `}</style>

        {/* Section 1: Calendar */}
        <div
          className="shifts-widget__calendar-container"
          style={{
            background: "#D3E6EC",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "16px",
          }}
        >
          <div
            className="shifts-widget__calendar-header"
            style={{ padding: "0 8px" }}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.5em" }}>
              {DateTime.fromJSDate(activeStartDate).toFormat("LLLL yyyy")}
            </h2>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <button
                onClick={handleTodayClick}
                style={{
                  width: "85px",
                  height: "38px",
                  borderRadius: "8.25px",
                  marginLeft: "0px",
                  border: "0px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "white",
                  color: "#0071E3",
                  fontSize: "1em",
                }}
              >
                Today
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handlePreviousMonth}
                  style={{
                    width: "38px",
                    height: "38px",
                    fontSize: "1.2em",
                    color: "#0071E3",
                    display: "grid",
                    placeItems: "center",
                    background: "white",
                    borderRadius: "8.25px",
                    border: "0px",
                  }}
                >
                  &lt;
                </button>
                <button
                  onClick={handleNextMonth}
                  style={{
                    width: "38px",
                    height: "38px",
                    fontSize: "1.2em",
                    color: "#0071E3",
                    display: "grid",
                    placeItems: "center",
                    background: "white",
                    borderRadius: "8.25px",
                    border: "0px",
                  }}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>

          <Calendar
            onChange={(value) => setSelectedDate(value as Date)}
            onActiveStartDateChange={({ activeStartDate }) =>
              setActiveStartDate(activeStartDate as Date)
            }
            value={selectedDate}
            activeStartDate={activeStartDate}
            className="shifts-widget__calendar"
            navigationLabel={() => null}
            prev2Label={null}
            next2Label={null}
            tileContent={({ date, view }) => {
              if (view === "month") {
                const dateKey =
                  DateTime.fromJSDate(date).toISODate() as string;
                if (shiftsByDate.has(dateKey)) {
                  // Don't show dot if the tile is active
                  const isActive =
                    DateTime.fromJSDate(selectedDate).toISODate() === dateKey;
                  if (!isActive) {
                    return <div className="shift-dot"></div>;
                  }
                }
              }
              return null;
            }}
          />
        </div>

        {/* Section 2: Time/Shift Details */}
        <div
          className="shifts-widget__details-container"
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "16px",
          }}
        >
          <div className="shifts-widget__day-details" style={{ marginTop: 0 }}>
            <div
              style={{
                display: "flex",
                gap: "16px",
                color: "#555",
                fontSize: "0.9em",
                fontWeight: "bold",
                paddingBottom: "8px",
              }}
            >
              <div style={{ width: "90px", flexShrink: 0 }}>Time</div>
              <div>Shift</div>
            </div>
            {shiftsForSelectedDay.length > 0 ? (
              shiftsForSelectedDay.map((shift) => (
                <div
                  key={shift.id}
                  className="shifts-widget__day-shift-item"
                  style={{ display: "flex", gap: "16px", marginTop: "16px" }}
                >
                  <div
                    className="shifts-widget__day-time"
                    style={{
                      flexShrink: 0,
                      width: "90px",
                      fontSize: "0.9em",
                      lineHeight: "1.5",
                    }}
                  >
                    <div style={{ fontWeight: "bold" }}>
                      {shift.startDateTime.toFormat("h:mm a")}
                    </div>
                    <div style={{ color: "#9B9BA0" }}>
                      {shift.endDateTime.toFormat("h:mm a")}
                    </div>
                  </div>
                  <div
                    className="shifts-widget__day-shift-card"
                    style={{
                      flexGrow: 1,
                      backgroundColor: "#198374",
                      color: "white",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#d0e0dc",
                        fontSize: "0.9em",
                        marginBottom: "4px",
                      }}
                    >
                      <FaBuilding />
                      <span>{shift.shiftlocation}</span>
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: "1.2em" }}>
                      {shift.shiftname}
                    </div>

                    {/* ✨ Co-worker images section ✨ */}
                    {shift.coworkerimages &&
                      shift.coworkerimages.length > 0 && (
                        <div style={{ marginTop: "16px" }}>
                          <h4
                            style={{
                              margin: "0 0 8px 0",
                              fontSize: "0.8em",
                              color: "#d0e0dc",
                              letterSpacing: "0.5px",
                              textTransform: "uppercase",
                            }}
                          >
                            Co-workers
                          </h4>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {shift.coworkerimages.map((img, index) => {
                              const isFullUrl = img.startsWith("http");
                              const imageUrl = isFullUrl
                                ? img
                                : `https://apple.staffbase.rocks/api/media/secure/external/v2/image/upload/${img}.png`;

                              return (
                                <img
                                  key={index}
                                  src={imageUrl}
                                  alt={`Coworker ${index + 1}`}
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "50%",
                                    border: "2px solid #198374",
                                    objectFit: "cover",
                                    marginLeft: index > 0 ? "-8px" : 0,
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  marginTop: "16px",
                  color: "#555",
                  textAlign: "center",
                }}
              >
                No shifts scheduled on this day
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- SUMMARY VIEW (SINGLE SHIFT CARD) ---
  const now = DateTime.now();
  const upcomingShifts = processedShifts.filter(
    (shift) => shift.endDateTime > now
  );
  const nextShift = upcomingShifts[0];

  if (!nextShift) {
    return (
      <div
        className="shifts-widget shifts-widget--no-shifts"
        style={{ padding: "16px" }}
      >
        No upcoming shifts.
      </div>
    );
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
        gap: "8px" /* Adjusted gap */,
      }}
    >
      <div
        style={{
          fontSize: "1em",
          color: "white",
          fontWeight: "bold",
          marginBottom: "10px",
        }}
      >
        Your next shift
      </div>

      <div
        className="shifts-widget__header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          className="shifts-widget__location"
          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#d0e0dc",
              fontSize: "0.9em",
            }}
          >
            <FaBuilding className="shifts-widget__location-icon" />
            <span className="shifts-widget__location-text">
              {nextShift.shiftlocation}
            </span>
          </div>
          <h2
            className="shifts-widget__shift-name"
            style={{
              margin: 0,
              fontSize: "1.75em",
              color: "white",
              fontWeight: "bold",
            }}
          >
            {nextShift.shiftname}
          </h2>
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
      <div
        className="shifts-widget__footer"
        style={{ display: "flex", gap: "48px", paddingTop: "16px" }}
      >
        <div className="shifts-widget__date-info">
          <div
            className="shifts-widget__label"
            style={{
              fontSize: "0.8em",
              color: "#d0e0dc",
              marginBottom: "4px",
            }}
          >
            DATE
          </div>
          <div className="shifts-widget__date-value" style={{ fontSize: "1.1em" }}>
            {getDateLabel(nextShift.startDateTime)}
          </div>
        </div>
        <div className="shifts-widget__time-info">
          <div
            className="shifts-widget__label"
            style={{
              fontSize: "0.8em",
              color: "#d0e0dc",
              marginBottom: "4px",
            }}
          >
            TIME
          </div>
          <div className="shifts-widget__time-value" style={{ fontSize: "1.1em" }}>
            {nextShift.startDateTime.toFormat("h:mm a")} -{" "}
            {nextShift.endDateTime.toFormat("h:mm a")}
          </div>
        </div>
      </div>
    </div>
  );
};