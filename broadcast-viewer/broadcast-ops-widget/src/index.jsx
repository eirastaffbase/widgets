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
    maxWidth: "100%",
    overflowX: "hidden",
    boxSizing: "border-box",
    fontSize: "16px",
    lineHeight: "1.5",
    color: "#1a2744",
  };

  if (loading) return (
    <div style={{ ...widgetStyle, paddingTop: "96px", paddingBottom: "96px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700;900&family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Source Serif Pro', Georgia, serif; }
      `}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", background: "#1a2744" }}>
          <Radio style={{ width: "24px", height: "24px", color: "white" }} />
        </div>
        <div className="font-display" style={{ fontWeight: 700, fontSize: "18px", marginBottom: "4px", color: "#1a2744" }}>Loading Schedule</div>
        <div style={{ fontSize: "14px", color: "#6b6a63" }}>Fetching live data from Staffbase…</div>
      </div>
    </div>
  );

  if (loadError) return (
    <div style={{ ...widgetStyle, paddingTop: "96px", paddingBottom: "96px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700;900&family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Source Serif Pro', Georgia, serif; }
      `}</style>
      <div style={{ textAlign: "center", maxWidth: "384px" }}>
        <AlertCircle style={{ width: "40px", height: "40px", margin: "0 auto 12px", display: "block", color: "#be123c" }} />
        <div style={{ fontWeight: 700, marginBottom: "4px", color: "#1a2744" }}>Could not load schedule</div>
        <div style={{ fontSize: "14px", color: "#6b6a63" }}>{loadError}</div>
        <div style={{ fontSize: "12px", marginTop: "12px", color: "#a8a59a" }}>This widget requires access to app.staffbase.com. Try opening it inside Staffbase.</div>
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
    <div id="bow-root" style={widgetStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700;900&family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
        .font-display { font-family: 'Source Serif Pro', Georgia, serif; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbc9c0; border-radius: 3px; }
        /* Staffbase forces display:block + width:100% on all buttons, and sometimes
           injects text-align:center on the widget container. Override everything
           scoped to our root so nothing leaks out.
           .bow-full = buttons that genuinely need to span their container.
           .bow-day-cell = 4-day grid column cells (flex-column, full-width). */
        #bow-root { text-align: left !important; }
        #bow-root button { display: inline-flex !important; align-items: center !important; width: auto !important; }
        #bow-root button.bow-full { display: flex !important; width: 100% !important; }
        #bow-root button.bow-day-cell { display: flex !important; flex-direction: column !important; width: 100% !important; align-items: stretch !important; }

        /* .bow-portal is the wrapper div for modals rendered via ReactDOM.createPortal
           into document.body (outside #bow-root). We duplicate the key overrides here
           so the modal gets the same CSS protections as the main widget. */
        .bow-portal { font-family: 'Source Sans Pro', -apple-system, system-ui, sans-serif; text-align: left !important; color: #1a2744; }
        .bow-portal button { display: inline-flex !important; align-items: center !important; width: auto !important; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important; }
        .bow-portal button.bow-full { display: flex !important; width: 100% !important; }
        .bow-portal .font-display { font-family: 'Source Serif Pro', Georgia, serif; }
        .bow-portal .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .bow-portal .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .bow-portal .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbc9c0; border-radius: 3px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        .fade-in-up { animation: fadeInUp 0.3s ease-out; }
        .modal-backdrop { animation: backdropIn 0.2s ease-out; }
        .modal-content { animation: modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }

        /* ── Hover & transition polish ── */
        /* All interactive buttons get a smooth transition base */
        #bow-root button { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease !important; }

        /* Nav tabs */
        #bow-root nav button:hover { color: white !important; }

        /* Primary dark buttons (Today, View 360°, channel chips when active) */
        #bow-root button[style*="background: rgb(26, 39, 68)"]:hover,
        #bow-root button[style*="background: #1a2744"]:hover { background: #2d3f6b !important; }

        /* Amber / gold buttons (Today, Report Issue CTA) */
        #bow-root button[style*="background: rgb(245, 166, 35)"]:hover,
        #bow-root button[style*="background: #f5a623"]:hover { background: #e09410 !important; box-shadow: 0 2px 8px rgba(245,166,35,0.35) !important; }

        /* Ghost / light buttons (Details, nav arrows, view-mode toggles) */
        #bow-root button[style*="background: rgb(245, 243, 238)"]:hover,
        #bow-root button[style*="background: #f5f3ee"]:hover { background: #ebe8df !important; }

        /* White buttons (Details chip in timeline) */
        #bow-root button[style*="background: white"]:hover { background: #f5f3ee !important; }

        /* Report amber chip in timeline */
        #bow-root button[style*="background: rgb(254, 243, 199)"]:hover,
        #bow-root button[style*="background: #fef3c7"]:hover { background: #fde68a !important; }

        /* Day grid cells — subtle lift on hover */
        #bow-root .bow-day-cell:hover { background: #fef6e4 !important; box-shadow: inset 0 0 0 2px #f5a623; }

        /* Day timeline show cards — click to open, hover reveals flag */
        #bow-root .bow-show-card { cursor: pointer; }
        #bow-root .bow-show-card:hover { filter: brightness(0.94); }
        #bow-root .bow-flag-btn { opacity: 0; transition: opacity 0.15s ease !important; }
        #bow-root .bow-show-card:hover .bow-flag-btn { opacity: 1 !important; }

        /* Show 360° modal episode rows */
        #bow-root button.bow-full:hover { background: #f5f3ee !important; }

        /* Search result cards "Episodes" toggle */
        #bow-root button[style*="background: rgb(245, 243, 238)"]:hover { background: #ebe8df !important; }

        /* Topic subscription cards */
        #bow-root button[style*="background: rgb(26, 39, 68)"][style*="border: 2px"]:hover { box-shadow: 0 4px 16px rgba(26,39,68,0.18) !important; }
        #bow-root button[style*="background: white"][style*="border: 2px"]:hover { border-color: #1a2744 !important; box-shadow: 0 2px 8px rgba(26,39,68,0.1) !important; }
      `}</style>

      {/* ── Top bar ── */}
      <header style={{ background: "#1a2744", borderBottom: "1px solid #0f1a30" }}>
        <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "2px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "#f5a623" }}>
              <Radio style={{ width: "20px", height: "20px", color: "#1a2744" }} />
            </div>
            <div>
              <div className="font-display" style={{ fontWeight: 700, color: "white", fontSize: "18px", lineHeight: "1.25", letterSpacing: "-0.025em" }}>Broadcast Operations</div>
              <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#a8b4cc" }}>Programming &amp; Delivery Hub</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Bell */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ position: "relative", padding: "8px", borderRadius: "6px", background: showNotifPanel ? "#f5a623" : "rgba(255,255,255,0.08)", border: "none", cursor: "pointer" }}>
                <Bell style={{ width: "20px", height: "20px", color: showNotifPanel ? "#1a2744" : "white" }} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: "-4px", right: "-4px", fontSize: "10px", fontWeight: 700, borderRadius: "9999px", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5a623", color: "#1a2744" }}>{unreadCount}</span>
                )}
              </button>

              {showNotifPanel && (
                <div className="fade-in-up" style={{ position: "absolute", top: "100%", right: 0, marginTop: "8px", zIndex: 50, width: "384px", borderRadius: "8px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #e5e2d8", background: "white" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: "1px solid #e5e2d8" }}>
                    <div className="font-display" style={{ fontWeight: 700, fontSize: "16px", color: "#1a2744" }}>Recent Activity</div>
                    <button onClick={() => setShowNotifPanel(false)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X style={{ width: "16px", height: "16px", color: "#6b6a63" }} /></button>
                  </div>
                  <div className="scrollbar-thin" style={{ maxHeight: "320px", overflowY: "auto" }}>
                    <NotifItem title="New media issue reported"   detail="K. Ortiz flagged Roots: Icons of Hollywood"         time="2h ago"     topic="Media Issues" />
                    <NotifItem title="Rights window extended"     detail="Frontline streaming approved through end of season" time="5h ago"     topic="Rights & Clearances" />
                    <NotifItem title="Schedule change"            detail="Roots: Off the Charts added to Saturday 10am"       time="Yesterday"  topic="Schedule Updates" />
                    <NotifItem title="New contributor note"       detail="Finding Your Roots S11 streaming window confirmed"  time="2 days ago" topic="Show Metadata" />
                  </div>
                </div>
              )}
            </div>

            {/* Role switcher */}
            <div style={{ display: "flex", alignItems: "center", borderRadius: "6px", padding: "4px", background: "rgba(255,255,255,0.08)" }}>
              {[{ val: "station", label: "Station", Icon: User }, { val: "hq", label: "HQ Staff", Icon: Users }].map(({ val, label, Icon }) => (
                <button key={val} onClick={() => setRole(val)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, background: role === val ? "#f5a623" : "transparent", color: role === val ? "#1a2744" : "#a8b4cc", border: "none", cursor: "pointer" }}>
                  <Icon style={{ width: "14px", height: "14px" }} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="scrollbar-thin" style={{ padding: "0 24px", display: "flex", gap: "2px", overflowX: "auto" }}>
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", fontSize: "14px", fontWeight: 600, borderBottom: `2px solid ${active ? "#f5a623" : "transparent"}`, color: active ? "white" : "#a8b4cc", background: "transparent", border: "none", borderBottom: `2px solid ${active ? "#f5a623" : "transparent"}`, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Icon style={{ width: "16px", height: "16px" }} />
                {label}
                {badge > 0 && (
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "9999px", background: active ? "#f5a623" : "#3a4866", color: active ? "#1a2744" : "white" }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Main content ── */}
      <main style={{ padding: "24px" }}>
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

      <footer style={{ padding: "16px 24px", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e5e2d8", color: "#6b6a63" }}>
        <div>Signed in as {role === "station" ? "Station User" : "HQ Operations"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
