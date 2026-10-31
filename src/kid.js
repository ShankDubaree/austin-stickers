/**
 * Dedicated Fire-tablet entry: view-only chart + prize wheel.
 * Never shows Create / Join / PIN / admin. Never pushes awards.
 * Prize spins may push (log only).
 */
import "./style.css";
import {
  daysOfWeek,
  formatWeekTitle,
} from "./week.js";
import {
  emptyState,
  ensureWeek,
  hasBrush,
  poopCount,
  hasHomework,
  hasSleep,
  todayKey,
  thisWeekKey,
  mergeRemote,
  isSchoolNight,
  weekStickerTotal,
  cacheFamilyState,
  loadCachedFamily,
} from "./state.js";
import {
  findFamilyRemote,
  pullByRemoteId,
  pushFamilyRemote,
  startPolling,
  KID_POLL_MS,
} from "./sync.js";
import {
  SPECIAL,
  WEEK_TARGET,
  creatureArt,
  creatureForSlot,
} from "./sea.js";
import {
  PRIZES,
  prizeForWeek,
  addPrize,
  pickRandomPrize,
  prizeIndex,
  mergePrizes,
  wheelCardHtml,
  animateWheelSpin,
} from "./prize.js";

const app = document.querySelector("#app");
const celebrateEl = document.querySelector("#celebrate");

let state = emptyState();
let syncStatus = "idle";
let syncError = "";
let bootError = "";
let stopPoll = null;
let spinning = false;
let lastSpinPrize = null;
let retryTimer = null;
let retryDelay = 0;

/* ---- Pending spin persistence (localStorage + cookie fallback) ---- */
const PENDING_KEY = "austin-stickers-spin";
function readPending() {
  let raw = null;
  try { raw = localStorage.getItem(PENDING_KEY); } catch { /* ignore */ }
  if (!raw) {
    try {
      const m = String(document.cookie || "").match(/(?:^|;\s*)austin-spin=([^;]*)/);
      if (m) raw = decodeURIComponent(m[1]);
    } catch { /* ignore */ }
  }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return p && p.week && p.prize ? p : null;
  } catch { return null; }
}
function writePending(p) {
  const raw = JSON.stringify(p);
  try { localStorage.setItem(PENDING_KEY, raw); } catch { /* ignore */ }
  try {
    document.cookie = `austin-spin=${encodeURIComponent(raw)}; Path=/austin-stickers/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax`;
  } catch { /* ignore */ }
}
function clearPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  try { document.cookie = "austin-spin=; Path=/austin-stickers/; Max-Age=0; SameSite=Lax"; } catch { /* ignore */ }
}
/** Fold a locally-saved spin into state so the wheel stays locked. */
function applyPending() {
  const p = readPending();
  if (!p) return null;
  if (p.week !== thisWeekKey()) {
    // old week: keep only until it's confirmed remotely
  }
  const resets = state.prizeResets || {};
  if (resets[p.week] && resets[p.week] >= Date.parse(p.at)) {
    clearPending(); // Dad reset after this spin
    return null;
  }
  state.prizes = mergePrizes(state.prizes, [p], resets);
  return p;
}
function remoteHasPending(remote, p) {
  const list = (remote && Array.isArray(remote.prizes)) ? remote.prizes : [];
  return list.some((x) => x && x.week === p.week && x.prize === p.prize);
}

function qs() {
  try {
    return new URLSearchParams(window.location.search || "");
  } catch {
    return new URLSearchParams();
  }
}

/** Hardcoded Austin short-link fallback when served from /a (no query). */
const AUSTIN_SHORT = {
  family: "B49ZVF",
  id: "ff808181a09d98f701a17f21db692dcd",
};

