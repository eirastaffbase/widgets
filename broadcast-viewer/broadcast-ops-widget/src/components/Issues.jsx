import React, { useState } from "react";
import { User, MessageSquare, Send } from "lucide-react";
import { SHOW_DETAILS } from "../constants.js";
import { SectionHeader } from "./Shared.jsx";

function fmtTimestamp(ts) {
  if (!ts || ts === "Just now") return ts || "Just now";
  try {
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    const diffMin = Math.floor((Date.now() - d) / 60000);
    if (diffMin < 1)  return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7)    return `${diffD}d ago`;
    return d.toLocaleDateString();
  } catch (_) { return ts; }
}

export function MediaIssues({ issues, role, replyDraft, setReplyDraft, submitReply, onOpenDetails }) {
  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Operations"
        title="Media Delivery Issues"
        subtitle={role === "station"
          ? "Reports you or other stations have submitted. Go to the TV Guide and click Report on any show to file a new issue."
          : "Review and respond to issues reported by stations."}
      />
      <div className="space-y-3">
        {issues.map((issue, idx) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            role={role}
            replyDraft={replyDraft[issue.id] || ""}
            setReplyDraft={(val) => setReplyDraft((prev) => ({ ...prev, [issue.id]: val }))}
            submitReply={() => submitReply(issue.id)}
            onOpenDetails={onOpenDetails}
            delay={idx * 40}
          />
        ))}
      </div>
    </div>
  );
}

function IssueCard({ issue, role, replyDraft, setReplyDraft, submitReply, onOpenDetails, delay }) {
  const [expanded, setExpanded] = useState(false);
  const statusColors = {
    Open:       { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
    "In Review":{ bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },
    Resolved:   { bg: "#d1fae5", fg: "#065f46", border: "#a7f3d0" },
  };
  const status     = statusColors[issue.status];
  const hasDetails = !!SHOW_DETAILS[issue.show];

  return (
    <div className="rounded-lg p-5 fade-in-up" style={{ background: "white", border: "1px solid #e5e2d8", animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              onClick={() => hasDetails && onOpenDetails(issue.show)}
              disabled={!hasDetails}
              className="font-display font-bold text-base transition-colors"
              style={{ color: "#1a2744", cursor: hasDetails ? "pointer" : "default", textDecoration: hasDetails ? "underline" : "none", textDecorationColor: "#f5a623", textUnderlineOffset: 3 }}
            >
              {issue.show}
            </button>
            <span className="text-xs" style={{ color: "#6b6a63" }}>· {issue.episode}</span>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#6b6a63" }}>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{issue.author} · {issue.station}</span>
            <span>{fmtTimestamp(issue.timestamp)}</span>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded uppercase tracking-wider flex-shrink-0" style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}>
          {issue.status}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "#1a2744", color: "white" }}>{issue.type}</span>
        {issue.tags.map((t) => (
          <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background: "#f5f3ee", color: "#1a2744", border: "1px solid #e5e2d8" }}>{t}</span>
        ))}
      </div>

      <p className="text-sm leading-relaxed" style={{ color: "#3a3833" }}>{issue.description}</p>

      {issue.replies.length > 0 && (
        <div className="mt-4 pl-4 space-y-3" style={{ borderLeft: "2px solid #f5a623" }}>
          {issue.replies.map((r, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="font-semibold" style={{ color: "#1a2744" }}>{r.author}</span>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#f5a623", color: "#1a2744" }}>HQ</span>
                <span style={{ color: "#6b6a63" }}>{r.timestamp}</span>
              </div>
              <p className="text-sm" style={{ color: "#3a3833" }}>{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {role === "hq" && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid #e5e2d8" }}>
          {!expanded ? (
            <button onClick={() => setExpanded(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: "#1a2744" }}>
              <MessageSquare className="w-3.5 h-3.5" /> Reply to station
            </button>
          ) : (
            <div className="space-y-2">
              <textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Respond to the station…" className="w-full rounded p-2 text-sm resize-none outline-none" style={{ background: "#f5f3ee", border: "1px solid #e5e2d8", color: "#1a2744", minHeight: 70 }} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setExpanded(false)} className="text-xs font-semibold" style={{ color: "#6b6a63" }}>Cancel</button>
                <button onClick={() => { submitReply(); setExpanded(false); }} disabled={!replyDraft.trim()} className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1" style={{ background: replyDraft.trim() ? "#1a2744" : "#e5e2d8", color: replyDraft.trim() ? "white" : "#a8a59a" }}>
                  <Send className="w-3 h-3" /> Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
