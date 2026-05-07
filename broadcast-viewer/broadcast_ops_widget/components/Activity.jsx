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
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Stay Informed"
        title="Activity Stream"
        subtitle="Subscribe to topics to receive updates by email and in-app when something changes."
      />

      <ModalCard title="Delivery Preferences" eyebrow="How you want to hear about it" icon={Bell} iconColor="#1a2744">
        <div className="flex gap-3">
          {[{ key: "email", Icon: Mail, label: "Email" }, { key: "inApp", Icon: BellRing, label: "In-app" }].map(({ key, Icon, label }) => (
            <button key={key} onClick={() => setNotifDelivery({ ...notifDelivery, [key]: !notifDelivery[key] })} className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-semibold transition-all" style={{ background: notifDelivery[key] ? "#1a2744" : "#f5f3ee", color: notifDelivery[key] ? "white" : "#1a2744", border: `1px solid ${notifDelivery[key] ? "#1a2744" : "#e5e2d8"}` }}>
              <Icon className="w-4 h-4" /> {label} {notifDelivery[key] && <CheckCircle2 className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </ModalCard>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#6b6a63" }}>Topics — {subscriptions.length} subscribed</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACTIVITY_TOPICS.map((t) => {
            const Icon = t.icon;
            const sub  = subscriptions.includes(t.id);
            return (
              <button key={t.id} onClick={() => toggleSubscription(t.id)} className="rounded-lg p-4 text-left transition-all hover:shadow-md" style={{ background: sub ? "#1a2744" : "white", border: `2px solid ${sub ? "#f5a623" : "#e5e2d8"}` }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: sub ? "#f5a623" : "#f5f3ee" }}>
                    <Icon className="w-5 h-5" style={{ color: "#1a2744" }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-display font-bold text-base" style={{ color: sub ? "white" : "#1a2744" }}>{t.label}</div>
                      {sub && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#f5a623", color: "#1a2744" }}>Subscribed</span>}
                    </div>
                    <p className="text-xs mt-1" style={{ color: sub ? "#a8b4cc" : "#6b6a63" }}>{t.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ModalCard title="Recent Activity" eyebrow="From your subscriptions" icon={Hash} iconColor="#1a2744">
        {subscriptions.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: "#6b6a63" }}>Subscribe to a topic above to see activity here.</div>
        ) : (
          <div className="space-y-3">
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
    <div className="flex items-start gap-3 pb-3" style={{ borderBottom: "1px solid #e5e2d8" }}>
      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#f5a623" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#1a2744", color: "white" }}>{topic}</span>
          <span className="text-sm font-semibold" style={{ color: "#1a2744" }}>{title}</span>
        </div>
        <p className="text-xs mt-1" style={{ color: "#6b6a63" }}>{detail}</p>
      </div>
      <span className="text-xs flex-shrink-0" style={{ color: "#a8a59a" }}>{time}</span>
    </div>
  );
}
