/** ISO week helpers using Europe/London wall clock. */

const TZ = "Europe/London";

export function londonParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday, // Mon, Tue, ...
    hour: Number(map.hour),
  };
}

/** Monday-based date key YYYY-MM-DD in London. */
export function londonDateKey(date = new Date()) {
  const p = londonParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** ISO week key like 2026-W44 (ISO week-year may differ near year edges). */
export function isoWeekKey(date = new Date()) {
  const p = londonParts(date);
  // Build a UTC date at London Y-M-D noon to avoid DST edges
  const utc = new Date(Date.UTC(p.year, p.month - 1, p.day, 12));
  // ISO: Thursday-based week year
  const day = utc.getUTCDay() || 7; // Mon=1 ... Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  const isoYear = utc.getUTCFullYear();
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Monday date (YYYY-MM-DD London) for an ISO week key. */
export function mondayOfIsoWeek(weekKey) {
  const [ys, ws] = weekKey.split("-W");
  const isoYear = Number(ys);
  const week = Number(ws);
  // ISO week 1 is the week with Jan 4th
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function shiftIsoWeek(weekKey, delta) {
  const mon = mondayOfIsoWeek(weekKey);
  const shifted = addDaysKey(mon, delta * 7);
  const [y, m, d] = shifted.split("-").map(Number);
  return isoWeekKey(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function daysOfWeek(weekKey) {
  const mon = mondayOfIsoWeek(weekKey);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((name, i) => {
    const key = addDaysKey(mon, i);
    const [, m, d] = key.split("-");
    return { key, name, label: `${name} ${Number(d)}/${Number(m)}` };
  });
}

export function formatWeekTitle(weekKey) {
  const days = daysOfWeek(weekKey);
  const first = days[0];
  const last = days[6];
  const [, fm, fd] = first.key.split("-");
  const [, lm, ld] = last.key.split("-");
  return `Week of ${Number(fd)}/${Number(fm)} – ${Number(ld)}/${Number(lm)}`;
}

export function isSchoolNight(dateKey) {
  // Mon–Thu (indexes 0–3 from Monday)
  const mon = mondayOfIsoWeek(isoWeekKey(new Date(
    Date.UTC(...dateKey.split("-").map(Number).map((n, i) => (i === 1 ? n - 1 : n)), 12)
  )));
  // simpler: parse day of week from dateKey
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = dt.getUTCDay(); // 0 Sun .. 6 Sat
  return dow >= 1 && dow <= 4;
}

export { TZ };
