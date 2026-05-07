import React, { useState } from "react";
import { Search, X, Film, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { CHANNELS, SHOW_DETAILS } from "../constants.js";
import { SectionHeader, EmptyState } from "./Shared.jsx";

export function SearchView({ query, setQuery, results, onSelectShow }) {
  return (
    <div className="fade-in-up" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionHeader
        eyebrow="Discovery"
        title="Search the Catalog"
        subtitle="Find any show in the live programming schedule."
      />

      <div style={{ borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px", padding: "16px", background: "white", border: "2px solid #1a2744" }}>
        <Search style={{ width: "20px", height: "20px", color: "#1a2744", flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shows or episodes…"
          autoFocus
          style={{ flex: "1 1 0%", background: "transparent", outline: "none", fontSize: "16px", color: "#1a2744", border: "none" }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <X style={{ width: "16px", height: "16px", color: "#6b6a63" }} />
          </button>
        )}
      </div>

      {!query && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a63" }}>Suggested searches</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["Frontline", "Finding Your Roots", "Amanpour", "Plastics Trap", "Putin", "Icons of Hollywood"].map((s) => (
              <button key={s} onClick={() => setQuery(s)} style={{ padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, background: "white", color: "#1a2744", border: "1px solid #e5e2d8", cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && (
        <EmptyState icon={Search} message={`No results for "${query}". Try another term.`} />
      )}

      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a63" }}>
            {results.length} show{results.length === 1 ? "" : "s"} found
          </div>
          {results.map((r, idx) => (
            <ShowResultCard key={r.channel} result={r} idx={idx} onSelectShow={onSelectShow} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShowResultCard({ result, idx, onSelectShow }) {
  const [showEpisodes, setShowEpisodes] = useState(false);
  const ch = CHANNELS.find((c) => c.id === result.channel);
  const has360 = !!SHOW_DETAILS[result.show];

  return (
    <div className="fade-in-up" style={{ borderRadius: "8px", overflow: "hidden", background: "white", border: "1px solid #e5e2d8", animationDelay: `${idx * 30}ms` }}>
      <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: ch.color }}>
          <Film style={{ width: "20px", height: "20px", color: "white" }} />
        </div>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: "16px", color: "#1a2744" }}>{result.show}</div>
          <div style={{ fontSize: "12px", marginTop: "2px", color: "#6b6a63" }}>
            {result.episodes.length} episode{result.episodes.length === 1 ? "" : "s"} in schedule
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={() => setShowEpisodes(!showEpisodes)}
            style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px", background: showEpisodes ? "#f5a623" : "#f5f3ee", color: "#1a2744", border: `1px solid ${showEpisodes ? "#f5a623" : "#e5e2d8"}`, cursor: "pointer" }}
          >
            Episodes {showEpisodes ? <ChevronUp style={{ width: "12px", height: "12px" }} /> : <ChevronDown style={{ width: "12px", height: "12px" }} />}
          </button>
          <button
            onClick={() => onSelectShow(result.show)}
            disabled={!has360}
            style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px", background: has360 ? "#1a2744" : "#f5f3ee", color: has360 ? "white" : "#a8a59a", cursor: has360 ? "pointer" : "not-allowed", border: "none" }}
          >
            View 360° <ArrowUpRight style={{ width: "12px", height: "12px" }} />
          </button>
        </div>
      </div>

      {showEpisodes && (
        <div style={{ borderTop: "1px solid #e5e2d8" }}>
          {result.episodes.map((ep, i) => (
            <div
              key={ep.id}
              style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: "12px", borderBottom: i < result.episodes.length - 1 ? "1px solid #f0ede6" : "none", background: i % 2 === 0 ? "white" : "#fafaf8" }}
            >
              <div style={{ width: "6px", height: "6px", borderRadius: "9999px", marginTop: "8px", flexShrink: 0, background: ch.color }} />
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a2744" }}>{ep.episode}</div>
                {ep.teaser && <div style={{ fontSize: "12px", marginTop: "2px", color: "#6b6a63", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{ep.teaser}</div>}
              </div>
              <div style={{ fontSize: "12px", flexShrink: 0, textAlign: "right", color: "#6b6a63" }}>
                <div>{ep.date}</div>
                <div style={{ color: "#a8a59a" }}>{ep.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
