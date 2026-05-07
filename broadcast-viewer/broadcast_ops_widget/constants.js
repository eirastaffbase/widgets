export const CHANNELS = [
  { id: "frontline",    label: "Frontline",           color: "#7b1d1d" },
  { id: "findingroots", label: "Finding Your Roots",  color: "#166534" },
  { id: "amanpour",    label: "Amanpour & Co.",       color: "#1e3a8a" },
];

export const CHANNEL_SB = {
  frontline:    { sbId: "69f2c4d055eb276693d0a6ca", duration: 60 },
  findingroots: { sbId: "69f2c4db6783920c5e0a8218", duration: 60 },
  amanpour:     { sbId: "69f2c4f455eb276693d0a870", duration: 60 },
};

export const SHOW_DETAILS = {
  "Frontline": {
    title: "Frontline",
    tagline: "Investigative journalism that exposes injustice",
    season: "Season 44",
    episodes: 24,
    genre: "Documentary",
    rights: { window: "Ongoing", territory: "US, all platforms", clearances: "Broadcast + Digital" },
    funding: ["Public Broadcasting Fund", "Ford Foundation", "Park Foundation"],
    contributors: [
      { name: "Alex Rivera", role: "Series Producer", note: "E08 contains archival footage — pre-cleared for broadcast." },
    ],
    flags: [
      { kind: "Mature Themes",     level: "Strong",   auto: true },
      { kind: "Disturbing Content", level: "Moderate", auto: true },
    ],
  },
  "Finding Your Roots": {
    title: "Finding Your Roots",
    tagline: "Henry Louis Gates Jr. reveals the surprising family histories of prominent Americans",
    season: "Season 11",
    episodes: 10,
    genre: "Documentary",
    rights: { window: "Mar 1, 2026 – Feb 28, 2029", territory: "US, all platforms", clearances: "Broadcast + Streaming" },
    funding: ["Bank of America", "Ancestry", "Viewer Support"],
    contributors: [
      { name: "Sarah Kim",    role: "Digital Lead",       note: "Companion articles published on pbs.org same day as broadcast." },
      { name: "Marcus Webb",  role: "Rights Coordinator", note: "Streaming window confirmed for all S11 episodes." },
    ],
    flags: [{ kind: "Mature Themes", level: "Some", auto: true }],
  },
  "Amanpour & Co.": {
    title: "Amanpour & Co.",
    tagline: "Wide-ranging, in-depth interviews with global newsmakers and thought leaders",
    season: "Season 2026",
    episodes: 220,
    genre: "News & Public Affairs",
    rights: { window: "Feb 1, 2026 – Jan 31, 2027", territory: "US, all platforms", clearances: "Cleared for VOD + Streaming" },
    funding: ["Rosalind P. Walter", "Mutual of America", "Viewer Support"],
    contributors: [
      { name: "Maria Chen",   role: "Scheduling Lead",    note: "Confirmed 60-min cutdowns available for weekend slots." },
      { name: "Jordan Fields", role: "Rights Coordinator", note: "Streaming extension approved through FY27." },
    ],
    flags: [],
  },
};

export const INITIAL_ISSUES = [
  {
    id: "i1",
    show: "Finding Your Roots",
    episode: "Roots: Icons of Hollywood",
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
    show: "Frontline",
    episode: "Frontline: The Plastics Trap",
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
    show: "Finding Your Roots",
    episode: "Roots: The Writers' Room",
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
