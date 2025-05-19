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

import React, { useState, useEffect, ReactElement } from "react";
import { BlockAttributes } from "widget-sdk";

/* ——— API TYPES ——— */
interface ApiEntry {
  id: string;
  balance: number;
  policytype: string;
}
interface ApiResponse {
  entries: ApiEntry[];
}
export interface AbsenceViewerProps extends BlockAttributes {
  policytype?: string;
  hoursperday?: number;
}

/* ——— COMPONENT ——— */
export const AbsenceViewer = ({
  policytype = "Paid Time Off",
  hoursperday = 8,
}: AbsenceViewerProps): ReactElement => {
  const [hoursLeft, setHoursLeft] = useState<number>(hoursperday * 5.55);
  const [loading, setLoading] = useState<boolean>(true);
  const [showHours, setShowHours] = useState<boolean>(false);

  /* hover states */
  const [pillHover, setPillHover] = useState(false);
  const [arrowHover, setArrowHover] = useState(false);

  /* fetch once */
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(
          "/api/merge-dev/68279fb4583e7e664aa8ef2f/time-off-balance?limit=100",
          { headers: { "staffbase-app": "staffbase" } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiResponse = await res.json();
        const entry = data.entries.find(e => e.policytype === policytype);
        if (entry && Number.isFinite(entry.balance)) setHoursLeft(entry.balance);
      } catch (e) {
        console.warn("Absence viewer: using fallback 5.55 days", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [policytype]);

  /* values */
  const days   = (hoursLeft / hoursperday).toFixed(2);
  const hours  = hoursLeft.toFixed(2);
  const value  = showHours ? hours : days;
  const unit   = showHours ? "hours" : "days";

  /* ——— JSX ——— */
  return (
    <div
      style={{
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      {/* pill */}
      <button
        onClick={() => setShowHours(p => !p)}
        disabled={loading}
        onMouseEnter={() => setPillHover(true)}
        onMouseLeave={() => setPillHover(false)}
        style={{
          all: "unset",
          cursor: "pointer",
          background: pillHover ? "#F4F6F8" : "#EBF4FF",
          color: "#003366",
          borderRadius: "9999px",
          padding: "0.4rem 1.1rem",
          fontSize: "1.5rem",
          fontWeight: 600,
          lineHeight: 1.1,
          display: "flex",
          alignItems: "baseline",
          gap: "0.3rem",
        }}
        title="Click to toggle hours / days"
      >
        {loading ? "…" : value}
        <span style={{ fontSize: "0.9rem", fontWeight: 400 }}>{unit}</span>
      </button>

      {/* arrow */}
      <a
        href="https://app.staffbase.com/content/page/6827725cbe0b257321169628"
        onMouseEnter={() => setArrowHover(true)}
        onMouseLeave={() => setArrowHover(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "none",
          color: arrowHover ? "#0066CC" : "#212121",
          textDecoration: "none",
          fontSize: "1.15rem",
          fontWeight: 600,
          transition: "color 0.15s ease",
          cursor: "pointer",
        }}
        aria-label="View more"
      >
        →
      </a>
    </div>
  );
};