import { CHANNELS, CHANNEL_SB } from "./constants.js";
import { parseTimestamps, tsDateKey, tsShortDate, tsHour, tsFormatTime, getDaypart, tsToETDate, DATE_RANGE, dateKey } from "./utils.js";

const SB_API   = "https://app.staffbase.com/api";
const SB_KEY   = "NjlmYjIzODZkMjBiNGE3NzZlODJmZmNkOi5NakImMkFha05hdUMxd1F0KVR9fWYycUp7ZVljQWczLktBN1oySmpOOCQ0XTlpK35zRFJ4IV5KYi1pfmlbTUM=";
const ISSUES_URL = "https://script.google.com/macros/s/AKfycbz_Q7qpr87EXGaGS8XBNNaBllwvNTO9nIASAYUlaDF1gfeszd3R2yqwBDMWRlJzJcuMmA/exec";

function parseDuration(content, defaultDuration) {
  const m = content.match(/duration:(\d+)/);
  return m ? parseInt(m[1], 10) : defaultDuration;
}

async function fetchChannelPosts(sbId) {
  const headers = { authorization: `Basic ${SB_KEY}`, accept: "application/json" };
  for (const url of [
    `${SB_API}/channels/${sbId}/posts?limit=50`,
    `${SB_API}/branch/channels/${sbId}/posts?limit=50`,
  ]) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.data?.length > 0) return data.data;
    } catch (_) {}
  }
  return [];
}

export async function fetchScheduleFromStaffbase() {
  const rangeKeys = new Set(DATE_RANGE.map(dateKey));
  const items = [];

  for (const ch of CHANNELS) {
    const cfg = CHANNEL_SB[ch.id];
    try {
      const posts = await fetchChannelPosts(cfg.sbId);
      for (const post of posts) {
        const title = post.contents?.en_US?.title;
        if (!title || title === "Summary") continue;
        const content  = post.contents?.en_US?.content || "";
        const teaser   = post.contents?.en_US?.teaser  || "";
        const duration = parseDuration(content, cfg.duration);
        for (const ts of parseTimestamps(content)) {
          const dk = tsDateKey(ts);
          if (!rangeKeys.has(dk)) continue;
          const hour = tsHour(ts);
          items.push({
            id:       `${post.id}_${ts}`,
            show:     ch.label,
            channel:  ch.id,
            episode:  title,
            teaser,
            time:     tsFormatTime(ts),
            hour,
            minute:   tsToETDate(ts).getUTCMinutes(),
            dateKey:  dk,
            date:     tsShortDate(ts),
            daypart:  getDaypart(hour),
            duration,
          });
        }
      }
    } catch (_) {}
  }

  return items.sort((a, b) =>
    a.dateKey !== b.dateKey ? a.dateKey.localeCompare(b.dateKey) :
    a.hour    !== b.hour    ? a.hour - b.hour :
    a.minute  - b.minute
  );
}

export async function fetchIssues() {
  try {
    const res  = await fetch(ISSUES_URL);
    const data = await res.json();
    const issues = data.issues || [];
    const ts = (i) => { const d = new Date(i.timestamp); return isNaN(d) ? 0 : d.getTime(); };
    return issues.sort((a, b) => ts(b) - ts(a));
  } catch (_) {
    return [];
  }
}

export async function submitIssue(issue) {
  await fetch(ISSUES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "payload=" + encodeURIComponent(JSON.stringify(issue)),
  });
}
