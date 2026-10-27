import { isoWeekKey, londonDateKey, isSchoolNight } from "./week.js";

const STORAGE_KEY = "austin-stickers-v1";
const COOKIE_NAME = "austin-stickers-fam";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // ~1 year
const COOKIE_PATH = "/austin-stickers/";

export const DEFAULT_PIN = "1234";

export function emptyState() {
  return {
    v: 1,
    pin: DEFAULT_PIN,
    updatedAt: Date.now(),
    weeks: {},
    muteSound: true,
    // local-only fields persisted in localStorage too:
    familyCode: null,
    remoteId: null,
  };
}

function readCookie(name) {
  try {
    const parts = String(document.cookie || "").split(";");
    for (const part of parts) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      if (k !== name) continue;
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCookie(name, value, maxAge) {
  try {
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; Path=${COOKIE_PATH}; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function clearCookie(name) {
  try {
    document.cookie = `${name}=; Path=${COOKIE_PATH}; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** Persist familyCode (+ remoteId when known) in a first-party cookie backup. */
export function saveFamilyCookie(familyCode, remoteId) {
  if (!familyCode) {
    clearCookie(COOKIE_NAME);
    return;
  }
  const payload = { familyCode: String(familyCode).toUpperCase() };
  if (remoteId) payload.remoteId = String(remoteId);
  writeCookie(COOKIE_NAME, JSON.stringify(payload), COOKIE_MAX_AGE);
}

export function loadFamilyCookie() {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const code = parsed && parsed.familyCode
      ? String(parsed.familyCode).toUpperCase().replace(/[^A-Z0-9]/g, "")
      : "";
    if (!code) return null;
    return {
      familyCode: code,
      remoteId: parsed.remoteId ? String(parsed.remoteId) : null,
    };
  } catch {
    // legacy plain-code cookie
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
    return code ? { familyCode: code, remoteId: null } : null;
  }
}

export function clearFamilyCookie() {
  clearCookie(COOKIE_NAME);
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed, weeks: parsed.weeks || {} };
  } catch {
    return emptyState();
  }
}

export function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / security errors — keep session in memory; cookie still backs family
  }
  if (state && state.familyCode) {
    saveFamilyCookie(state.familyCode, state.remoteId);
  }
}

export function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeRemote(local, remote) {
  // Last-write-wins on updatedAt; keep local familyCode/remoteId
  if (!remote) return local;
  if ((remote.updatedAt || 0) >= (local.updatedAt || 0)) {
    return {
      ...local,
      pin: remote.pin || local.pin,
      weeks: remote.weeks || {},
      muteSound: remote.muteSound ?? local.muteSound,
      updatedAt: remote.updatedAt || local.updatedAt,
    };
  }
  return local;
}

export function ensureWeek(state, weekKey) {
  if (!state.weeks[weekKey]) {
    state.weeks[weekKey] = { brush: {}, poop: {}, homework: {}, sleep: {} };
  } else {
    const w = state.weeks[weekKey];
    w.brush = w.brush || {};
    w.poop = w.poop || {};
    w.homework = w.homework || {};
    w.sleep = w.sleep || {};
  }
  return state.weeks[weekKey];
}

/** Brush slot: am | pm */
export function hasBrush(week, dateKey, slot) {
  return !!(week.brush[dateKey] && week.brush[dateKey][slot]);
}

export function setBrush(week, dateKey, slot, on) {
  week.brush[dateKey] = week.brush[dateKey] || {};
  if (on) week.brush[dateKey][slot] = true;
  else {
    delete week.brush[dateKey][slot];
    if (!Object.keys(week.brush[dateKey]).length) delete week.brush[dateKey];
  }
}

export function poopCount(week, dateKey) {
  return (week.poop[dateKey] && week.poop[dateKey].count) || 0;
}

export function addPoop(week, dateKey) {
  const n = poopCount(week, dateKey) + 1;
  week.poop[dateKey] = { count: n };
  return n;
}

export function undoPoop(week, dateKey) {
  const n = Math.max(0, poopCount(week, dateKey) - 1);
  if (n === 0) delete week.poop[dateKey];
  else week.poop[dateKey] = { count: n };
  return n;
}

export function hasHomework(week, dateKey) {
  return !!week.homework[dateKey];
}

export function setHomework(week, dateKey, on) {
  if (on) week.homework[dateKey] = true;
  else delete week.homework[dateKey];
}

export function hasSleep(week, dateKey) {
  return !!week.sleep[dateKey];
}

export function setSleep(week, dateKey, on) {
  if (on) week.sleep[dateKey] = true;
  else delete week.sleep[dateKey];
}

export function todayKey() {
  return londonDateKey(new Date());
}

export function thisWeekKey() {
  return isoWeekKey(new Date());
}

export function randomFamilyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  let out = "";
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export { isSchoolNight };

/** Count every awarded sticker slot this week (brush AM/PM, sleep, homework, each poop). */
export function weekStickerTotal(week) {
  if (!week) return 0;
  let n = 0;
  for (const day of Object.values(week.brush || {})) {
    if (day?.am) n += 1;
    if (day?.pm) n += 1;
  }
  for (const day of Object.values(week.sleep || {})) {
    if (day) n += 1;
  }
  for (const day of Object.values(week.homework || {})) {
    if (day) n += 1;
  }
  for (const entry of Object.values(week.poop || {})) {
    n += (entry && entry.count) || 0;
  }
  return n;
}
