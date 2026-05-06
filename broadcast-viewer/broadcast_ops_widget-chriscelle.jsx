import React, { useState, useMemo, useEffect } from "react";
import {
  Tv,
  Search,
  Bell,
  AlertCircle,
  Layers,
  Calendar,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  User,
  Users,
  Radio,
  Film,
  FileText,
  AlertTriangle,
  Heart,
  Eye,
  Sparkles,
  Mail,
  BellRing,
  X,
  Plus,
  ArrowUpRight,
  Hash,
  Flag,
  CalendarDays,
  LayoutGrid,
} from "lucide-react";

// ========== DATE UTILITIES ==========
// Today is Wed, April 22, 2026 per system context
const TODAY = new Date(2026, 3, 22); // month is 0-indexed

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(d) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDayNumber(d) {
  return d.getDate();
}

function formatDayName(d) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function formatFullDate(d) {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Two-week rolling window starting today
const DATE_RANGE = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i));

// ========== MOCK DATA ==========
const CHANNELS = [
  { id: "main", label: "Main", color: "#1e3a8a" },
  { id: "kids", label: "Kids", color: "#d97706" },
  { id: "create", label: "Create", color: "#059669" },
  { id: "world", label: "World", color: "#7c2d12" },
  { id: "explore", label: "Explore", color: "#6d28d9" },
  { id: "livingroom", label: "Living Room", color: "#be123c" },
  { id: "encore", label: "Encore", color: "#0e7490" },
];

const DAYPARTS = [
  { id: "morning", label: "Morning", range: "5a – 12p", startHour: 5, endHour: 12 },
  { id: "daytime", label: "Daytime", range: "12p – 5p", startHour: 12, endHour: 17 },
  { id: "primetime", label: "Primetime", range: "5p – 11p", startHour: 17, endHour: 23 },
  { id: "overnight", label: "Overnight", range: "11p – 5a", startHour: 23, endHour: 29 },
];

function getDaypart(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "daytime";
  if (hour >= 17 && hour < 23) return "primetime";
  return "overnight";
}

// Program catalog — each with duration, typical channel, daypart preference
const PROGRAMS = [
  { show: "Newshour", channel: "main", duration: 60, preferredHours: [7, 18] },
  { show: "Antiques Roadshow", channel: "main", duration: 60, preferredHours: [8, 20] },
  { show: "Nature", channel: "explore", duration: 60, preferredHours: [10, 20] },
  { show: "Masterpiece", channel: "main", duration: 90, preferredHours: [14, 21] },
  { show: "Amanpour & Company", channel: "world", duration: 60, preferredHours: [19, 23] },
  { show: "Frontline", channel: "main", duration: 120, preferredHours: [21] },
  { show: "The Count of Monte Cristo", channel: "main", duration: 90, preferredHours: [20] },
  { show: "Daniel Tiger", channel: "kids", duration: 30, preferredHours: [9, 14] },
  { show: "Sesame Street", channel: "kids", duration: 60, preferredHours: [8, 11] },
  { show: "Odd Squad", channel: "kids", duration: 30, preferredHours: [10, 15] },
  { show: "America's Test Kitchen", channel: "create", duration: 30, preferredHours: [11, 16] },
  { show: "Rick Steves' Europe", channel: "create", duration: 30, preferredHours: [12, 17] },
  { show: "Ken Burns: The American Buffalo", channel: "main", duration: 120, preferredHours: [21] },
  { show: "Independent Lens", channel: "world", duration: 90, preferredHours: [22] },
  { show: "NOVA", channel: "explore", duration: 60, preferredHours: [20, 22] },
  { show: "Finding Your Roots", channel: "main", duration: 60, preferredHours: [20] },
  { show: "This Old House", channel: "livingroom", duration: 30, preferredHours: [13, 18] },
  { show: "The Great British Baking Show", channel: "livingroom", duration: 60, preferredHours: [19, 21] },
  { show: "Austin City Limits", channel: "encore", duration: 60, preferredHours: [22] },
  { show: "Call the Midwife", channel: "main", duration: 60, preferredHours: [21] },
  { show: "Arthur", channel: "kids", duration: 30, preferredHours: [9, 15] },
  { show: "Wild Kratts", channel: "kids", duration: 30, preferredHours: [8, 14] },
];

// Generate schedule across 14 days
function generateSchedule() {
  const items = [];
  let counter = 1;
  DATE_RANGE.forEach((d) => {
    const dk = dateKey(d);
    // Morning block
    PROGRAMS.filter((p) => p.preferredHours.some((h) => h >= 7 && h < 12)).forEach((p) => {
      const h = p.preferredHours.find((x) => x >= 7 && x < 12);
      if (h !== undefined && Math.random() > 0.35) {
        items.push({
          id: `s${counter++}`,
          show: p.show,
          channel: p.channel,
          time: `${String(h).padStart(2, "0")}:00`,
          hour: h,
          minute: 0,
          dateKey: dk,
          date: formatShortDate(d),
          daypart: getDaypart(h),
          episode: generateEpisode(p.show),
          duration: p.duration,
        });
      }
    });
    // Daytime
    PROGRAMS.filter((p) => p.preferredHours.some((h) => h >= 12 && h < 17)).forEach((p) => {
      const h = p.preferredHours.find((x) => x >= 12 && x < 17);
      if (h !== undefined && Math.random() > 0.4) {
        items.push({
          id: `s${counter++}`,
          show: p.show,
          channel: p.channel,
          time: `${String(h).padStart(2, "0")}:00`,
          hour: h,
          minute: 0,
          dateKey: dk,
          date: formatShortDate(d),
          daypart: getDaypart(h),
          episode: generateEpisode(p.show),
          duration: p.duration,
        });
      }
    });
    // Primetime — more dense
    PROGRAMS.filter((p) => p.preferredHours.some((h) => h >= 17 && h < 23)).forEach((p) => {
      const h = p.preferredHours.find((x) => x >= 17 && x < 23);
      if (h !== undefined && Math.random() > 0.25) {
        items.push({
          id: `s${counter++}`,
          show: p.show,
          channel: p.channel,
          time: `${String(h).padStart(2, "0")}:00`,
          hour: h,
          minute: 0,
          dateKey: dk,
          date: formatShortDate(d),
          daypart: getDaypart(h),
          episode: generateEpisode(p.show),
          duration: p.duration,
        });
      }
    });
  });
  // Deterministic sort
  items.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.channel.localeCompare(b.channel);
  });
  return items;
}

