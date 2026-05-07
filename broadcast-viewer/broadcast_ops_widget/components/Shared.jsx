import React, { useState, useEffect } from "react";
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
      style={{ background: "rgba(15, 26, 48, 0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`${size === "lg" ? "max-w-5xl" : "max-w-2xl"} w-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col modal-content overflow-hidden`}
        style={{ background: "#f5f3ee", border: "1px solid #e5e2d8" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
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
      <div className="relative px-6 py-5 flex items-start justify-between flex-shrink-0" style={{ background: "linear-gradient(135deg, #1a2744 0%, #2d3f6b 100%)" }}>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#f5a623" }}>
            <Flag className="w-3 h-3 inline mr-1" /> Report Media Issue
          </div>
          <h2 className="font-display font-black text-xl text-white leading-tight">{scheduleItem.show}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: "#a8b4cc" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: channel.color, color: "white" }}>{channel.label}</span>
            <span>{scheduleItem.episode}</span>
            <span>·</span>
            <span>{scheduleItem.time} {scheduleItem.date}</span>
            <span>·</span>
            <span>{scheduleItem.duration} min</span>
          </div>
          {hasDetails && (
            <button onClick={onViewDetails} className="text-xs font-semibold mt-2 flex items-center gap-1 transition-opacity hover:opacity-80" style={{ color: "#f5a623" }}>
              View show 360° <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <button onClick={onClose} className="ml-4 p-1.5 rounded hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="overflow-y-auto scrollbar-thin flex-1 px-6 py-5 space-y-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6b6a63" }}>Issue Type</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {issueTypes.map(({ id, icon: Icon, desc }) => {
              const active = draft.type === id;
              return (
                <button key={id} onClick={() => setDraft({ ...draft, type: id, tags: [] })} className="rounded-lg p-3 text-left transition-all" style={{ background: active ? "#1a2744" : "white", border: `2px solid ${active ? "#f5a623" : "#e5e2d8"}` }}>
                  <Icon className="w-4 h-4 mb-1.5" style={{ color: active ? "#f5a623" : "#1a2744" }} />
                  <div className="text-xs font-bold" style={{ color: active ? "white" : "#1a2744" }}>{id}</div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: active ? "#a8b4cc" : "#6b6a63" }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6b6a63" }}>
            Common Tags <span className="font-normal normal-case" style={{ color: "#a8a59a" }}>· {draft.tags.length} selected</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(commonTags[draft.type] || []).map((t) => (
              <button key={t} onClick={() => toggleTag(t)} className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all" style={{ background: draft.tags.includes(t) ? "#f5a623" : "white", color: draft.tags.includes(t) ? "#1a2744" : "#6b6a63", border: `1px solid ${draft.tags.includes(t) ? "#f5a623" : "#e5e2d8"}` }}>
                {draft.tags.includes(t) ? <CheckCircle2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6b6a63" }}>
            Description <span style={{ color: "#be123c" }}>*</span>
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Describe what you're seeing or hearing. Include timecodes when possible."
            className="w-full rounded-lg p-3 text-sm resize-none outline-none"
            style={{ background: "white", border: "1px solid #e5e2d8", color: "#1a2744", minHeight: 120 }}
          />
          <div className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: "#6b6a63" }}>
            <AlertCircle className="w-3 h-3" /> Your report will route to the Operations team and appear in the Media Issues queue.
          </div>
        </div>
      </div>

      <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: "white", borderTop: "1px solid #e5e2d8" }}>
        <div className="text-xs" style={{ color: "#6b6a63" }}>Reporting as <strong style={{ color: "#1a2744" }}>Your Station</strong></div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-gray-100" style={{ color: "#6b6a63" }}>Cancel</button>
          <button onClick={() => onSubmit(draft)} disabled={!canSubmit} className="px-5 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all" style={{ background: canSubmit ? "#f5a623" : "#e5e2d8", color: canSubmit ? "#1a2744" : "#a8a59a", cursor: canSubmit ? "pointer" : "not-allowed" }}>
            <Send className="w-3.5 h-3.5" /> Submit Issue
          </button>
        </div>
      </div>
    </>
  );
}

export function ModalCard({ title, eyebrow, icon: Icon, iconColor, children }) {
  return (
    <div className="rounded-lg p-5" style={{ background: "white", border: "1px solid #e5e2d8" }}>
      <div className="flex items-start gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid #e5e2d8" }}>
        <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}15` }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6b6a63" }}>{eyebrow}</div>
          <div className="font-display font-bold text-base" style={{ color: "#1a2744" }}>{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function InfoBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6b6a63" }}>{label}</div>
      <div style={{ color: "#1a2744" }}>{value}</div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#f5a623" }}>{eyebrow}</div>
      <h1 className="font-display font-black text-3xl leading-tight" style={{ color: "#1a2744" }}>{title}</h1>
      <p className="text-sm mt-2 max-w-2xl" style={{ color: "#6b6a63" }}>{subtitle}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, message }) {
  return (
    <div className="rounded-lg p-12 text-center" style={{ background: "white", border: "1px dashed #cbc9c0" }}>
      <Icon className="w-10 h-10 mx-auto mb-3" style={{ color: "#cbc9c0" }} />
      <p className="text-sm" style={{ color: "#6b6a63" }}>{message}</p>
    </div>
  );
}

export function NotifItem({ title, detail, time, topic }) {
  return (
    <div className="p-3 hover:bg-gray-50 border-b" style={{ borderColor: "#e5e2d8" }}>
      <div className="flex items-start gap-2">
        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#f5a623" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>{topic}</span>
            <span className="text-[10px]" style={{ color: "#a8a59a" }}>{time}</span>
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: "#1a2744" }}>{title}</div>
          <div className="text-xs mt-0.5" style={{ color: "#6b6a63" }}>{detail}</div>
        </div>
      </div>
    </div>
  );
}
