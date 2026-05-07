import { CHANNELS, CHANNEL_SB } from "./constants.js";
import { parseTimestamps, tsDateKey, tsShortDate, tsHour, tsFormatTime, getDaypart, tsToETDate, DATE_RANGE, dateKey } from "./utils.js";

const SB_API = "https://app.staffbase.com/api";
const SB_KEY = "NjlmYjIzODZkMjBiNGE3NzZlODJmZmNkOi5NakImMkFha05hdUMxd1F0KVR9fWYycUp7ZVljQWczLktBN1oySmpOOCQ0XTlpK35zRFJ4IV5KYi1pfmlbTUM=";

export async function fetchScheduleFromStaffbase() {
  const headers = { authorization: `Basic ${SB_KEY}`, accept: "application/json" };
  const rangeKeys = new Set(DATE_RANGE.map(dateKey));
  const items = [];

  for (const ch of CHANNELS) {
    const cfg = CHANNEL_SB[ch.id];
    try {
      const res = await fetch(`${SB_API}/channels/${cfg.sbId}/posts?limit=30`, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      for (const post of data.data || []) {
        const title = post.contents?.en_US?.title;
        if (!title || title === "Summary") continue;
        const content = post.contents?.en_US?.content || "";
        const teaser  = post.contents?.en_US?.teaser  || "";
        const timestamps = parseTimestamps(content);
        for (const ts of timestamps) {
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
            duration: cfg.duration,
          });
        }
      }
    } catch (_) {
      // non-fatal — channel simply won't appear in schedule
    }
  }

  return items.sort((a, b) =>
    a.dateKey !== b.dateKey ? a.dateKey.localeCompare(b.dateKey) :
    a.hour !== b.hour       ? a.hour - b.hour :
    a.minute - b.minute
  );
}