function generateEpisode(show) {
  const seasons = {
    "Newshour": `Season 51 · E${Math.floor(Math.random() * 200) + 1}`,
    "Antiques Roadshow": `Season 28 · E${Math.floor(Math.random() * 26) + 1}`,
    "Nature": `Season 42 · E${Math.floor(Math.random() * 12) + 1}`,
    "Masterpiece": `Season 53 · E${Math.floor(Math.random() * 8) + 1}`,
    "Amanpour & Company": `Season 2026 · E${Math.floor(Math.random() * 250) + 1}`,
    "Frontline": `Season 44 · E${Math.floor(Math.random() * 24) + 1}`,
    "The Count of Monte Cristo": `Limited Series · E${Math.floor(Math.random() * 8) + 1}`,
    "Daniel Tiger": `Season 6 · E${Math.floor(Math.random() * 20) + 1}`,
    "Sesame Street": `Season 56 · E${Math.floor(Math.random() * 35) + 1}`,
    "Odd Squad": `Season 4 · E${Math.floor(Math.random() * 20) + 1}`,
    "America's Test Kitchen": `Season 25 · E${Math.floor(Math.random() * 26) + 1}`,
    "Rick Steves' Europe": `Season 12 · E${Math.floor(Math.random() * 13) + 1}`,
    "Ken Burns: The American Buffalo": `Limited · E${Math.floor(Math.random() * 2) + 1}`,
    "Independent Lens": `Season 27 · E${Math.floor(Math.random() * 20) + 1}`,
    "NOVA": `Season 52 · E${Math.floor(Math.random() * 20) + 1}`,
    "Finding Your Roots": `Season 11 · E${Math.floor(Math.random() * 10) + 1}`,
    "This Old House": `Season 46 · E${Math.floor(Math.random() * 26) + 1}`,
    "The Great British Baking Show": `Season 14 · E${Math.floor(Math.random() * 10) + 1}`,
    "Austin City Limits": `Season 51 · E${Math.floor(Math.random() * 13) + 1}`,
    "Call the Midwife": `Season 15 · E${Math.floor(Math.random() * 8) + 1}`,
    "Arthur": `Season 25 · E${Math.floor(Math.random() * 20) + 1}`,
    "Wild Kratts": `Season 7 · E${Math.floor(Math.random() * 26) + 1}`,
  };
  return seasons[show] || "New Episode";
}

// Seed once — stable across renders
const SCHEDULE = generateSchedule();

const SHOW_DETAILS = {
  "Amanpour & Company": {
    title: "Amanpour & Company",
    tagline: "Wide-ranging, in-depth interviews with global newsmakers",
    season: "Season 2026",
    episodes: 220,
    genre: "News & Public Affairs",
    rights: { window: "Feb 1, 2026 – Jan 31, 2027", territory: "US, all platforms", clearances: "Cleared for VOD + Streaming" },
    funding: ["Rosalind P. Walter", "Mutual of America", "Viewer Support"],
    contributors: [
      { name: "Maria Chen", role: "Scheduling Lead", note: "Confirmed 60-min cutdowns available for weekend slots." },
      { name: "Jordan Fields", role: "Rights Coordinator", note: "Streaming extension approved through FY27." },
    ],
    flags: [],
  },
  "The Count of Monte Cristo": {
    title: "The Count of Monte Cristo",
    tagline: "A sweeping new adaptation of the Dumas classic",
    season: "Limited Series",
    episodes: 8,
    genre: "Drama",
    rights: { window: "Jan 15, 2026 – Jan 14, 2028", territory: "US + Puerto Rico", clearances: "Broadcast + Streaming" },
    funding: ["Public Broadcasting Fund", "Anonymous Donor"],
    contributors: [{ name: "Priya Rao", role: "Programming", note: "Recommend primetime block. Avoid family hour." }],
    flags: [
      { kind: "Violence", level: "Moderate", auto: true },
      { kind: "Mature Themes", level: "Some", auto: true },
      { kind: "Brief Nudity", level: "Minimal", auto: true },
      { kind: "Medical Content", level: "Low", auto: true },
    ],
  },
  "Frontline": {
    title: "Frontline",
    tagline: "Investigative journalism that exposes injustice",
    season: "Season 44",
    episodes: 24,
    genre: "Documentary",
    rights: { window: "Ongoing", territory: "US, all platforms", clearances: "Broadcast + Digital" },
    funding: ["Public Broadcasting Fund", "Ford Foundation", "Park Foundation"],
    contributors: [{ name: "Alex Rivera", role: "Series Producer", note: "E08 contains archival footage — pre-cleared." }],
    flags: [
      { kind: "Mature Themes", level: "Strong", auto: true },
      { kind: "Disturbing Content", level: "Moderate", auto: true },
    ],
  },
  "Antiques Roadshow": {
    title: "Antiques Roadshow",
    tagline: "Treasure-hunting appraisals from across the country",
    season: "Season 28",
    episodes: 26,
    genre: "Reality / Lifestyle",
    rights: { window: "Feb 1, 2026 – Jan 31, 2029", territory: "US, all platforms", clearances: "Full clearance" },
    funding: ["Ancestry", "Consumer Cellular", "Public Broadcasting Fund"],
    contributors: [{ name: "Sam Washington", role: "Digital Lead", note: "Streaming window drops 14 days after broadcast." }],
    flags: [],
  },
  "Nature": {
    title: "Nature",
    tagline: "Breathtaking wildlife documentaries from across the globe",
    season: "Season 42",
    episodes: 12,
    genre: "Documentary",
    rights: { window: "Jan 1, 2026 – Dec 31, 2028", territory: "US, all platforms", clearances: "Broadcast + Streaming" },
    funding: ["Arnhold Foundation", "Sue and Edgar Wachenheim III", "Viewer Support"],
    contributors: [{ name: "Lin Park", role: "Series Producer", note: "4K masters available for all episodes this season." }],
    flags: [],
  },
  "Masterpiece": {
    title: "Masterpiece",
    tagline: "Award-winning drama from the UK and beyond",
    season: "Season 53",
    episodes: 8,
    genre: "Drama",
    rights: { window: "Mar 1, 2026 – Feb 28, 2028", territory: "US, all platforms", clearances: "Broadcast + Streaming" },
    funding: ["Viking", "Raymond James", "Public Broadcasting Fund"],
    contributors: [{ name: "Elena Voss", role: "Acquisitions", note: "BBC delivered masters two weeks ahead of schedule." }],
    flags: [{ kind: "Mature Themes", level: "Some", auto: true }],
  },
  "NOVA": {
    title: "NOVA",
    tagline: "Science and technology documentaries",
    season: "Season 52",
    episodes: 20,
    genre: "Science",
    rights: { window: "Ongoing", territory: "US, all platforms", clearances: "Broadcast + Digital + Education" },
    funding: ["David H. Koch Fund for Science", "Public Broadcasting Fund", "Viewer Support"],
    contributors: [{ name: "Devon Carter", role: "Digital Producer", note: "Classroom resources published with each episode." }],
    flags: [],
  },
  "Ken Burns: The American Buffalo": {
    title: "Ken Burns: The American Buffalo",
    tagline: "The epic story of the American West's most iconic animal",
    season: "Limited",
    episodes: 2,
    genre: "Documentary",
    rights: { window: "Apr 1, 2026 – Mar 31, 2029", territory: "US + Canada", clearances: "Broadcast + Streaming" },
    funding: ["Bank of America", "Public Broadcasting Fund", "Park Foundation"],
    contributors: [{ name: "Marcus Reed", role: "Programming", note: "Pair with companion podcast series in Media Manager." }],
    flags: [],
  },
};

