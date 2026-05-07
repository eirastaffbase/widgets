import React, { useState } from "react";
import { Search, X, Film, ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { CHANNELS, SHOW_DETAILS } from "../constants.js";
import { SectionHeader, EmptyState } from "./Shared.jsx";

export function SearchView({ query, setQuery, results, onSelectShow }) {
  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Discovery"
        title="Search the Catalog"
        subtitle="Find any show in the live programming schedule."
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
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>
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
    <div className="rounded-lg fade-in-up overflow-hidden" style={{ background: "white", border: "1px solid #e5e2d8", animationDelay: `${idx * 30}ms` }}>
      <div className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: ch.color }}>
          <Film className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-base" style={{ color: "#1a2744" }}>{result.show}</div>
          <div className="text-xs mt-0.5" style={{ color: "#6b6a63" }}>
            {result.episodes.length} episode{result.episodes.length === 1 ? "" : "s"} in schedule
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowEpisodes(!showEpisodes)}
            className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
            style={{ background: showEpisodes ? "#f5a623" : "#f5f3ee", color: "#1a2744", border: `1px solid ${showEpisodes ? "#f5a623" : "#e5e2d8"}` }}
          >
            Episodes {showEpisodes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => onSelectShow(result.show)}
            disabled={!has360}
            className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1"
            style={{ background: has360 ? "#1a2744" : "#f5f3ee", color: has360 ? "white" : "#a8a59a", cursor: has360 ? "pointer" : "not-allowed" }}
          >
            View 360° <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {showEpisodes && (
        <div style={{ borderTop: "1px solid #e5e2d8" }}>
          {result.episodes.map((ep, i) => (
            <div
              key={ep.id}
              className="px-4 py-3 flex items-start gap-3"
              style={{ borderBottom: i < result.episodes.length - 1 ? "1px solid #f0ede6" : "none", background: i % 2 === 0 ? "white" : "#fafaf8" }}
            >
              <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: ch.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: "#1a2744" }}>{ep.episode}</div>
                {ep.teaser && <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "#6b6a63" }}>{ep.teaser}</div>}
              </div>
              <div className="text-xs flex-shrink-0 text-right" style={{ color: "#6b6a63" }}>
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