function bakedDefaults() {
  try {
    if (window.__AUSTIN_KID_DEFAULTS__) return window.__AUSTIN_KID_DEFAULTS__;
  } catch {
    /* ignore */
  }
  try {
    const path = window.location.pathname || "";
    if (/\/austin-stickers\/a\/?$/.test(path) || /\/a\/index\.html$/.test(path)) {
      return AUSTIN_SHORT;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function familyFromUrl() {
  const code = (qs().get("family") || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code) return code.slice(0, 8);
  const baked = bakedDefaults();
  const fromBaked = (baked && baked.family ? String(baked.family) : "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return fromBaked.slice(0, 8) || null;
}

function idFromUrl() {
  const id = (qs().get("id") || "").trim();
  if (id) return id;
  const baked = bakedDefaults();
  const fromBaked = baked && baked.id ? String(baked.id).trim() : "";
  return fromBaked || null;
}

function celebrate() {
  celebrateEl.innerHTML = "";
  celebrateEl.className = "celebrate-on";
  const colors = ["#c41e3a", "#f4d35e", "#2d5bff", "#1c3faa", "#fff8e8", "#e09f1f"];
  for (let i = 0; i < 40; i++) {
    const bit = document.createElement("span");
    bit.className = "confetti";
    bit.style.left = Math.random() * 100 + "%";
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = Math.random() * 0.35 + "s";
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    celebrateEl.appendChild(bit);
  }
  setTimeout(() => {
    celebrateEl.className = "";
    celebrateEl.innerHTML = "";
  }, 1800);
}

function stickerArt(category, dateKey, slot = "", size = 40) {
  return creatureArt(creatureForSlot(category, dateKey, slot), size);
}

function slotCell(filled, category, dateKey, slot = "") {
  const art = filled ? stickerArt(category, dateKey, slot, 40) : "";
  return `<div class="slot ${filled ? "filled" : "empty"}" aria-label="${filled ? "sticker" : "empty"}">
    ${filled ? `<span class="sticker sea-sticker">${art}</span>` : ""}
  </div>`;
}

function poopSlotCell(n, dateKey) {
  if (!n) return `<div class="slot empty" aria-label="empty"></div>`;
  const art = stickerArt("poop", dateKey, "1", 40);
  const count = n > 1 ? `<span class="count">×${n}</span>` : "";
  return `<div class="slot filled" aria-label="${n} sticker${n === 1 ? "" : "s"}">
    <span class="sticker sea-sticker pop">${art}</span>${count}
  </div>`;
}

function pufferProgress(total) {
  const art = creatureArt(SPECIAL, 120);
  return `
    <section class="card puffer-card" aria-label="Weekly sticker progress">
      <div class="puffer-wrap">
        <div class="puffer-fish">${art}</div>
        <div class="puffer-score">
          <p class="puffer-label">This week</p>
          <p class="puffer-nums"><span class="puffer-have">${total}</span> / <span class="puffer-goal">${WEEK_TARGET}</span></p>
          <p class="puffer-target">Target ${WEEK_TARGET} stickers</p>
        </div>
      </div>
    </section>`;
}

function syncLabel() {
  if (!state.familyCode) return "Not linked";
  if (syncStatus === "syncing") return "Updating…";
  if (syncStatus === "error") return "Offline / cached";
  if (syncStatus === "ok") return "Synced";
  return "Family " + state.familyCode;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyRemote(remote, id) {
  const before = state.updatedAt;
  state = mergeRemote(state, remote);
  if (id) state.remoteId = id;
  const p = applyPending();
  if (p) {
    if (remoteHasPending(remote, p)) clearPending();
    else schedulePush(true);
  }
  if (state.familyCode) cacheFamilyState(state.familyCode, state);
  if (state.updatedAt !== before || id) {
    syncStatus = "ok";
    syncError = "";
    render();
  } else {
    syncStatus = "ok";
  }
}

function startSync() {
  if (stopPoll) stopPoll();
  stopPoll = startPolling(
    () =>
      state.remoteId
        ? { code: state.familyCode || "", id: state.remoteId }
        : null,
    (remote, id) => applyRemote(remote, id),
    (e) => {
      syncStatus = "error";
      syncError = e.message || "Sync error";
      render();
    },
    { intervalMs: KID_POLL_MS, immediate: true }
  );
}

function schedulePush(soon) {
  if (retryTimer) return;
  const wait = soon ? 300 : retryDelay;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    pushPrizeOnly();
  }, wait);
}

async function pushPrizeOnly() {
  if (!state.familyCode || !state.remoteId) return;
  const p = readPending();
  try {
    syncStatus = "syncing";
    render();
    // Pull first so we only add the prize log on top of Dad's latest stickers.
    const fresh = await pullByRemoteId(state.remoteId);
    if (fresh && fresh.state) state = { ...mergeRemote(state, fresh.state), remoteId: state.remoteId };
    applyPending();
    if (!p || !fresh || !remoteHasPending(fresh.state, p)) {
      const base = fresh && fresh.state ? fresh.state : state;
      await pushFamilyRemote(state.familyCode, state.remoteId, {
        ...base,
        prizes: state.prizes,
        prizeResets: state.prizeResets || base.prizeResets || {},
      });
    }
    clearPending();
    retryDelay = 0;
    cacheFamilyState(state.familyCode, state);
    syncStatus = "ok";
    syncError = "";
  } catch (e) {
    syncStatus = "error";
    syncError = (e.message || "Could not save prize") + " — will retry";
    retryDelay = Math.min(retryDelay ? retryDelay * 2 : 10000, 10 * 60 * 1000);
    schedulePush(false);
  }
  render();
}

function render() {
  if (bootError && !state.familyCode) {
    app.innerHTML = `
    <main class="shell kid">
      <header class="hero">
        <p class="eyebrow">Austin's tablet</p>
        <h1>Can't load chart</h1>
        <p class="lede">${escapeHtml(bootError)}</p>
        <p class="hint">Ask Dad to open Parent mode and copy “Austin’s tablet link”, then open that link on this tablet.</p>
      </header>
    </main>`;
    return;
  }

  const viewWeek = thisWeekKey();
  const week = ensureWeek(state, viewWeek);
  const days = daysOfWeek(viewWeek);
  const today = todayKey();
  const total = weekStickerTotal(week);
  const unlocked = total >= WEEK_TARGET;
  const result = prizeForWeek(state, viewWeek);
  const recent = Array.isArray(state.prizes) ? state.prizes : [];

  app.innerHTML = `
  <main class="shell kid kid-only">
    <header class="topbar">
      <div>
        <p class="eyebrow">Austin's stickers</p>
        <h1>${escapeHtml(formatWeekTitle(viewWeek))} · this week</h1>
      </div>
      <div class="top-actions">
        <span class="pill" title="${escapeHtml(syncError)}">${escapeHtml(syncLabel())}</span>
      </div>
    </header>

    ${pufferProgress(total)}

    ${wheelCardHtml({
      unlocked,
      total,
      target: WEEK_TARGET,
      weekKey: viewWeek,
      result: result || (lastSpinPrize ? { prize: lastSpinPrize, week: viewWeek } : null),
      spinning,
      recentWins: recent,
      showSpinButton: true,
    })}

    <section class="card category">
      <h2><span class="ico">🛏️</span> Sleep in own bed</h2>
      <p class="hint">One sticker each night</p>
      <div class="row-slots">
        ${days.map((d) => `
          <div class="day-col ${d.key === today ? "today" : ""}">
            <div class="day-h">${d.name}</div>
            ${slotCell(hasSleep(week, d.key), "sleep", d.key)}
          </div>`).join("")}
      </div>
    </section>

    <section class="card category">
      <h2><span class="ico">🪥</span> Brush Teeth</h2>
      <p class="hint">Morning and evening — every day</p>
      <div class="grid brush-grid">
        <div class="corner"></div>
        ${days.map((d) => `<div class="day-h ${d.key === today ? "today" : ""}">${d.name}</div>`).join("")}
        <div class="slot-label">AM</div>
        ${days.map((d) => slotCell(hasBrush(week, d.key, "am"), "brush", d.key, "am")).join("")}
        <div class="slot-label">PM</div>
        ${days.map((d) => slotCell(hasBrush(week, d.key, "pm"), "brush", d.key, "pm")).join("")}
      </div>
    </section>

    <section class="card category">
      <h2><span class="ico">🚽</span> Toilet</h2>
      <p class="hint">As needed — a sea creature when it happens</p>
      <div class="row-slots">
        ${days.map((d) => {
          const n = poopCount(week, d.key);
          return `
          <div class="day-col ${d.key === today ? "today" : ""}">
            <div class="day-h">${d.name}</div>
            ${poopSlotCell(n, d.key)}
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="card category">
      <h2><span class="ico">📚</span> Homework</h2>
      <p class="hint">School nights — Monday to Thursday</p>
      <div class="row-slots">
        ${days.map((d) => {
          const school = isSchoolNight(d.key);
          return `
          <div class="day-col ${d.key === today ? "today" : ""} ${school ? "" : "muted"}">
            <div class="day-h">${d.name}</div>
            ${school ? slotCell(hasHomework(week, d.key), "homework", d.key) : `<div class="slot empty off">—</div>`}
          </div>`;
        }).join("")}
      </div>
    </section>

    <p class="foot">View only — Dad awards stickers on his phone. This page stays synced.</p>
  </main>`;

  bindWheel();
}

function bindWheel() {
  const btn = document.getElementById("btn-spin");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (spinning) return;
    const viewWeek = thisWeekKey();
    const week = ensureWeek(state, viewWeek);
    if (weekStickerTotal(week) < WEEK_TARGET) return;
    if (prizeForWeek(state, viewWeek)) return;

    const prize = pickRandomPrize();
    lastSpinPrize = prize;
    spinning = true;
    // Lock + persist BEFORE the animation so a reload/crash can't re-spin.
    const at = new Date().toISOString();
    writePending({ week: viewWeek, prize, at });
    addPrize(state, viewWeek, prize);
    state.prizes = state.prizes.map((x) => (x.week === viewWeek ? { ...x, at } : x));
    cacheFamilyState(state.familyCode, state);
    render();

    const wheelEl = document.getElementById("prize-wheel");
    animateWheelSpin(wheelEl, prizeIndex(prize), async () => {
      spinning = false;
      celebrate();
      await pushPrizeOnly();
      lastSpinPrize = null;
      render();
    });
  });
}

async function boot() {
  const code = familyFromUrl();
  const id = idFromUrl();

  if (!code && !id) {
    bootError =
      "This tablet link needs a family code. Open the full link Dad copied (it includes ?family=…).";
    render();
    return;
  }

  // Prefer cached chart immediately so Fire WebView isn't blank while network runs
  if (code) {
    const cached = loadCachedFamily(code);
    if (cached) {
      state = { ...cached, familyCode: code, remoteId: id || cached.remoteId };
      applyPending();
      syncStatus = "ok";
      render();
    } else {
      state = { ...emptyState(), familyCode: code, remoteId: id };
      app.innerHTML = `
      <main class="shell kid">
        <header class="hero">
          <p class="eyebrow">Austin's tablet</p>
          <h1>Loading stickers…</h1>
          <p class="lede">Fetching the chart for family ${escapeHtml(code)}.</p>
        </header>
      </main>`;
    }
  }

  try {
    let found = null;
    if (id) {
      found = await pullByRemoteId(id);
      if (found && code) {
        state.familyCode = code;
      } else if (found && !code) {
        // id-only: keep whatever family we had / leave null
        state.familyCode = state.familyCode || "FAMILY";
      }
    }
    if (!found && code) {
      found = await findFamilyRemote(code);
    }
    if (!found) {
      if (!state.weeks || !Object.keys(state.weeks).length) {
        bootError =
          "Could not load the family chart. Check Wi‑Fi, or ask Dad for a fresh tablet link with family + id.";
        syncStatus = "error";
        render();
        return;
      }
      // have cache — stay on it
      syncStatus = "error";
      syncError = "Showing last saved chart (offline).";
      startSync();
      render();
      return;
    }

    state = {
      ...emptyState(),
      ...found.state,
      familyCode: code || state.familyCode,
      remoteId: found.id || id,
      prizes: mergePrizes(
        Array.isArray(found.state?.prizes) ? found.state.prizes : [],
        [],
        found.state?.prizeResets
      ),
    };
    {
      const p = applyPending();
      if (p && !remoteHasPending(found.state, p)) schedulePush(true);
      else if (p) clearPending();
    }
    cacheFamilyState(state.familyCode, state);
    syncStatus = "ok";
    bootError = "";
    startSync();
    render();
  } catch (e) {
    if (state.familyCode && state.weeks && Object.keys(state.weeks).length) {
      syncStatus = "error";
      syncError = e.message || "Offline — showing last saved chart.";
      startSync();
      render();
      return;
    }
    bootError = e.message || "Could not load the chart. Check Wi‑Fi and try again.";
    syncStatus = "error";
    render();
  }
}

boot();
