import React, { useState, useMemo, useEffect } from "react";
import { Radio, Bell, User, Users, Tv, Search, AlertCircle, Layers, BellRing, X } from "lucide-react";

import { CHANNELS, SHOW_DETAILS } from "./constants.js";
import { TODAY, DATE_RANGE, dateKey, isSameDay } from "./utils.js";
import { fetchScheduleFromStaffbase, fetchIssues, submitIssue as postIssue } from "./api.js";

import { Calendar360 }               from "./components/Calendar.jsx";
import { MediaIssues }               from "./components/Issues.jsx";
import { SearchView }                from "./components/Search.jsx";
import { Show360Browser, Show360Content } from "./components/Show360.jsx";
import { ActivityStream }            from "./components/Activity.jsx";
import { Modal, ReportForm, NotifItem } from "./components/Shared.jsx";

export default function BroadcastOpsWidget() {
  const [schedule, setSchedule]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState(null);
  const [role, setRole]                     = useState("station");
  const [activeTab, setActiveTab]           = useState("guide");
  const [weekStartIndex, setWeekStartIndex] = useState(0);
  const [viewMode, setViewMode]             = useState("week");
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(TODAY));
  const [selectedChannels, setSelectedChannels] = useState(CHANNELS.map((c) => c.id));
  const [searchQuery, setSearchQuery]       = useState("");
  const [issues, setIssues]                 = useState([]);
  const [selectedShow360, setSelectedShow360] = useState("Frontline");
  const [subscriptions, setSubscriptions]   = useState(["bugs", "rights"]);
  const [notifDelivery, setNotifDelivery]   = useState({ email: true, inApp: true });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [replyDraft, setReplyDraft]         = useState({});
  const [detailsModalShow, setDetailsModalShow] = useState(null);
  const [reportModalShow, setReportModalShow]   = useState(null);

  useEffect(() => {
    fetchScheduleFromStaffbase()
      .then((items) => { setSchedule(items); setLoading(false); })
      .catch((err)  => { setLoadError(err.message || "Failed to load"); setLoading(false); });
    fetchIssues().then(setIssues);
  }, []);

  const currentWeek = useMemo(() => DATE_RANGE.slice(weekStartIndex, weekStartIndex + 4), [weekStartIndex]);
  const selectedDate = useMemo(() => DATE_RANGE.find((d) => dateKey(d) === selectedDateKey) || TODAY, [selectedDateKey]);

  const weekSchedule = useMemo(
    () => schedule.filter((s) => currentWeek.map(dateKey).includes(s.dateKey) && selectedChannels.includes(s.channel)),
    [currentWeek, selectedChannels, schedule]
  );

  const daySchedule = useMemo(
    () => schedule.filter((s) => s.dateKey === selectedDateKey && selectedChannels.includes(s.channel)),
    [selectedDateKey, selectedChannels, schedule]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const groups = {};
    schedule.forEach((s) => {
      if (s.show.toLowerCase().includes(q) || s.episode.toLowerCase().includes(q)) {
        if (!groups[s.channel]) groups[s.channel] = { show: s.show, channel: s.channel, episodes: [] };
        groups[s.channel].episodes.push(s);
      }
    });
    return Object.values(groups);
  }, [searchQuery, schedule]);

  const toggleChannel      = (id) => setSelectedChannels((p) => p.includes(id) ? p.filter((c) => c !== id) : [...p, id]);
  const toggleSubscription = (id) => setSubscriptions((p) => p.includes(id) ? p.filter((s) => s !== id) : [...p, id]);

  const submitIssue = async (show, draft) => {
    const newIssue = {
      show: show.show, episode: show.episode,
      station: "Your Station", author: "You",
      type: draft.type, tags: draft.tags, description: draft.description,
    };
    setReportModalShow(null);
    setActiveTab("issues");
    try {
      await postIssue(newIssue);
      const updated = await fetchIssues();
      setIssues(updated);
    } catch (_) {
      setIssues((prev) => [{ id: `i${Date.now()}`, ...newIssue, status: "Open", timestamp: "Just now", replies: [] }, ...prev]);
    }
  };

  const submitReply = (issueId) => {
    const text = replyDraft[issueId];
    if (!text?.trim()) return;
    setIssues((prev) => prev.map((i) =>
      i.id === issueId
        ? { ...i, status: "In Review", replies: [...i.replies, { author: "Operations Team", role: "staff", text, timestamp: "Just now" }] }
        : i
    ));
    setReplyDraft((p) => ({ ...p, [issueId]: "" }));
  };

  const openDetails = (showName) => SHOW_DETAILS[showName] && setDetailsModalShow(showName);
  const openReport  = (item) => setReportModalShow(item);
  const openDayView = (d) => { setSelectedDateKey(dateKey(d)); setViewMode("day"); };

  const unreadCount = subscriptions.length * 2;

  const widgetStyle = {
    background: "#f5f3ee",
    fontFamily: "'Source Sans Pro', -apple-system, system-ui, sans-serif",
  };

  if (loading) return (
    <div className="w-full py-24 flex items-center justify-center" style={widgetStyle}>
      <div className="text-center">
        <div className="w-12 h-12 rounded-sm flex items-center justify-center mx-auto mb-4" style={{ background: "#1a2744" }}>
          <Radio className="w-6 h-6 text-white" />
        </div>
        <div className="font-display font-bold text-lg mb-1" style={{ color: "#1a2744" }}>Loading Schedule</div>
        <div className="text-sm" style={{ color: "#6b6a63" }}>Fetching live data from Staffbase…</div>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="w-full py-24 flex items-center justify-center" style={widgetStyle}>
      <div className="text-center max-w-sm">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#be123c" }} />
        <div className="font-bold mb-1" style={{ color: "#1a2744" }}>Could not load schedule</div>
        <div className="text-sm" style={{ color: "#6b6a63" }}>{loadError}</div>
        <div className="text-xs mt-3" style={{ color: "#a8a59a" }}>This widget requires access to app.staffbase.com. Try opening it inside Staffbase.</div>
      </div>
    </div>
  );

  const TABS = [
    { id: "guide",    label: "TV Guide",        icon: Tv },
    { id: "issues",   label: "Media Issues",    icon: AlertCircle, badge: issues.length },
    { id: "search",   label: "Search Shows",    icon: Search },
    { id: "show360",  label: "Show 360°",       icon: Layers },
    { id: "activity", label: "Activity Stream", icon: BellRing, badge: subscriptions.length },
  ];

  return (
    <div className="w-full" style={widgetStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700;900&family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Source Serif Pro', Georgia, serif; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbc9c0; border-radius: 3px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-in-up { animation: fadeInUp 0.3s ease-out; }
        .modal-backdrop { animation: backdropIn 0.2s ease-out; }
        .modal-content { animation: modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      {/* ── Top bar ── */}
      <header className="border-b" style={{ background: "#1a2744", borderColor: "#0f1a30" }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0" style={{ background: "#f5a623" }}>
              <Radio className="w-5 h-5" style={{ color: "#1a2744" }} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-bold text-white text-lg leading-tight tracking-tight">Broadcast Operations</div>
              <div className="text-xs tracking-widest uppercase hidden sm:block" style={{ color: "#a8b4cc" }}>Programming & Delivery Hub</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="relative p-2 rounded-md transition-colors" style={{ background: showNotifPanel ? "#f5a623" : "rgba(255,255,255,0.08)" }}>
                <Bell className="w-5 h-5" style={{ color: showNotifPanel ? "#1a2744" : "white" }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ background: "#f5a623", color: "#1a2744" }}>{unreadCount}</span>
                )}
              </button>

              {showNotifPanel && (
                <div className="absolute top-full right-0 mt-2 z-50 w-80 sm:w-96 rounded-lg shadow-2xl border fade-in-up" style={{ background: "white", borderColor: "#e5e2d8" }}>
                  <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#e5e2d8" }}>
                    <div className="font-display font-bold text-base" style={{ color: "#1a2744" }}>Recent Activity</div>
                    <button onClick={() => setShowNotifPanel(false)}><X className="w-4 h-4" style={{ color: "#6b6a63" }} /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    <NotifItem title="New media issue reported"   detail="K. Ortiz flagged Roots: Icons of Hollywood"         time="2h ago"     topic="Media Issues" />
                    <NotifItem title="Rights window extended"     detail="Frontline streaming approved through end of season" time="5h ago"     topic="Rights & Clearances" />
                    <NotifItem title="Schedule change"            detail="Roots: Off the Charts added to Saturday 10am"       time="Yesterday"  topic="Schedule Updates" />
                    <NotifItem title="New contributor note"       detail="Finding Your Roots S11 streaming window confirmed"  time="2 days ago" topic="Show Metadata" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center rounded-md p-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              {[{ val: "station", label: "Station", Icon: User }, { val: "hq", label: "HQ Staff", Icon: Users }].map(({ val, label, Icon }) => (
                <button key={val} onClick={() => setRole(val)} className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded text-xs font-semibold transition-all" style={{ background: role === val ? "#f5a623" : "transparent", color: role === val ? "#1a2744" : "#a8b4cc" }}>
                  <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <nav className="px-4 sm:px-6 flex gap-0.5 overflow-x-auto scrollbar-thin">
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)} className="flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap" style={{ borderColor: active ? "#f5a623" : "transparent", color: active ? "white" : "#a8b4cc" }}>
                <Icon className="w-4 h-4" />
                {label}
                {badge > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: active ? "#f5a623" : "#3a4866", color: active ? "#1a2744" : "white" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Main content ── */}
      <main className="px-4 sm:px-6 py-6">
        {activeTab === "guide" && (
          <Calendar360
            viewMode={viewMode} setViewMode={setViewMode}
            currentWeek={currentWeek} weekStartIndex={weekStartIndex} setWeekStartIndex={setWeekStartIndex}
            selectedDate={selectedDate} selectedDateKey={selectedDateKey} setSelectedDateKey={setSelectedDateKey}
            selectedChannels={selectedChannels} toggleChannel={toggleChannel}
            weekSchedule={weekSchedule} daySchedule={daySchedule}
            role={role} onReportIssue={openReport} onViewShow={(s) => openDetails(s.show)} onDayClick={openDayView}
          />
        )}
        {activeTab === "issues" && (
          <MediaIssues issues={issues} role={role} replyDraft={replyDraft} setReplyDraft={setReplyDraft} submitReply={submitReply} onOpenDetails={openDetails} />
        )}
        {activeTab === "search" && (
          <SearchView query={searchQuery} setQuery={setSearchQuery} results={searchResults} onSelectShow={openDetails} />
        )}
        {activeTab === "show360" && (
          <Show360Browser selected={selectedShow360} setSelected={setSelectedShow360} role={role} schedule={schedule} />
        )}
        {activeTab === "activity" && (
          <ActivityStream subscriptions={subscriptions} toggleSubscription={toggleSubscription} notifDelivery={notifDelivery} setNotifDelivery={setNotifDelivery} />
        )}
      </main>

      <footer className="px-4 sm:px-6 py-4 text-xs flex items-center justify-between border-t" style={{ color: "#6b6a63", borderColor: "#e5e2d8" }}>
        <div>Signed in as {role === "station" ? "Station User" : "HQ Operations"}</div>
        <div className="flex items-center gap-4">
          <span>All times Eastern (ET)</span>
          <span>Live · Staffbase</span>
        </div>
      </footer>

      {/* ── Modals ── */}
      {detailsModalShow && (
        <Modal onClose={() => setDetailsModalShow(null)} size="lg">
          <Show360Content
            show={detailsModalShow}
            role={role}
            schedule={schedule}
            onClose={() => setDetailsModalShow(null)}
            onReportIssue={() => {
              const item = schedule.find((s) => s.show === detailsModalShow);
              if (item) { setDetailsModalShow(null); setTimeout(() => setReportModalShow(item), 200); }
            }}
          />
        </Modal>
      )}

      {reportModalShow && (
        <Modal onClose={() => setReportModalShow(null)} size="md">
          <ReportForm
            scheduleItem={reportModalShow}
            onSubmit={(draft) => submitIssue(reportModalShow, draft)}
            onClose={() => setReportModalShow(null)}
            onViewDetails={() => {
              const name = reportModalShow.show;
              if (SHOW_DETAILS[name]) { setReportModalShow(null); setTimeout(() => setDetailsModalShow(name), 200); }
            }}
          />
        </Modal>
      )}
    </div>
  );
}
