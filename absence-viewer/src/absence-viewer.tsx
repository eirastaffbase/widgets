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

/*!
 * Copyright 2025, Staffbase
 * Apache-2.0
 */

import React, { useState, useEffect, ReactElement } from "react";
import { BlockAttributes } from "widget-sdk";

/* ——— TYPES ——— */
interface ApiEntry {
  id: string;
  balance: number;          // returns hours
  policytype: string;       // e.g. "Paid Time Off"
}
interface ApiResponse {
  entries: ApiEntry[];
}
export interface AbsenceViewerProps extends BlockAttributes {
  policytype?: string;      // default "Paid Time Off"
  hoursperday?: number;     // default 8
}

/* ——— COMPONENT ——— */
export const AbsenceViewer = ({
  policytype = "Paid Time Off",
  hoursperday = 8,
}: AbsenceViewerProps): ReactElement => {
  /** store hours so we can always re-compute days if config changes */
  const [hoursLeft, setHoursLeft] = useState<number>(hoursperday * 5.55); // = 5.55 days
  const [loading, setLoading] = useState<boolean>(true);

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
        if (entry && Number.isFinite(entry.balance)) {
          setHoursLeft(entry.balance);
        }
      } catch (e) {
        console.warn("Absence viewer: falling back to 5.55 days", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [policytype]);

  /* helpers */
  const daysLeft = (hoursLeft / hoursperday).toFixed(2);

  /* ——— JSX ——— */
  return (
    <div
      style={{
        fontFamily: "inherit",
        borderRadius: 8,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        alignItems: "flex-start",
      }}
    >
      {/* heading + palm-tree */}
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "1.25rem",
          fontWeight: 600,
          margin: 0,
        }}
      >
        Paid time off
        {/* tiny palm-tree icon (light blue) */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 32 32"
          fill="#5BC0FF"
          aria-hidden="true"
        >
          <path d="M11.177 1.287c-1.75... (rest of path unchanged)"></path>
        </svg>
      </h2>

      {/* balance */}
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 600,
          lineHeight: 1.1,
        }}
      >
        {loading ? "…" : daysLeft}{" "}
        <span style={{ fontSize: "1rem", fontWeight: 400 }}>days remaining</span>
      </div>

      {/* view-more button */}
      <a
        href="https://app.staffbase.com/content/page/6827725cbe0b257321169628"
        style={{
          padding: "0.45rem 1rem",
          borderRadius: 4,
          background: "#00A4FD",
          color: "#fff",
          textDecoration: "none",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        View more
      </a>
    </div>
  );
};