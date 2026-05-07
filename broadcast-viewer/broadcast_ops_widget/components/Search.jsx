import React from "react";
import { Search, X, Film, ArrowUpRight } from "lucide-react";
import { CHANNELS, SHOW_DETAILS } from "../constants.js";
import { SectionHeader, EmptyState } from "./Shared.jsx";

export function SearchView({ query, setQuery, results, onSelectShow }) {
  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Discovery"
        title="Search the Catalog"
        subtitle="Find any show or episode in the live programming schedule."
      />

      <div className="rounded-lg flex items-center gap-3 p-4" style={{ background: "white", border: "2px solid #1a2744" }}>
        <Search className="w-5 h-5" style={{ color: "#1a2744" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shows or episodes…"
          autoFocus
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: "#1a2744" }}
        />
        {query && (
          <button onClick={() => setQuery("")}><X className="w-4 h-4" style={{ color: "#6b6a63" }} /></button>
        )}
      </div>

      {!query && (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>Suggested searches</div>
          <div className="flex gap-2 flex-wrap">
            {["Frontline", "Finding Your Roots", "Amanpour", "Plastics Trap", "Putin", "Icons of Hollywood"].map((s) => (
              <button key={s} onClick={() => setQuery(s)} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "white", color: "#1a2744", border: "1px solid #e5e2d8" }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && (
        <EmptyState icon={Search} message={`No results for "${query}". Try another term.`} />
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>
            {results.length} result{results.length === 1 ? "" : "s"}
          </div>
          {results.map((r, idx) => {
            const ch     = CHANNELS.find((c) => c.id === r.channel);
            const has360 = !!SHOW_DETAILS[r.show];
            return (
              <div key={r.id} className="rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition-shadow fade-in-up" style={{ background: "white", border: "1px solid #e5e2d8", animationDelay: `${idx * 30}ms` }}>
                <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: ch.color }}>
                  <Film className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-base" style={{ color: "#1a2744" }}>{r.episode}</div>
                  <div className="text-xs" style={{ color: "#6b6a63" }}>{r.show} · {r.time} {r.date}</div>
                  {r.teaser && <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "#6b6a63" }}>{r.teaser}</div>}
                </div>
                <button onClick={() => onSelectShow(r.show)} disabled={!has360} className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1" style={{ background: has360 ? "#1a2744" : "#f5f3ee", color: has360 ? "white" : "#a8a59a", cursor: has360 ? "pointer" : "not-allowed" }}>
                  {has360 ? "View 360°" : "No details"}<ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