const INITIAL_ISSUES = [
  {
    id: "i1",
    show: "Antiques Roadshow",
    episode: "Season 28 · E11",
    station: "New Mexico Station",
    author: "K. Ortiz",
    type: "Accessibility",
    tags: ["No closed captioning", "Visual description missing"],
    description: "Episode arrived without closed captioning track. Visual description audio also not present on the SAP channel.",
    status: "Open",
    timestamp: "2 hours ago",
    replies: [],
  },
  {
    id: "i2",
    show: "Nature",
    episode: "Season 42 · E06",
    station: "Boston Station",
    author: "T. Nguyen",
    type: "Video",
    tags: ["Flicker", "Visual discrepancy"],
    description: "Visible flicker around the 14:32 mark, approximately 3 seconds. Appears to be a compression artifact.",
    status: "In Review",
    timestamp: "Yesterday",
    replies: [
      { author: "Operations Team", role: "staff", text: "Confirmed on master. Re-encoding now — new file ETA 6 hours.", timestamp: "45 min ago" },
    ],
  },
  {
    id: "i3",
    show: "Masterpiece",
    episode: "Season 53 · E03",
    station: "Chicago Station",
    author: "R. Patel",
    type: "Audio",
    tags: ["Sync issue"],
    description: "Audio drifts out of sync by ~200ms starting at 22:15. Happens through the end of the episode.",
    status: "Open",
    timestamp: "4 hours ago",
    replies: [],
  },
];

const ACTIVITY_TOPICS = [
  { id: "bugs", label: "Media Issues", icon: AlertCircle, desc: "Station-reported media file problems" },
  { id: "guide", label: "Schedule Updates", icon: Calendar, desc: "Changes to the programming guide" },
  { id: "rights", label: "Rights & Clearances", icon: Flag, desc: "New windows, expirations, territory changes" },
  { id: "shows", label: "Show Metadata", icon: Film, desc: "New contributor notes and advisories" },
];

