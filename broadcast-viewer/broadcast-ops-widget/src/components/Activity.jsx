import React from "react";
import { Bell, Mail, BellRing, CheckCircle2, AlertCircle, Calendar, Flag, Film, Hash } from "lucide-react";
import { SectionHeader, ModalCard } from "./Shared.jsx";

const ACTIVITY_TOPICS = [
  { id: "bugs",   label: "Media Issues",      icon: AlertCircle, desc: "Station-reported media file problems" },
  { id: "guide",  label: "Schedule Updates",  icon: Calendar,    desc: "Changes to the programming guide" },
  { id: "rights", label: "Rights & Clearances", icon: Flag,      desc: "New windows, expirations, territory changes" },
  { id: "shows",  label: "Show Metadata",     icon: Film,        desc: "New contributor notes and advisories" },
];

export function ActivityStream({ subscriptions, toggleSubscription, notifDelivery, setNotifDelivery }) {
  return (
    <div className="fade-in-up" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SectionHeader
        eyebrow="Stay Informed"
        title="Activity Stream"
        subtitle="Subscribe to topics to receive updates by email and in-app when something changes."
      />

      <ModalCard title="Delivery Preferences" eyebrow="How you want to hear about it" icon={Bell} iconColor="#1a2744">
        <div style={{ display: "flex", gap: "12px" }}>
          {[{ key: "email", Icon: Mail, label: "Email" }, { key: "inApp", Icon: BellRing, label: "In-app" }].map(({ key, Icon, label }) => (
            <button key={key} onClick={() => setNotifDelivery({ ...notifDelivery, [key]: !notifDelivery[key] })} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "6px", fontSize: "14px", fontWeight: 600, minWidth: "120px", justifyContent: "center", background: notifDelivery[key] ? "#1a2744" : "#f5f3ee", color: notifDelivery[key] ? "white" : "#1a2744", border: `1px solid ${notifDelivery[key] ? "#1a2744" : "#e5e2d8"}`, cursor: "pointer" }}>
              <Icon style={{ width: "16px", height: "16px" }} /> {label} {notifDelivery[key] && <CheckCircle2 style={{ width: "16px", height: "16px" }} />}
            </button>
          ))}
        </div>
      </ModalCard>

      <div>
        <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px", color: "#6b6a63" }}>Topics — {subscriptions.length} subscribed</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
          {ACTIVITY_TOPICS.map((t) => {
            const Icon = t.icon;
            const sub  = subscriptions.includes(t.id);
            return (
              <button key={t.id} onClick={() => toggleSubscription(t.id)} className="bow-full" style={{ borderRadius: "8px", padding: "16px", textAlign: "left", background: sub ? "#1a2744" : "white", border: `2px solid ${sub ? "#f5a623" : "#e5e2d8"}`, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: sub ? "#f5a623" : "#f5f3ee" }}>
                    <Icon style={{ width: "20px", height: "20px", color: "#1a2744" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="font-display" style={{ fontWeight: 700, fontSize: "16px", color: sub ? "white" : "#1a2744" }}>{t.label}</div>
                      {sub && <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "4px", background: "#f5a623", color: "#1a2744" }}>Subscribed</span>}
                    </div>
                    <p style={{ fontSize: "12px", marginTop: "4px", color: sub ? "#a8b4cc" : "#6b6a63", margin: "4px 0 0 0" }}>{t.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ModalCard title="Recent Activity" eyebrow="From your subscriptions" icon={Hash} iconColor="#1a2744">
        {subscriptions.length === 0 ? (
          <div style={{ fontSize: "14px", textAlign: "center", padding: "24px 0", color: "#6b6a63" }}>Subscribe to a topic above to see activity here.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <ActivityItem topic="Media Issues"        title="New issue reported"   detail="K. Ortiz flagged Roots: Icons of Hollywood for accessibility"   time="2h ago" />
            <ActivityItem topic="Rights & Clearances" title="Window extended"      detail="Frontline streaming approved through end of season"              time="5h ago" />
            <ActivityItem topic="Schedule Updates"    title="Programming change"   detail="Roots: Off the Charts added to Saturday 10am repeat slot"        time="Yesterday" />
            <ActivityItem topic="Show Metadata"       title="S11 notes published"  detail="Finding Your Roots streaming window confirmed for all episodes"  time="2 days ago" />
          </div>
        )}
      </ModalCard>
    </div>
  );
}

function ActivityItem({ topic, title, detail, time }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", paddingBottom: "12px", borderBottom: "1px solid #e5e2d8" }}>
      <div style={{ width: "8px", height: "8px", borderRadius: "9999px", marginTop: "6px", flexShrink: 0, background: "#f5a623" }} />
      <div style={{ flex: "1 1 0%", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", padding: "2px 6px", borderRadius: "4px", background: "#1a2744", color: "white" }}>{topic}</span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1a2744" }}>{title}</span>
        </div>
        <p style={{ fontSize: "12px", marginTop: "4px", color: "#6b6a63", margin: "4px 0 0 0" }}>{detail}</p>
      </div>
      <span style={{ fontSize: "12px", flexShrink: 0, color: "#a8a59a" }}>{time}</span>
    </div>
  );
}
