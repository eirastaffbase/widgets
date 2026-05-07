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
    <div className="fade-in-up" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionHeader
        eyebrow="Operations"
        title="Media Delivery Issues"
        subtitle={role === "station"
          ? "Reports you or other stations have submitted. Go to the TV Guide and click Report on any show to file a new issue."
          : "Review and respond to issues reported by stations."}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
    <div className="fade-in-up" style={{ borderRadius: "8px", padding: "20px", background: "white", border: "1px solid #e5e2d8", animationDelay: `${delay}ms` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "12px" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <button
              onClick={() => hasDetails && onOpenDetails(issue.show)}
              disabled={!hasDetails}
              className="font-display"
              style={{ fontWeight: 700, fontSize: "16px", color: "#1a2744", cursor: hasDetails ? "pointer" : "default", textDecoration: hasDetails ? "underline" : "none", textDecorationColor: "#f5a623", textUnderlineOffset: "3px", background: "transparent", border: "none", padding: 0, textAlign: "left" }}
            >
              {issue.show}
            </button>
            <span style={{ fontSize: "12px", color: "#6b6a63" }}>· {issue.episode}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#6b6a63" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><User style={{ width: "12px", height: "12px" }} />{issue.author} · {issue.station}</span>
            <span>{fmtTimestamp(issue.timestamp)}</span>
          </div>
        </div>
        <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}>
          {issue.status}
        </span>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 8px", borderRadius: "4px", background: "#1a2744", color: "white" }}>{issue.type}</span>
        {issue.tags.map((t) => (
          <span key={t} style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "4px", background: "#f5f3ee", color: "#1a2744", border: "1px solid #e5e2d8" }}>{t}</span>
        ))}
      </div>

      <p style={{ fontSize: "14px", lineHeight: "1.625", color: "#3a3833", margin: 0 }}>{issue.description}</p>

      {issue.replies.length > 0 && (
        <div style={{ marginTop: "16px", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "12px", borderLeft: "2px solid #f5a623" }}>
          {issue.replies.map((r, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", marginBottom: "4px" }}>
                <span style={{ fontWeight: 600, color: "#1a2744" }}>{r.author}</span>
                <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "4px", background: "#f5a623", color: "#1a2744" }}>HQ</span>
                <span style={{ color: "#6b6a63" }}>{r.timestamp}</span>
              </div>
              <p style={{ fontSize: "14px", color: "#3a3833", margin: 0 }}>{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {role === "hq" && (
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e2d8" }}>
          {!expanded ? (
            <button onClick={() => setExpanded(true)} style={{ fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", color: "#1a2744", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
              <MessageSquare style={{ width: "14px", height: "14px" }} /> Reply to station
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Respond to the station…" style={{ width: "100%", borderRadius: "4px", padding: "8px", fontSize: "14px", resize: "none", outline: "none", background: "#f5f3ee", border: "1px solid #e5e2d8", color: "#1a2744", minHeight: "70px", boxSizing: "border-box" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button onClick={() => setExpanded(false)} style={{ fontSize: "12px", fontWeight: 600, color: "#6b6a63", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
                <button onClick={() => { submitReply(); setExpanded(false); }} disabled={!replyDraft.trim()} style={{ fontSize: "12px", fontWeight: 600, padding: "6px 12px", borderRadius: "4px", display: "flex", alignItems: "center", gap: "4px", background: replyDraft.trim() ? "#1a2744" : "#e5e2d8", color: replyDraft.trim() ? "white" : "#a8a59a", border: "none", cursor: replyDraft.trim() ? "pointer" : "not-allowed" }}>
                  <Send style={{ width: "12px", height: "12px" }} /> Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