// ========== MAIN COMPONENT ==========
export default function BroadcastOpsWidget() {
  const [role, setRole] = useState("station");
  const [activeTab, setActiveTab] = useState("guide");
  const [weekStartIndex, setWeekStartIndex] = useState(0); // 0 = week 1, 7 = week 2
  const [viewMode, setViewMode] = useState("week"); // "week" or "day"
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(TODAY));
  const [selectedChannels, setSelectedChannels] = useState(CHANNELS.map((c) => c.id));
  const [searchQuery, setSearchQuery] = useState("");
  const [issues, setIssues] = useState(INITIAL_ISSUES);
  const [selectedShow360, setSelectedShow360] = useState("Amanpour & Company");
  const [subscriptions, setSubscriptions] = useState(["bugs", "rights"]);
  const [notifDelivery, setNotifDelivery] = useState({ email: true, inApp: true });
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [replyDraft, setReplyDraft] = useState({});

  const [detailsModalShow, setDetailsModalShow] = useState(null);
  const [reportModalShow, setReportModalShow] = useState(null);

  const currentWeek = useMemo(
    () => DATE_RANGE.slice(weekStartIndex, weekStartIndex + 4),
    [weekStartIndex]
  );

  const selectedDate = useMemo(() => {
    return DATE_RANGE.find((d) => dateKey(d) === selectedDateKey) || TODAY;
  }, [selectedDateKey]);

  const weekSchedule = useMemo(() => {
    const weekKeys = currentWeek.map(dateKey);
    return SCHEDULE.filter(
      (s) => weekKeys.includes(s.dateKey) && selectedChannels.includes(s.channel)
    );
  }, [currentWeek, selectedChannels]);

  const daySchedule = useMemo(() => {
    return SCHEDULE.filter(
      (s) => s.dateKey === selectedDateKey && selectedChannels.includes(s.channel)
    );
  }, [selectedDateKey, selectedChannels]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const seen = new Set();
    return SCHEDULE.filter((s) => {
      if (
        s.show.toLowerCase().includes(q) ||
        s.episode.toLowerCase().includes(q) ||
        s.channel.toLowerCase().includes(q)
      ) {
        if (seen.has(s.show)) return false;
        seen.add(s.show);
        return true;
      }
      return false;
    });
  }, [searchQuery]);

  const toggleChannel = (id) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleSubscription = (id) => {
    setSubscriptions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const submitIssue = (show, draft) => {
    const newIssue = {
      id: `i${Date.now()}`,
      show: show.show,
      episode: show.episode,
      station: "Your Station",
      author: "You",
      type: draft.type,
      tags: draft.tags,
      description: draft.description,
      status: "Open",
      timestamp: "Just now",
      replies: [],
    };
    setIssues([newIssue, ...issues]);
    setReportModalShow(null);
    setActiveTab("issues");
  };

  const submitReply = (issueId) => {
    const text = replyDraft[issueId];
    if (!text || !text.trim()) return;
    setIssues(
      issues.map((i) =>
        i.id === issueId
          ? {
              ...i,
              status: "In Review",
              replies: [...i.replies, { author: "Operations Team", role: "staff", text, timestamp: "Just now" }],
            }
          : i
      )
    );
    setReplyDraft({ ...replyDraft, [issueId]: "" });
  };

  const openDetails = (showName) => SHOW_DETAILS[showName] && setDetailsModalShow(showName);
  const openReport = (scheduleItem) => setReportModalShow(scheduleItem);

  const openDayView = (d) => {
    setSelectedDateKey(dateKey(d));
    setViewMode("day");
  };

  const unreadCount = subscriptions.length * 2;

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "#f5f3ee", fontFamily: "'Source Sans Pro', -apple-system, system-ui, sans-serif" }}
    >
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

      {/* TOP BAR */}
      <header className="sticky top-0 z-40 border-b" style={{ background: "#1a2744", borderColor: "#0f1a30" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ background: "#f5a623" }}>
              <Radio className="w-5 h-5" style={{ color: "#1a2744" }} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-bold text-white text-lg leading-tight tracking-tight">
                Broadcast Operations
              </div>
              <div className="text-xs tracking-widest uppercase" style={{ color: "#a8b4cc" }}>
                Programming & Delivery Hub
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              className="relative p-2 rounded-md transition-colors"
              style={{ background: showNotifPanel ? "#f5a623" : "rgba(255,255,255,0.08)" }}
            >
              <Bell className="w-5 h-5" style={{ color: showNotifPanel ? "#1a2744" : "white" }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ background: "#f5a623", color: "#1a2744" }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center rounded-md p-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setRole("station")}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: role === "station" ? "#f5a623" : "transparent",
                  color: role === "station" ? "#1a2744" : "#a8b4cc",
                }}
              >
                <User className="w-3.5 h-3.5" />
                Station
              </button>
              <button
                onClick={() => setRole("hq")}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: role === "hq" ? "#f5a623" : "transparent",
                  color: role === "hq" ? "#1a2744" : "#a8b4cc",
                }}
              >
                <Users className="w-3.5 h-3.5" />
                HQ Staff
              </button>
            </div>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-thin">
          {[
            { id: "guide", label: "TV Guide", icon: Tv },
            { id: "issues", label: "Media Issues", icon: AlertCircle, badge: issues.filter((i) => i.status === "Open").length },
            { id: "search", label: "Search Shows", icon: Search },
            { id: "show360", label: "Show 360°", icon: Layers },
            { id: "activity", label: "Activity Stream", icon: BellRing, badge: subscriptions.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap"
                style={{
                  borderColor: active ? "#f5a623" : "transparent",
                  color: active ? "white" : "#a8b4cc",
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: active ? "#f5a623" : "#3a4866", color: active ? "#1a2744" : "white" }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {showNotifPanel && (
        <div
          className="fixed top-20 right-6 z-50 w-96 rounded-lg shadow-2xl border fade-in-up"
          style={{ background: "white", borderColor: "#e5e2d8" }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#e5e2d8" }}>
            <div className="font-display font-bold text-base" style={{ color: "#1a2744" }}>
              Recent Activity
            </div>
            <button onClick={() => setShowNotifPanel(false)}>
              <X className="w-4 h-4" style={{ color: "#6b6a63" }} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            <NotifItem title="New media issue reported" detail="K. Ortiz flagged Antiques Roadshow S28·E11" time="2h ago" topic="Media Issues" />
            <NotifItem title="Rights window extended" detail="Amanpour & Company streaming approved through FY27" time="5h ago" topic="Rights & Clearances" />
            <NotifItem title="Schedule change" detail="Masterpiece moved to 2pm Saturday block" time="Yesterday" topic="Schedule Updates" />
            <NotifItem title="New contributor note" detail="Count of Monte Cristo advisories published" time="2 days ago" topic="Show Metadata" />
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "guide" && (
          <Calendar360
            viewMode={viewMode}
            setViewMode={setViewMode}
            currentWeek={currentWeek}
            weekStartIndex={weekStartIndex}
            setWeekStartIndex={setWeekStartIndex}
            selectedDate={selectedDate}
            selectedDateKey={selectedDateKey}
            setSelectedDateKey={setSelectedDateKey}
            selectedChannels={selectedChannels}
            toggleChannel={toggleChannel}
            weekSchedule={weekSchedule}
            daySchedule={daySchedule}
            role={role}
            onReportIssue={openReport}
            onViewShow={(s) => openDetails(s.show)}
            onDayClick={openDayView}
          />
        )}

        {activeTab === "issues" && (
          <MediaIssues
            issues={issues}
            role={role}
            replyDraft={replyDraft}
            setReplyDraft={setReplyDraft}
            submitReply={submitReply}
            onOpenDetails={openDetails}
          />
        )}

        {activeTab === "search" && (
          <SearchView query={searchQuery} setQuery={setSearchQuery} results={searchResults} onSelectShow={openDetails} />
        )}

        {activeTab === "show360" && (
          <Show360Browser selected={selectedShow360} setSelected={setSelectedShow360} role={role} />
        )}

        {activeTab === "activity" && (
          <ActivityStream
            subscriptions={subscriptions}
            toggleSubscription={toggleSubscription}
            notifDelivery={notifDelivery}
            setNotifDelivery={setNotifDelivery}
          />
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-6 text-xs flex items-center justify-between" style={{ color: "#6b6a63" }}>
        <div>Signed in as {role === "station" ? "Station User" : "HQ Operations"}</div>
        <div className="flex items-center gap-4">
          <span>All times local</span>
          <span>v2.4.1</span>
        </div>
      </footer>

      {detailsModalShow && (
        <Modal onClose={() => setDetailsModalShow(null)} size="lg">
          <Show360Content
            show={detailsModalShow}
            role={role}
            onClose={() => setDetailsModalShow(null)}
            onReportIssue={() => {
              const scheduleItem = SCHEDULE.find((s) => s.show === detailsModalShow);
              if (scheduleItem) {
                setDetailsModalShow(null);
                setTimeout(() => setReportModalShow(scheduleItem), 200);
              }
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
              const showName = reportModalShow.show;
              if (SHOW_DETAILS[showName]) {
                setReportModalShow(null);
                setTimeout(() => setDetailsModalShow(showName), 200);
              }
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ========== CALENDAR VIEW (WEEK + DAY) ==========
function Calendar360({
  viewMode,
  setViewMode,
  currentWeek,
  weekStartIndex,
  setWeekStartIndex,
  selectedDate,
  selectedDateKey,
  setSelectedDateKey,
  selectedChannels,
  toggleChannel,
  weekSchedule,
  daySchedule,
  role,
  onReportIssue,
  onViewShow,
  onDayClick,
}) {
  const weekLabel = `${formatShortDate(currentWeek[0])} – ${formatShortDate(currentWeek[currentWeek.length - 1])}`;
  const canGoPrev = weekStartIndex > 0;
  const canGoNext = weekStartIndex + 4 < 14;

  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Programming"
        title="Schedule Calendar"
        subtitle="Two-week rolling window shown in 4-day blocks. Click any day to drill into an hourly timeline."
      />

      {/* Toolbar */}
      <div
        className="rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: "white", border: "1px solid #e5e2d8" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid #e5e2d8" }}>
            <button
              onClick={() => setViewMode("week")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: viewMode === "week" ? "#1a2744" : "white",
                color: viewMode === "week" ? "white" : "#1a2744",
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> 4-Day
            </button>
            <button
              onClick={() => setViewMode("day")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: viewMode === "day" ? "#1a2744" : "white",
                color: viewMode === "day" ? "white" : "#1a2744",
              }}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Day
            </button>
          </div>

          {viewMode === "week" && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => canGoPrev && setWeekStartIndex(Math.max(0, weekStartIndex - 4))}
                disabled={!canGoPrev}
                className="p-1.5 rounded"
                style={{
                  background: canGoPrev ? "#f5f3ee" : "transparent",
                  color: canGoPrev ? "#1a2744" : "#cbc9c0",
                  cursor: canGoPrev ? "pointer" : "not-allowed",
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold px-2" style={{ color: "#1a2744" }}>
                {weekLabel}
              </div>
              <button
                onClick={() => canGoNext && setWeekStartIndex(Math.min(10, weekStartIndex + 4))}
                disabled={!canGoNext}
                className="p-1.5 rounded"
                style={{
                  background: canGoNext ? "#f5f3ee" : "transparent",
                  color: canGoNext ? "#1a2744" : "#cbc9c0",
                  cursor: canGoNext ? "pointer" : "not-allowed",
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {viewMode === "day" && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => {
                  const idx = DATE_RANGE.findIndex((d) => dateKey(d) === selectedDateKey);
                  if (idx > 0) setSelectedDateKey(dateKey(DATE_RANGE[idx - 1]));
                }}
                className="p-1.5 rounded"
                style={{ background: "#f5f3ee", color: "#1a2744" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold px-2" style={{ color: "#1a2744" }}>
                {formatFullDate(selectedDate)}
              </div>
              <button
                onClick={() => {
                  const idx = DATE_RANGE.findIndex((d) => dateKey(d) === selectedDateKey);
                  if (idx < DATE_RANGE.length - 1) setSelectedDateKey(dateKey(DATE_RANGE[idx + 1]));
                }}
                className="p-1.5 rounded"
                style={{ background: "#f5f3ee", color: "#1a2744" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setSelectedDateKey(dateKey(TODAY));
            setWeekStartIndex(0);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded"
          style={{ background: "#f5a623", color: "#1a2744" }}
        >
          Today
        </button>
      </div>

      {/* Channel filters */}
      <div className="rounded-lg p-4" style={{ background: "white", border: "1px solid #e5e2d8" }}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6b6a63" }}>
          <Tv className="w-3.5 h-3.5" /> Channels ({selectedChannels.length}/{CHANNELS.length})
        </div>
        <div className="flex gap-2 flex-wrap">
          {CHANNELS.map((c) => {
            const on = selectedChannels.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleChannel(c.id)}
                className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-all"
                style={{
                  background: on ? c.color : "#f5f3ee",
                  color: on ? "white" : "#1a2744",
                  border: `1px solid ${on ? c.color : "#e5e2d8"}`,
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: on ? "white" : c.color }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar body */}
      {viewMode === "week" ? (
        <WeekGrid
          currentWeek={currentWeek}
          weekSchedule={weekSchedule}
          onDayClick={onDayClick}
          onViewShow={onViewShow}
          onReportIssue={onReportIssue}
          role={role}
        />
      ) : (
        <DayTimeline
          selectedDate={selectedDate}
          daySchedule={daySchedule}
          onViewShow={onViewShow}
          onReportIssue={onReportIssue}
          role={role}
        />
      )}
    </div>
  );
}

// ---------- WEEK GRID ----------
function WeekGrid({ currentWeek, weekSchedule, onDayClick, onViewShow, onReportIssue, role }) {
  const scheduleByDay = useMemo(() => {
    const m = {};
    currentWeek.forEach((d) => (m[dateKey(d)] = []));
    weekSchedule.forEach((s) => {
      if (m[s.dateKey]) m[s.dateKey].push(s);
    });
    return m;
  }, [currentWeek, weekSchedule]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e5e2d8" }}>
      <div className="grid grid-cols-4">
        {currentWeek.map((d) => {
          const isToday = isSameDay(d, TODAY);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const dayItems = scheduleByDay[dateKey(d)] || [];

          return (
            <button
              key={dateKey(d)}
              onClick={() => onDayClick(d)}
              className="text-left p-4 transition-colors hover:bg-gray-50 flex flex-col min-w-0"
              style={{
                borderRight: "1px solid #e5e2d8",
                borderBottom: "1px solid #e5e2d8",
                minHeight: 420,
                background: isToday ? "#fef9e7" : isWeekend ? "#faf8f3" : "white",
              }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>
                    {formatDayName(d)}
                  </div>
                  <div
                    className="font-display font-black text-3xl leading-none"
                    style={{ color: isToday ? "#f5a623" : "#1a2744" }}
                  >
                    {formatDayNumber(d)}
                  </div>
                </div>
                {isToday && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: "#f5a623", color: "#1a2744" }}
                  >
                    Today
                  </span>
                )}
              </div>
              <div className="space-y-1.5 flex-1 overflow-hidden">
                {dayItems.slice(0, 9).map((s) => {
                  const channel = CHANNELS.find((c) => c.id === s.channel);
                  return (
                    <div
                      key={s.id}
                      className="rounded px-2.5 py-1.5 text-[11px] leading-tight overflow-hidden"
                      style={{
                        background: `${channel.color}12`,
                        borderLeft: `3px solid ${channel.color}`,
                      }}
                    >
                      <div className="font-bold truncate" style={{ color: "#1a2744" }}>
                        {s.time} · {s.show}
                      </div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: "#6b6a63" }}>
                        {channel.label} · {s.duration}m
                      </div>
                    </div>
                  );
                })}
                {dayItems.length > 9 && (
                  <div className="text-[11px] font-semibold mt-1" style={{ color: "#f5a623" }}>
                    +{dayItems.length - 9} more
                  </div>
                )}
                {dayItems.length === 0 && (
                  <div className="text-xs italic" style={{ color: "#a8a59a" }}>
                    No programming
                  </div>
                )}
              </div>
              <div className="text-[11px] mt-3 pt-3 flex items-center gap-1 font-semibold" style={{ color: "#1a2744", borderTop: "1px solid #e5e2d8" }}>
                <CalendarDays className="w-3 h-3" />
                View day timeline
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- DAY TIMELINE ----------
function DayTimeline({ selectedDate, daySchedule, onViewShow, onReportIssue, role }) {
  const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 5am to 11pm
  const isToday = isSameDay(selectedDate, TODAY);

  const scheduleByHour = useMemo(() => {
    const m = {};
    daySchedule.forEach((s) => {
      if (!m[s.hour]) m[s.hour] = [];
      m[s.hour].push(s);
    });
    return m;
  }, [daySchedule]);

  const formatHour = (h) => {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "white", border: "1px solid #e5e2d8" }}>
      <div
        className="px-5 py-4"
        style={{ background: isToday ? "#fef9e7" : "#f5f3ee", borderBottom: "1px solid #e5e2d8" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
            style={{ background: isToday ? "#f5a623" : "#1a2744" }}
          >
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isToday ? "#1a2744" : "#f5a623" }}>
              {formatDayName(selectedDate)}
            </div>
            <div className="font-display font-black text-xl leading-none" style={{ color: isToday ? "#1a2744" : "white" }}>
              {formatDayNumber(selectedDate)}
            </div>
          </div>
          <div>
            <div className="font-display font-bold text-lg" style={{ color: "#1a2744" }}>
              {formatFullDate(selectedDate)}
            </div>
            <div className="text-xs" style={{ color: "#6b6a63" }}>
              {daySchedule.length} program{daySchedule.length === 1 ? "" : "s"} scheduled
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "#e5e2d8" }}>
        {HOURS.map((h) => {
          const items = scheduleByHour[h] || [];
          return (
            <div key={h} className="flex" style={{ borderColor: "#f0ede4" }}>
              <div
                className="w-20 px-4 py-3 text-xs font-semibold flex-shrink-0"
                style={{ background: "#faf8f3", color: "#6b6a63", borderRight: "1px solid #e5e2d8" }}
              >
                {formatHour(h)}
              </div>
              <div className="flex-1 py-3 px-3 space-y-2">
                {items.length === 0 ? (
                  <div className="text-xs italic py-1" style={{ color: "#cbc9c0" }}>
                    —
                  </div>
                ) : (
                  items.map((s) => {
                    const channel = CHANNELS.find((c) => c.id === s.channel);
                    const hasDetails = !!SHOW_DETAILS[s.show];
                    return (
                      <div
                        key={s.id}
                        className="rounded-lg p-3 flex items-center gap-3 transition-shadow hover:shadow-sm"
                        style={{
                          background: `${channel.color}08`,
                          borderLeft: `3px solid ${channel.color}`,
                          border: `1px solid ${channel.color}30`,
                          borderLeftWidth: 3,
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: channel.color, color: "white" }}
                            >
                              {channel.label}
                            </span>
                            <span className="text-xs font-bold" style={{ color: "#1a2744" }}>
                              {s.time}
                            </span>
                            <span className="text-xs" style={{ color: "#6b6a63" }}>
                              · {s.duration} min
                            </span>
                          </div>
                          <div className="font-display font-bold text-sm mt-0.5" style={{ color: "#1a2744" }}>
                            {s.show}
                          </div>
                          <div className="text-[11px]" style={{ color: "#6b6a63" }}>
                            {s.episode}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => onViewShow(s)}
                            disabled={!hasDetails}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded flex items-center gap-1"
                            style={{
                              background: "white",
                              color: hasDetails ? "#1a2744" : "#a8a59a",
                              border: "1px solid #e5e2d8",
                              cursor: hasDetails ? "pointer" : "not-allowed",
                            }}
                          >
                            Details <ChevronRight className="w-3 h-3" />
                          </button>
                          {role === "station" && (
                            <button
                              onClick={() => onReportIssue(s)}
                              className="text-[11px] font-semibold px-2.5 py-1.5 rounded flex items-center gap-1"
                              style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                            >
                              <Flag className="w-3 h-3" /> Report
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== MODAL SHELL ==========
function Modal({ children, onClose, size = "lg" }) {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const maxWidth = size === "lg" ? "max-w-5xl" : "max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
      style={{ background: "rgba(15, 26, 48, 0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className={`${maxWidth} w-full max-h-[90vh] rounded-xl shadow-2xl flex flex-col modal-content overflow-hidden`}
        style={{ background: "#f5f3ee", border: "1px solid #e5e2d8" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ========== REPORT FORM ==========
function ReportForm({ scheduleItem, onSubmit, onClose, onViewDetails }) {
  const [draft, setDraft] = useState({ type: "Video", tags: [], description: "" });
  const channel = CHANNELS.find((c) => c.id === scheduleItem.channel);
  const hasDetails = !!SHOW_DETAILS[scheduleItem.show];

  const issueTypes = [
    { id: "Video", icon: Film, desc: "Picture quality, artifacts" },
    { id: "Audio", icon: Radio, desc: "Sound issues, levels" },
    { id: "Accessibility", icon: Eye, desc: "Captions, descriptions" },
    { id: "Metadata", icon: FileText, desc: "Wrong info, titles" },
    { id: "Rights", icon: Flag, desc: "Clearance problems" },
  ];

  const commonTags = {
    Video: ["Flicker", "Visual discrepancy", "Frame drop", "Color shift", "Wrong aspect ratio"],
    Audio: ["Audio dropout", "Levels too low", "Sync issue", "Distortion"],
    Accessibility: ["No closed captioning", "Missing audio description", "Caption sync off"],
    Metadata: ["Wrong title", "Wrong episode", "Missing info"],
    Rights: ["Wrong territory", "Window expired", "Missing clearance"],
  };

  const toggleTag = (t) => {
    setDraft({
      ...draft,
      tags: draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t],
    });
  };

  const canSubmit = draft.description.trim().length > 0;

  return (
    <>
      <div
        className="relative px-6 py-5 flex items-start justify-between flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1a2744 0%, #2d3f6b 100%)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#f5a623" }}>
            <Flag className="w-3 h-3 inline mr-1" /> Report Media Issue
          </div>
          <h2 className="font-display font-black text-xl text-white leading-tight">{scheduleItem.show}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: "#a8b4cc" }}>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: channel.color, color: "white" }}
            >
              {channel.label}
            </span>
            <span>{scheduleItem.episode}</span>
            <span>·</span>
            <span>{scheduleItem.time} {scheduleItem.date}</span>
            <span>·</span>
            <span>{scheduleItem.duration} min</span>
          </div>
          {hasDetails && (
            <button
              onClick={onViewDetails}
              className="text-xs font-semibold mt-2 flex items-center gap-1 transition-opacity hover:opacity-80"
              style={{ color: "#f5a623" }}
            >
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
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6b6a63" }}>
            Issue Type
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {issueTypes.map((t) => {
              const Icon = t.icon;
              const active = draft.type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setDraft({ ...draft, type: t.id, tags: [] })}
                  className="rounded-lg p-3 text-left transition-all"
                  style={{
                    background: active ? "#1a2744" : "white",
                    border: `2px solid ${active ? "#f5a623" : "#e5e2d8"}`,
                  }}
                >
                  <Icon className="w-4 h-4 mb-1.5" style={{ color: active ? "#f5a623" : "#1a2744" }} />
                  <div className="text-xs font-bold" style={{ color: active ? "white" : "#1a2744" }}>
                    {t.id}
                  </div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: active ? "#a8b4cc" : "#6b6a63" }}>
                    {t.desc}
                  </div>
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
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all"
                style={{
                  background: draft.tags.includes(t) ? "#f5a623" : "white",
                  color: draft.tags.includes(t) ? "#1a2744" : "#6b6a63",
                  border: `1px solid ${draft.tags.includes(t) ? "#f5a623" : "#e5e2d8"}`,
                }}
              >
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
            <AlertCircle className="w-3 h-3" />
            Your report will route to the Operations team and appear in the Media Issues queue.
          </div>
        </div>
      </div>

      <div
        className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: "white", borderTop: "1px solid #e5e2d8" }}
      >
        <div className="text-xs" style={{ color: "#6b6a63" }}>
          Reporting as <strong style={{ color: "#1a2744" }}>Your Station</strong>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "#6b6a63" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(draft)}
            disabled={!canSubmit}
            className="px-5 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all"
            style={{
              background: canSubmit ? "#f5a623" : "#e5e2d8",
              color: canSubmit ? "#1a2744" : "#a8a59a",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            <Send className="w-3.5 h-3.5" /> Submit Issue
          </button>
        </div>
      </div>
    </>
  );
}

// ========== SHOW 360 MODAL CONTENT ==========
function Show360Content({ show, role, onClose, onReportIssue }) {
  const details = SHOW_DETAILS[show];
  if (!details) return null;

  const scheduleItem = SCHEDULE.find((s) => s.show === show);

  const flagIcons = {
    Violence: AlertTriangle,
    "Mature Themes": Eye,
    "Brief Nudity": Eye,
    "Medical Content": Heart,
    "Disturbing Content": AlertTriangle,
  };

  return (
    <>
      <div
        className="relative px-6 py-6 flex items-start justify-between flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1a2744 0%, #2d3f6b 100%)" }}
      >
        <div
          className="absolute top-0 right-0 w-96 h-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, #f5a623 0%, transparent 60%)" }}
        />
        <div className="relative flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#f5a623" }}>
            <Layers className="w-3 h-3 inline mr-1" /> Show 360° · {details.genre}
          </div>
          <h2 className="font-display font-black text-3xl text-white leading-tight mb-1">{details.title}</h2>
          <p className="text-sm" style={{ color: "#a8b4cc" }}>{details.tagline}</p>

          <div className="flex gap-6 mt-4 text-xs" style={{ color: "#a8b4cc" }}>
            <div>
              <div className="uppercase tracking-wider opacity-70">Episodes</div>
              <div className="font-display font-bold text-white text-lg">{details.episodes}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider opacity-70">Season</div>
              <div className="font-display font-bold text-white text-lg">{details.season}</div>
            </div>
            {scheduleItem && (
              <div>
                <div className="uppercase tracking-wider opacity-70">Next Airing</div>
                <div className="font-display font-bold text-white text-lg">
                  {scheduleItem.time} {scheduleItem.date.split(",")[0]}
                </div>
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} className="relative p-1.5 rounded hover:bg-white/10 transition-colors ml-4">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="overflow-y-auto scrollbar-thin flex-1 px-6 py-5 space-y-4">
        {details.flags.length > 0 && (
          <ModalCard title="Content Advisories" eyebrow="Auto-synced from data lake" icon={AlertTriangle} iconColor="#d97706">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {details.flags.map((f) => {
                const Icon = flagIcons[f.kind] || AlertCircle;
                return (
                  <div key={f.kind} className="rounded-lg p-3" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                    <Icon className="w-4 h-4 mb-2" style={{ color: "#92400e" }} />
                    <div className="text-xs font-bold" style={{ color: "#92400e" }}>{f.kind}</div>
                    <div className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: "#b45309" }}>{f.level}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs mt-3 italic" style={{ color: "#6b6a63" }}>
              Advisories automatically generated by upstream scheduling + screening systems.
            </p>
          </ModalCard>
        )}

        <ModalCard title="Rights & Clearances" eyebrow="Rights management system" icon={Flag} iconColor="#7c2d12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <InfoBlock label="Window" value={details.rights.window} />
            <InfoBlock label="Territory" value={details.rights.territory} />
            <InfoBlock label="Clearances" value={details.rights.clearances} />
          </div>
        </ModalCard>

        <ModalCard title="Funding Credits" eyebrow="Rights management system" icon={Sparkles} iconColor="#059669">
          <div className="flex gap-2 flex-wrap">
            {details.funding.map((f) => (
              <span
                key={f}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: "#f5f3ee", color: "#1a2744", border: "1px solid #e5e2d8" }}
              >
                {f}
              </span>
            ))}
          </div>
        </ModalCard>

        <ModalCard title="Contributor Notes" eyebrow="Custom annotations" icon={FileText} iconColor="#1a2744">
          <div className="space-y-3">
            {details.contributors.map((c, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: "#f5f3ee" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "#1a2744" }}
                  >
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#1a2744" }}>{c.name}</div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: "#6b6a63" }}>{c.role}</div>
                  </div>
                </div>
                <p className="text-sm" style={{ color: "#3a3833" }}>{c.note}</p>
              </div>
            ))}
            {role === "hq" && (
              <button className="text-xs font-semibold flex items-center gap-1" style={{ color: "#1a2744" }}>
                <Plus className="w-3.5 h-3.5" /> Add contributor note
              </button>
            )}
          </div>
        </ModalCard>
      </div>

      <div
        className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: "white", borderTop: "1px solid #e5e2d8" }}
      >
        <div className="text-xs" style={{ color: "#6b6a63" }}>
          Data aggregated from scheduling, rights, and CMS systems.
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "#6b6a63" }}
          >
            Close
          </button>
          {role === "station" && scheduleItem && (
            <button
              onClick={onReportIssue}
              className="px-4 py-2 text-sm font-bold rounded-lg flex items-center gap-2 transition-all"
              style={{ background: "#f5a623", color: "#1a2744" }}
            >
              <Flag className="w-3.5 h-3.5" /> Report Issue
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ModalCard({ title, eyebrow, icon: Icon, iconColor, children }) {
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

function InfoBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6b6a63" }}>{label}</div>
      <div style={{ color: "#1a2744" }}>{value}</div>
    </div>
  );
}

// ========== MEDIA ISSUES ==========
function MediaIssues({ issues, role, replyDraft, setReplyDraft, submitReply, onOpenDetails }) {
  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Operations"
        title="Media Delivery Issues"
        subtitle={role === "station" ? "Reports you or other stations have submitted. Go to the TV Guide and click Report on any show to file a new issue." : "Review and respond to issues reported by stations."}
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
    Open: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
    "In Review": { bg: "#dbeafe", fg: "#1e40af", border: "#bfdbfe" },
    Resolved: { bg: "#d1fae5", fg: "#065f46", border: "#a7f3d0" },
  };
  const status = statusColors[issue.status];
  const hasDetails = !!SHOW_DETAILS[issue.show];

  return (
    <div
      className="rounded-lg p-5 fade-in-up"
      style={{ background: "white", border: "1px solid #e5e2d8", animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              onClick={() => hasDetails && onOpenDetails(issue.show)}
              disabled={!hasDetails}
              className="font-display font-bold text-base transition-colors"
              style={{
                color: "#1a2744",
                cursor: hasDetails ? "pointer" : "default",
                textDecoration: hasDetails ? "underline" : "none",
                textDecorationColor: "#f5a623",
                textUnderlineOffset: 3,
              }}
            >
              {issue.show}
            </button>
            <span className="text-xs" style={{ color: "#6b6a63" }}>· {issue.episode}</span>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#6b6a63" }}>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {issue.author} · {issue.station}
            </span>
            <span>{issue.timestamp}</span>
          </div>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded uppercase tracking-wider flex-shrink-0"
          style={{ background: status.bg, color: status.fg, border: `1px solid ${status.border}` }}
        >
          {issue.status}
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "#1a2744", color: "white" }}>
          {issue.type}
        </span>
        {issue.tags.map((t) => (
          <span
            key={t}
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "#f5f3ee", color: "#1a2744", border: "1px solid #e5e2d8" }}
          >
            {t}
          </span>
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
              <textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Respond to the station..."
                className="w-full rounded p-2 text-sm resize-none outline-none"
                style={{ background: "#f5f3ee", border: "1px solid #e5e2d8", color: "#1a2744", minHeight: 70 }}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setExpanded(false)} className="text-xs font-semibold" style={{ color: "#6b6a63" }}>Cancel</button>
                <button
                  onClick={() => { submitReply(); setExpanded(false); }}
                  disabled={!replyDraft.trim()}
                  className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1"
                  style={{
                    background: replyDraft.trim() ? "#1a2744" : "#e5e2d8",
                    color: replyDraft.trim() ? "white" : "#a8a59a",
                  }}
                >
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

// ========== SEARCH ==========
function SearchView({ query, setQuery, results, onSelectShow }) {
  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Discovery"
        title="Search the Catalog"
        subtitle="Find any show, episode, or channel in the programming database."
      />

      <div className="rounded-lg flex items-center gap-3 p-4" style={{ background: "white", border: "2px solid #1a2744" }}>
        <Search className="w-5 h-5" style={{ color: "#1a2744" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shows, episodes, or channels..."
          autoFocus
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: "#1a2744" }}
        />
        {query && (
          <button onClick={() => setQuery("")}>
            <X className="w-4 h-4" style={{ color: "#6b6a63" }} />
          </button>
        )}
      </div>

      {!query && (
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6b6a63" }}>
            Suggested searches
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Amanpour", "Antiques Roadshow", "Frontline", "Nature", "Masterpiece", "NOVA", "Ken Burns"].map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="px-3 py-1.5 rounded text-xs font-semibold"
                style={{ background: "white", color: "#1a2744", border: "1px solid #e5e2d8" }}
              >
                {s}
              </button>
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
            const channel = CHANNELS.find((c) => c.id === r.channel);
            const has360 = !!SHOW_DETAILS[r.show];
            return (
              <div
                key={r.id}
                className="rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition-shadow fade-in-up"
                style={{ background: "white", border: "1px solid #e5e2d8", animationDelay: `${idx * 30}ms` }}
              >
                <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: channel.color }}>
                  <Film className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-base" style={{ color: "#1a2744" }}>{r.show}</div>
                  <div className="text-xs" style={{ color: "#6b6a63" }}>
                    {r.episode} · {channel.label} · Next airs {r.time} {r.date}
                  </div>
                </div>
                <button
                  onClick={() => onSelectShow(r.show)}
                  disabled={!has360}
                  className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1"
                  style={{
                    background: has360 ? "#1a2744" : "#f5f3ee",
                    color: has360 ? "white" : "#a8a59a",
                    cursor: has360 ? "pointer" : "not-allowed",
                  }}
                >
                  {has360 ? "View 360°" : "No details"}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== SHOW 360 BROWSER TAB ==========
function Show360Browser({ selected, setSelected, role }) {
  const details = SHOW_DETAILS[selected];
  if (!details) return null;

  const flagIcons = {
    Violence: AlertTriangle,
    "Mature Themes": Eye,
    "Brief Nudity": Eye,
    "Medical Content": Heart,
    "Disturbing Content": AlertTriangle,
  };

  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Consolidated View"
        title="Show 360°"
        subtitle="A single pane aggregating scheduling, rights, funding, and contributor notes across all upstream systems."
      />

      <div className="flex gap-2 flex-wrap">
        {Object.keys(SHOW_DETAILS).map((s) => (
          <button
            key={s}
            onClick={() => setSelected(s)}
            className="px-3 py-1.5 rounded text-xs font-semibold"
            style={{
              background: selected === s ? "#1a2744" : "white",
              color: selected === s ? "white" : "#1a2744",
              border: `1px solid ${selected === s ? "#1a2744" : "#e5e2d8"}`,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a2744 0%, #2d3f6b 100%)" }}>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-10" style={{ background: "radial-gradient(circle, #f5a623 0%, transparent 70%)" }} />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#f5a623" }}>
            {details.genre} · {details.season}
          </div>
          <h2 className="font-display font-black text-3xl text-white leading-tight mb-2">{details.title}</h2>
          <p className="text-sm max-w-2xl" style={{ color: "#a8b4cc" }}>{details.tagline}</p>
          <div className="flex gap-6 mt-4 text-xs" style={{ color: "#a8b4cc" }}>
            <div>
              <div className="uppercase tracking-wider opacity-70">Episodes</div>
              <div className="font-display font-bold text-white text-lg">{details.episodes}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider opacity-70">Season</div>
              <div className="font-display font-bold text-white text-lg">{details.season}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider opacity-70">Genre</div>
              <div className="font-display font-bold text-white text-lg">{details.genre}</div>
            </div>
          </div>
        </div>
      </div>

      {details.flags.length > 0 && (
        <ModalCard title="Content Advisories" eyebrow="Auto-synced from data lake" icon={AlertTriangle} iconColor="#d97706">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {details.flags.map((f) => {
              const Icon = flagIcons[f.kind] || AlertCircle;
              return (
                <div key={f.kind} className="rounded p-3" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                  <Icon className="w-4 h-4 mb-2" style={{ color: "#92400e" }} />
                  <div className="text-xs font-bold" style={{ color: "#92400e" }}>{f.kind}</div>
                  <div className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: "#b45309" }}>{f.level}</div>
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-3 italic" style={{ color: "#6b6a63" }}>
            Advisories automatically generated by upstream scheduling + screening systems.
          </p>
        </ModalCard>
      )}

      <ModalCard title="Rights & Clearances" eyebrow="Rights management system" icon={Flag} iconColor="#7c2d12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <InfoBlock label="Window" value={details.rights.window} />
          <InfoBlock label="Territory" value={details.rights.territory} />
          <InfoBlock label="Clearances" value={details.rights.clearances} />
        </div>
      </ModalCard>

      <ModalCard title="Funding Credits" eyebrow="Rights management system" icon={Sparkles} iconColor="#059669">
        <div className="flex gap-2 flex-wrap">
          {details.funding.map((f) => (
            <span
              key={f}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: "#f5f3ee", color: "#1a2744", border: "1px solid #e5e2d8" }}
            >
              {f}
            </span>
          ))}
        </div>
      </ModalCard>

      <ModalCard title="Contributor Notes" eyebrow="Custom annotations" icon={FileText} iconColor="#1a2744">
        <div className="space-y-3">
          {details.contributors.map((c, i) => (
            <div key={i} className="rounded p-3" style={{ background: "#f5f3ee" }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1a2744" }}>
                  {c.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#1a2744" }}>{c.name}</div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: "#6b6a63" }}>{c.role}</div>
                </div>
              </div>
              <p className="text-sm" style={{ color: "#3a3833" }}>{c.note}</p>
            </div>
          ))}
          {role === "hq" && (
            <button className="text-xs font-semibold flex items-center gap-1" style={{ color: "#1a2744" }}>
              <Plus className="w-3.5 h-3.5" /> Add contributor note
            </button>
          )}
        </div>
      </ModalCard>
    </div>
  );
}

// ========== ACTIVITY STREAM ==========
function ActivityStream({ subscriptions, toggleSubscription, notifDelivery, setNotifDelivery }) {
  return (
    <div className="space-y-6 fade-in-up">
      <SectionHeader
        eyebrow="Stay Informed"
        title="Activity Stream"
        subtitle="Subscribe to topics to receive updates by email and in-app when something changes."
      />

      <ModalCard title="Delivery Preferences" eyebrow="How you want to hear about it" icon={Bell} iconColor="#1a2744">
        <div className="flex gap-3">
          <button
            onClick={() => setNotifDelivery({ ...notifDelivery, email: !notifDelivery.email })}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-semibold transition-all"
            style={{
              background: notifDelivery.email ? "#1a2744" : "#f5f3ee",
              color: notifDelivery.email ? "white" : "#1a2744",
              border: `1px solid ${notifDelivery.email ? "#1a2744" : "#e5e2d8"}`,
            }}
          >
            <Mail className="w-4 h-4" />
            Email
            {notifDelivery.email && <CheckCircle2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setNotifDelivery({ ...notifDelivery, inApp: !notifDelivery.inApp })}
            className="flex items-center gap-2 px-4 py-2.5 rounded text-sm font-semibold transition-all"
            style={{
              background: notifDelivery.inApp ? "#1a2744" : "#f5f3ee",
              color: notifDelivery.inApp ? "white" : "#1a2744",
              border: `1px solid ${notifDelivery.inApp ? "#1a2744" : "#e5e2d8"}`,
            }}
          >
            <BellRing className="w-4 h-4" />
            In-app
            {notifDelivery.inApp && <CheckCircle2 className="w-4 h-4" />}
          </button>
        </div>
      </ModalCard>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#6b6a63" }}>
          Topics — {subscriptions.length} subscribed
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACTIVITY_TOPICS.map((t) => {
            const Icon = t.icon;
            const sub = subscriptions.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleSubscription(t.id)}
                className="rounded-lg p-4 text-left transition-all hover:shadow-md"
                style={{
                  background: sub ? "#1a2744" : "white",
                  border: `2px solid ${sub ? "#f5a623" : "#e5e2d8"}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: sub ? "#f5a623" : "#f5f3ee" }}>
                    <Icon className="w-5 h-5" style={{ color: "#1a2744" }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-display font-bold text-base" style={{ color: sub ? "white" : "#1a2744" }}>{t.label}</div>
                      {sub && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#f5a623", color: "#1a2744" }}>
                          Subscribed
                        </span>
                      )}
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
          <div className="text-sm text-center py-6" style={{ color: "#6b6a63" }}>
            Subscribe to a topic above to see activity here.
          </div>
        ) : (
          <div className="space-y-3">
            <ActivityItem topic="Media Issues" title="New issue reported" detail="Antiques Roadshow · S28·E11 flagged for accessibility" time="2h ago" />
            <ActivityItem topic="Rights & Clearances" title="Window extended" detail="Amanpour & Company streaming approved through FY27" time="5h ago" />
            <ActivityItem topic="Schedule Updates" title="Programming change" detail="Masterpiece moved to Saturday 2pm slot" time="Yesterday" />
            <ActivityItem topic="Show Metadata" title="Advisories published" detail="Count of Monte Cristo content flags now available" time="2 days ago" />
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

// ========== SHARED ==========
function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#f5a623" }}>{eyebrow}</div>
      <h1 className="font-display font-black text-3xl leading-tight" style={{ color: "#1a2744" }}>{title}</h1>
      <p className="text-sm mt-2 max-w-2xl" style={{ color: "#6b6a63" }}>{subtitle}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="rounded-lg p-12 text-center" style={{ background: "white", border: "1px dashed #cbc9c0" }}>
      <Icon className="w-10 h-10 mx-auto mb-3" style={{ color: "#cbc9c0" }} />
      <p className="text-sm" style={{ color: "#6b6a63" }}>{message}</p>
    </div>
  );
}

function NotifItem({ title, detail, time, topic }) {
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
