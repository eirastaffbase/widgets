// Date / timezone utilities — all schedule times are Eastern (EDT = UTC-4)
export const EDT_OFFSET_S = 4 * 3600;

export function getCurrentETDate() {
  const etMs = Date.now() - EDT_OFFSET_S * 1000;
  const d = new Date(etMs);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export const TODAY = getCurrentETDate();
export const DATE_RANGE = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i));

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatShortDate(d) {
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export function formatDayNumber(d) { return d.getDate(); }
export function formatDayName(d)   { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }

export function formatFullDate(d) {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Timestamp helpers (Unix seconds → Eastern Time)
export function parseTimestamps(html) {
  if (!html) return [];
  const nums = html.match(/\b1\d{9}\b/g);
  return nums ? nums.map(Number) : [];
}

export function tsToETDate(ts) {
  return new Date((ts - EDT_OFFSET_S) * 1000);
}

export function tsDateKey(ts) {
  const d = tsToETDate(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function tsShortDate(ts) {
  const d = tsToETDate(ts);
  const days   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function tsHour(ts) { return tsToETDate(ts).getUTCHours(); }

export function tsFormatTime(ts) {
  const d = tsToETDate(ts);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? "AM" : "PM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h}${mStr} ${ampm} ET`;
}

export function getDaypart(hour) {
  if (hour >= 5  && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "daytime";
  if (hour >= 17 && hour < 23) return "primetime";
  return "overnight";
}
