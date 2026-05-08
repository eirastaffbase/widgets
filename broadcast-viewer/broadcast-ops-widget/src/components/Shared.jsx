import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Send, Plus, CheckCircle2, Flag, Film, Radio, Eye, FileText, AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { CHANNELS, SHOW_DETAILS } from "../constants.js";

export function Modal({ children, onClose, size = "lg" }) {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Render into document.body via portal so position:fixed escapes any
  // Staffbase container that has overflow:hidden or CSS transforms applied.
  return createPortal(
    <div
      className="bow-portal modal-backdrop"
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(15,26,48,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{ maxWidth: size === "lg" ? "1024px" : "672px", width: "100%", maxHeight: "90vh", borderRadius: "12px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f5f3ee", border: "1px solid #e5e2d8" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ReportForm({ scheduleItem, onSubmit, onClose, onViewDetails }) {
  const [draft, setDraft] = useState({ type: "Video", tags: [], description: "" });
  const channel    = CHANNELS.find((c) => c.id === scheduleItem.channel);
  const hasDetails = !!SHOW_DETAILS[scheduleItem.show];
  const canSubmit  = draft.description.trim().length > 0;

  const issueTypes = [
    { id: "Video",         icon: Film,      desc: "Picture quality, artifacts" },
    { id: "Audio",         icon: Radio,     desc: "Sound issues, levels" },
    { id: "Accessibility", icon: Eye,       desc: "Captions, descriptions" },
    { id: "Metadata",      icon: FileText,  desc: "Wrong info, titles" },
    { id: "Rights",        icon: Flag,      desc: "Clearance problems" },
  ];

  const commonTags = {
    Video:         ["Flicker", "Visual discrepancy", "Frame drop", "Color shift", "Wrong aspect ratio"],
    Audio:         ["Audio dropout", "Levels too low", "Sync issue", "Distortion"],
    Accessibility: ["No closed captioning", "Missing audio description", "Caption sync off"],
    Metadata:      ["Wrong title", "Wrong episode", "Missing info"],
    Rights:        ["Wrong territory", "Window expired", "Missing clearance"],
  };

  const toggleTag = (t) =>
    setDraft({ ...draft, tags: draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] });

  return (
    <>
      <div style={{ position: "relative", padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, background: "linear-gradient(135deg, #1a2744 0%, #2d3f6b 100%)" }}>
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", color: "#f5a623", display: "flex", alignItems: "center", gap: "4px" }}>
            <Flag style={{ width: "12px", height: "12px" }} /> Report Media Issue
          </div>
          <h2 className="font-display" style={{ fontWeight: 900, fontSize: "20px", color: "white", lineHeight: "1.25" }}>{scheduleItem.show}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", fontSize: "12px", flexWrap: "wrap", color: "#a8b4cc" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "4px", background: channel.color, color: "white" }}>{channel.label}</span>
            <span>{scheduleItem.episode}</span>
            <span>·</span>
            <span>{scheduleItem.time} {scheduleItem.date}</span>
            <span>·</span>
            <span>{scheduleItem.duration} min</span>
          </div>
          {hasDetails && (
            <button onClick={onViewDetails} style={{ fontSize: "12px", fontWeight: 600, marginTop: "8px", display: "flex", alignItems: "center", gap: "4px", color: "#f5a623", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
              View show 360° <ArrowUpRight style={{ width: "12px", height: "12px" }} />
            </button>
          )}
        </div>
        <button onClick={onClose} style={{ marginLeft: "16px", padding: "6px", borderRadius: "4px", background: "transparent", border: "none", cursor: "pointer" }}>
          <X style={{ width: "20px", height: "20px", color: "white" }} />
        </button>
      </div>

      <div className="scrollbar-thin" style={{ overflowY: "auto", flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", color: "#6b6a63" }}>Issue Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px" }}>
            {issueTypes.map(({ id, icon: Icon, desc }) => {
              const active = draft.type === id;
              return (
                <button key={id} onClick={() => setDraft({ ...draft, type: id, tags: [] })} className="bow-full" style={{ borderRadius: "8px", padding: "12px", textAlign: "left", flexDirection: "column", alignItems: "flex-start", height: "100%", background: active ? "#1a2744" : "white", border: `2px solid ${active ? "#f5a623" : "#e5e2d8"}`, cursor: "pointer" }}>
                  <Icon style={{ width: "16px", height: "16px", marginBottom: "6px", color: active ? "#f5a623" : "#1a2744" }} />
                  <div style={{ fontSize: "12px", fontWeight: 700, color: active ? "white" : "#1a2744" }}>{id}</div>
                  <div style={{ fontSize: "10px", marginTop: "2px", lineHeight: "1.3", color: active ? "#a8b4cc" : "#6b6a63" }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", color: "#6b6a63" }}>
            Common Tags <span style={{ fontWeight: 400, textTransform: "none", color: "#a8a59a" }}>· {draft.tags.length} selected</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {(commonTags[draft.type] || []).map((t) => (
              <button key={t} onClick={() => toggleTag(t)} style={{ padding: "4px 10px", borderRadius: "9999px", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px", background: draft.tags.includes(t) ? "#f5a623" : "white", color: draft.tags.includes(t) ? "#1a2744" : "#6b6a63", border: `1px solid ${draft.tags.includes(t) ? "#f5a623" : "#e5e2d8"}`, cursor: "pointer" }}>
                {draft.tags.includes(t) ? <CheckCircle2 style={{ width: "12px", height: "12px" }} /> : <Plus style={{ width: "12px", height: "12px" }} />}
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", color: "#6b6a63" }}>
            Description <span style={{ color: "#be123c" }}>*</span>
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Describe what you're seeing or hearing. Include timecodes when possible."
            style={{ width: "100%", borderRadius: "8px", padding: "12px", fontSize: "14px", resize: "none", outline: "none", background: "white", border: "1px solid #e5e2d8", color: "#1a2744", minHeight: "120px", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: "11px", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px", color: "#6b6a63" }}>
            <AlertCircle style={{ width: "12px", height: "12px" }} /> Your report will route to the Operations team and appear in the Media Issues queue.
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "white", borderTop: "1px solid #e5e2d8" }}>
        <div style={{ fontSize: "12px", color: "#6b6a63" }}>Reporting as <strong style={{ color: "#1a2744" }}>Your Station</strong></div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 600, borderRadius: "8px", color: "#6b6a63", background: "transparent", border: "none", cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onSubmit(draft)} disabled={!canSubmit} style={{ padding: "8px 20px", fontSize: "14px", fontWeight: 700, borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px", background: canSubmit ? "#f5a623" : "#e5e2d8", color: canSubmit ? "#1a2744" : "#a8a59a", cursor: canSubmit ? "pointer" : "not-allowed", border: "none" }}>
            <Send style={{ width: "14px", height: "14px" }} /> Submit Issue
          </button>
        </div>
      </div>
    </>
  );
}

export function ModalCard({ title, eyebrow, icon: Icon, iconColor, children }) {
  return (
    <div style={{ borderRadius: "8px", padding: "20px", background: "white", border: "1px solid #e5e2d8" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #e5e2d8" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${iconColor}15` }}>
          <Icon style={{ width: "16px", height: "16px", color: iconColor }} />
        </div>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3px", color: "#6b6a63" }}>{eyebrow}</div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: "16px", color: "#1a2744" }}>{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function InfoBlock({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px", color: "#6b6a63" }}>{label}</div>
      <div style={{ color: "#1a2744" }}>{value}</div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px", color: "#f5a623" }}>{eyebrow}</div>
      <h1 className="font-display" style={{ fontWeight: 900, fontSize: "30px", lineHeight: "1.25", color: "#1a2744", margin: 0 }}>{title}</h1>
      <p style={{ fontSize: "14px", marginTop: "8px", maxWidth: "672px", color: "#6b6a63", margin: "8px 0 0 0" }}>{subtitle}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, message }) {
  return (
    <div style={{ borderRadius: "8px", padding: "48px", textAlign: "center", background: "white", border: "1px dashed #cbc9c0" }}>
      <Icon style={{ width: "40px", height: "40px", margin: "0 auto 12px", display: "block", color: "#cbc9c0" }} />
      <p style={{ fontSize: "14px", color: "#6b6a63", margin: 0 }}>{message}</p>
    </div>
  );
}

export function NotifItem({ title, detail, time, topic }) {
  return (
    <div style={{ padding: "12px", borderBottom: "1px solid #e5e2d8" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "9999px", marginTop: "6px", flexShrink: 0, background: "#f5a623" }} />
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a63" }}>{topic}</span>
            <span style={{ fontSize: "10px", color: "#a8a59a" }}>{time}</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "2px", color: "#1a2744" }}>{title}</div>
          <div style={{ fontSize: "12px", marginTop: "2px", color: "#6b6a63" }}>{detail}</div>
        </div>
      </div>
    </div>
  );
}
