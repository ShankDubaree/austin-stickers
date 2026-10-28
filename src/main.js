import "./style.css";
import {
  daysOfWeek,
  formatWeekTitle,
  shiftIsoWeek,
  londonParts,
} from "./week.js";
import {
  loadLocal,
  saveLocal,
  emptyState,
  ensureWeek,
  hasBrush,
  setBrush,
  poopCount,
  addPoop,
  undoPoop,
  hasHomework,
  setHomework,
  hasSleep,
  setSleep,
  todayKey,
  thisWeekKey,
  randomFamilyCode,
  mergeRemote,
  isSchoolNight,
  weekStickerTotal,
  DEFAULT_PIN,
  loadFamilyCookie,
  clearFamilyCookie,
  clearLocalStorage,
  saveFamilyCookie,
} from "./state.js";
import {
  createFamilyRemote,
  findFamilyRemote,
  pushFamilyRemote,
  startPolling,
} from "./sync.js";
import {
  SPECIAL,
  WEEK_TARGET,
  creatureArt,
  creatureForSlot,
} from "./sea.js";
import {
  prizeForWeek,
  addPrize,
  clearPrizeForWeek,
  pickRandomPrize,
  prizeIndex,
  wheelCardHtml,
  animateWheelSpin,
} from "./prize.js";

const app = document.querySelector("#app");
const celebrateEl = document.querySelector("#celebrate");

let state = loadLocal();
let viewWeek = thisWeekKey();
let mode = "boot"; // boot | kid | pin | admin | setup
let pinDigits = "";
let pinError = "";
let syncStatus = "idle"; // idle | syncing | ok | error
let syncError = "";
let setupError = "";
let joinCode = "";
let stopPoll = null;
let pushTimer = null;

/** Read family code from ?family= or #family= (uppercase). */
function familyCodeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    let code = (params.get("family") || "").trim().toUpperCase();
    if (!code && window.location.hash) {
      const hash = window.location.hash.replace(/^#/, "");
      const hp = new URLSearchParams(hash.includes("=") ? hash : "");
      code = (hp.get("family") || "").trim().toUpperCase();
      if (!code) {
        const m = hash.match(/(?:^|[&#?])family=([A-Za-z0-9]+)/i);
        if (m) code = m[1].toUpperCase();
      }
    }
    return code.replace(/[^A-Z0-9]/g, "").slice(0, 8) || null;
  } catch {
    return null;
  }
}

/** Keep app on a stable URL that includes the family code (preserve base path). */
function replaceFamilyUrl(code) {
  try {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set("family", String(code).toUpperCase());
    } else {
      url.searchParams.delete("family");
    }
    // Drop hash family if present so query is the single source
    if (url.hash && /family=/i.test(url.hash)) {
      url.hash = "";
    }
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}

function persist() {
  saveLocal(state);
}

function touch() {
  state.updatedAt = Date.now();
  persist();
  queuePush();
}

function queuePush() {
  if (!state.familyCode || !state.remoteId) return;
  syncStatus = "syncing";
  render();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await pushFamilyRemote(state.familyCode, state.remoteId, state);
      syncStatus = "ok";
      syncError = "";
    } catch (e) {
      syncStatus = "error";
      syncError = e.message || "Sync failed";
    }
    render();
  }, 350);
}

function startSyncLoop() {
  if (stopPoll) stopPoll();
  stopPoll = startPolling(
    () =>
      state.familyCode && state.remoteId
        ? { code: state.familyCode, id: state.remoteId }
        : null,
    (remote) => {
      const before = state.updatedAt;
      state = mergeRemote(state, remote);
      if (state.updatedAt !== before) {
        persist();
        syncStatus = "ok";
        render();
      } else {
        syncStatus = "ok";
      }
    },
    (e) => {
      syncStatus = "error";
      syncError = e.message || "Sync error";
      render();
    }
  );
}

function celebrate() {
  celebrateEl.innerHTML = "";
  celebrateEl.className = "celebrate-on";
  const colors = ["#c41e3a", "#f4d35e", "#2d5bff", "#1c3faa", "#fff8e8", "#e09f1f"];
  for (let i = 0; i < 36; i++) {
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
  }, 1600);
}

function stickerArt(category, dateKey, slot = "", size = 40) {
  const c = creatureForSlot(category, dateKey, slot);
  return creatureArt(c, size);
}

function syncLabel() {
  if (!state.familyCode) return "Not linked";
  if (syncStatus === "syncing") return "Saving…";
  if (syncStatus === "error") return "Offline / sync issue";
  if (syncStatus === "ok") return "Synced";
  return "Family " + state.familyCode;
}

/* ---------- screens ---------- */

function render() {
  if (!state.familyCode) {
    app.innerHTML = setupHtml();
    bindSetup();
    return;
  }
  if (mode === "pin") {
    app.innerHTML = pinHtml();
    bindPin();
    return;
  }
  if (mode === "admin") {
    app.innerHTML = adminHtml();
    bindAdmin();
    return;
  }
  app.innerHTML = kidHtml();
  bindKid();
}

function setupHtml() {
  return `
  <main class="shell setup">
    <header class="hero">
      <p class="eyebrow">Austin's chart</p>
      <h1>Sticker Chart</h1>
      <p class="lede">Dad awards stickers on his phone. Austin's tablet shows them live — view only.</p>
    </header>
    <section class="card">
      <h2>Create family</h2>
      <p>Start here on Dad's iPhone. You'll get a short family code.</p>
      <button type="button" class="btn primary" id="btn-create">Create family</button>
    </section>
    <section class="card">
      <h2>Join family</h2>
      <p>On Austin's Fire tablet, enter the same code.</p>
      <label class="sr" for="join-code">Family code</label>
      <input id="join-code" class="input code" maxlength="8" autocomplete="off" spellcheck="false" placeholder="e.g. AB12CD" value="${escapeHtml(joinCode)}" />
      <button type="button" class="btn" id="btn-join">Join family</button>
    </section>
    ${setupError ? `<p class="error" role="alert">${escapeHtml(setupError)}</p>` : ""}
    <p class="hint setup-hint">After joining once, remove &amp; re-add the Fire home-screen shortcut so the link includes the family code — then the tablet won’t ask for it again.</p>
  </main>`;
}

function bindSetup() {
  const createBtn = document.getElementById("btn-create");
  const joinBtn = document.getElementById("btn-join");
  const input = document.getElementById("join-code");
  if (input) {
    input.addEventListener("input", () => {
      joinCode = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      input.value = joinCode;
    });
  }
  createBtn?.addEventListener("click", async () => {
    setupError = "";
    createBtn.disabled = true;
    createBtn.textContent = "Creating…";
    try {
      const code = randomFamilyCode();
      const fresh = { ...emptyState(), pin: DEFAULT_PIN, updatedAt: Date.now() };
      const id = await createFamilyRemote(code, fresh);
      state = { ...fresh, familyCode: code, remoteId: id };
      persist();
      saveFamilyCookie(code, id);
      replaceFamilyUrl(code);
      mode = "admin";
      startSyncLoop();
      syncStatus = "ok";
      render();
    } catch (e) {
      setupError =
        e.message === "Failed to fetch" || e.message === "Load failed"
          ? "Could not reach the sync server. Check Wi‑Fi and try again."
          : e.message || "Could not create family. Check the internet and try again.";
      createBtn.disabled = false;
      createBtn.textContent = "Create family";
      render();
    }
  });
  joinBtn?.addEventListener("click", async () => {
    setupError = "";
    const code = (joinCode || "").trim().toUpperCase();
    if (code.length < 4) {
      setupError = "Enter the family code from Dad's phone.";
      render();
      return;
    }
    joinBtn.disabled = true;
    joinBtn.textContent = "Joining…";
    try {
      const found = await findFamilyRemote(code);
      if (!found) {
        setupError = "No family found for that code. Check it and try again.";
        joinBtn.disabled = false;
        joinBtn.textContent = "Join family";
        render();
        return;
      }
      state = {
        ...emptyState(),
        ...found.state,
        familyCode: code,
        remoteId: found.id,
      };
      persist();
      saveFamilyCookie(code, found.id);
      replaceFamilyUrl(code);
      mode = "kid";
      startSyncLoop();
      syncStatus = "ok";
      render();
    } catch (e) {
      setupError = e.message || "Could not join. Check the internet and try again.";
      joinBtn.disabled = false;
      joinBtn.textContent = "Join family";
      render();
    }
  });
}

function pinHtml() {
  return `
  <main class="shell pin-screen">
    <header class="hero">
      <h1>Parent unlock</h1>
      <p class="lede">Enter the 4-digit PIN to award stickers.</p>
    </header>
    <div class="pin-dots" aria-hidden="true">${[0,1,2,3].map((i) => `<span class="${pinDigits.length > i ? "on" : ""}"></span>`).join("")}</div>
    ${pinError ? `<p class="error">${escapeHtml(pinError)}</p>` : ""}
    <div class="pad">
      ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k) =>
        k === ""
          ? `<span class="pad-gap"></span>`
          : `<button type="button" class="pad-key" data-k="${k}">${k}</button>`
      ).join("")}
    </div>
    <button type="button" class="btn ghost" id="btn-cancel-pin">Back to chart</button>
  </main>`;
}

function bindPin() {
  document.getElementById("btn-cancel-pin")?.addEventListener("click", () => {
    pinDigits = "";
    pinError = "";
    mode = "kid";
    render();
  });
  app.querySelectorAll(".pad-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-k");
      if (k === "⌫") {
        pinDigits = pinDigits.slice(0, -1);
        pinError = "";
        render();
        return;
      }
      if (pinDigits.length >= 4) return;
      pinDigits += k;
      render();
      if (pinDigits.length === 4) {
        if (pinDigits === String(state.pin || DEFAULT_PIN)) {
          pinDigits = "";
          pinError = "";
          mode = "admin";
          render();
        } else {
          pinError = "That PIN isn’t right. Try again.";
          pinDigits = "";
          render();
        }
      }
    });
  });
}


function slotCell(filled, category, dateKey, slot = "") {
  const art = filled ? stickerArt(category, dateKey, slot, 40) : "";
  return `<div class="slot ${filled ? "filled" : "empty"}" aria-label="${filled ? "sticker" : "empty"}">
    ${filled ? `<span class="sticker sea-sticker">${art}</span>` : ""}
  </div>`;
}

function poopSlotCell(n, dateKey) {
  if (!n) {
    return `<div class="slot empty" aria-label="empty"></div>`;
  }
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

function kidHtml() {
  viewWeek = thisWeekKey();
  const week = ensureWeek(state, viewWeek);
  const days = daysOfWeek(viewWeek);
  const today = todayKey();
  const total = weekStickerTotal(week);

  return `
  <main class="shell kid">
    <header class="topbar">
      <div>
        <p class="eyebrow">Austin's stickers</p>
        <h1>${escapeHtml(formatWeekTitle(viewWeek))} · this week</h1>
      </div>
      <div class="top-actions">
        <span class="pill" title="${escapeHtml(syncError)}">${escapeHtml(syncLabel())}</span>
        <button type="button" class="btn tiny ghost" id="btn-parent" aria-label="Parent unlock">Parent</button>
      </div>
    </header>

    ${pufferProgress(total)}

    ${(() => {
      const result = prizeForWeek(state, viewWeek);
      const recent = Array.isArray(state.prizes) ? state.prizes : [];
      return wheelCardHtml({
        unlocked: total >= WEEK_TARGET,
        total,
        target: WEEK_TARGET,
        weekKey: viewWeek,
        result,
        spinning: false,
        recentWins: recent,
        showSpinButton: true,
      });
    })()}

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

    <p class="foot">View only on this screen. Dad awards stickers from Parent mode on his phone.</p>
  </main>`;
}


let kidSpinning = false;

function bindKid() {
  document.getElementById("btn-parent")?.addEventListener("click", () => {
    pinDigits = "";
    pinError = "";
    mode = "pin";
    render();
  });

  document.getElementById("btn-spin")?.addEventListener("click", () => {
    if (kidSpinning) return;
    const weekKey = thisWeekKey();
    const week = ensureWeek(state, weekKey);
    if (weekStickerTotal(week) < WEEK_TARGET) return;
    if (prizeForWeek(state, weekKey)) return;
    const prize = pickRandomPrize();
    kidSpinning = true;
    // Re-render with spinning state via temporary flag in wheel — simplify: animate then commit
    const wheelEl = document.getElementById("prize-wheel");
    const btn = document.getElementById("btn-spin");
    if (btn) btn.disabled = true;
    animateWheelSpin(wheelEl, prizeIndex(prize), () => {
      addPrize(state, weekKey, prize);
      touch();
      kidSpinning = false;
      celebrate();
      render();
    });
  });
}


/** Austin's Fire-Kids short path (no query string). */
const AUSTIN_SHORT_FAMILY = "B49ZVF";
const AUSTIN_SHORT_ID = "ff808181a09d98f701a17f21db692dcd";

function tabletKidUrl() {
  const code = state.familyCode || "";
  const id = state.remoteId || "";
  // Prefer short /a for Austin — Fire Kids allowlists choke on long ?params URLs
  if (
    String(code).toUpperCase() === AUSTIN_SHORT_FAMILY &&
    String(id) === AUSTIN_SHORT_ID
  ) {
    return `${window.location.origin}/austin-stickers/a`;
  }
  const base = `${window.location.origin}/austin-stickers/kid.html`;
  const params = new URLSearchParams();
  if (code) params.set("family", code);
  if (id) params.set("id", id);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

function prizeLogAdminHtml() {
  const list = Array.isArray(state.prizes) ? state.prizes : [];
  if (!list.length) return `<p class="hint">No prizes logged yet. The wheel unlocks at ${WEEK_TARGET}/${WEEK_TARGET} stickers.</p>`;
  return `<ul class="prize-log admin-prize-log">${list
    .map(
      (w) =>
        `<li><span class="prize-week">${escapeHtml(w.week)}</span> · <strong>${escapeHtml(w.prize)}</strong></li>`
    )
    .join("")}</ul>`;
}

function adminHtml() {
  const week = ensureWeek(state, viewWeek);
  const days = daysOfWeek(viewWeek);
  const today = todayKey();
  const isCurrent = viewWeek === thisWeekKey();
  const london = londonParts();

  return `
  <main class="shell admin">
    <header class="topbar">
      <div>
        <p class="eyebrow">Parent mode</p>
        <h1>Award stickers</h1>
        <p class="lede">Family code <strong>${escapeHtml(state.familyCode || "")}</strong> · ${escapeHtml(syncLabel())}</p>
      </div>
      <button type="button" class="btn" id="btn-kid">Kid chart</button>
    </header>

    <nav class="week-nav">
      <button type="button" class="btn" id="btn-prev">← Prev</button>
      <button type="button" class="btn" id="btn-today" ${isCurrent ? "disabled" : ""}>This week</button>
      <button type="button" class="btn" id="btn-next">Next →</button>
    </nav>
    <p class="week-label">${escapeHtml(formatWeekTitle(viewWeek))}${isCurrent ? " · this week" : ""}</p>

    <section class="card">
      <h2>Today · ${london.weekday} ${london.day}/${london.month}</h2>
      <div class="award-list">
        ${awardRow("sleep", "🛏️ Sleep in own bed", hasSleep(week, today))}
        ${awardRow("brush-am", "🪥 Brush Teeth — morning", hasBrush(week, today, "am"))}
        ${awardRow("brush-pm", "🪥 Brush Teeth — evening", hasBrush(week, today, "pm"))}
        ${poopRow(poopCount(week, today))}
        ${isSchoolNight(today) ? awardRow("homework", "📚 Homework", hasHomework(week, today)) : `<p class="hint">No homework slot tonight (weekend / Friday).</p>`}
      </div>
    </section>

    <section class="card">
      <h2>This week (adjust if needed)</h2>
      <div class="admin-week">
        ${days.map((d) => `
          <div class="admin-day ${d.key === today ? "today" : ""}">
            <div class="day-h">${d.label}</div>
            <button type="button" class="chip ${hasSleep(week, d.key) ? "on" : ""}" data-act="toggle-sleep" data-day="${d.key}">Own bed</button>
            <button type="button" class="chip ${hasBrush(week, d.key, "am") ? "on" : ""}" data-act="toggle-brush" data-day="${d.key}" data-slot="am">AM brush</button>
            <button type="button" class="chip ${hasBrush(week, d.key, "pm") ? "on" : ""}" data-act="toggle-brush" data-day="${d.key}" data-slot="pm">PM brush</button>
            <div class="poop-mini">
              <button type="button" class="chip" data-act="poop-add" data-day="${d.key}">Toilet +</button>
              <span class="mini-count">${poopCount(week, d.key) ? "×" + poopCount(week, d.key) : "—"}</span>
              <button type="button" class="chip ghost" data-act="poop-undo" data-day="${d.key}" ${poopCount(week, d.key) ? "" : "disabled"}>Undo</button>
            </div>
            ${isSchoolNight(d.key)
              ? `<button type="button" class="chip ${hasHomework(week, d.key) ? "on" : ""}" data-act="toggle-hw" data-day="${d.key}">Homework</button>`
              : `<span class="chip off">No HW</span>`}
          </div>`).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Austin’s tablet link</h2>
      <p class="hint">Open this on the Fire tablet (or pin it to the home screen). View-only — no join or PIN.</p>
      <p class="tablet-link" id="tablet-link-text">${escapeHtml(tabletKidUrl())}</p>
      <button type="button" class="btn primary" id="btn-copy-tablet">Copy tablet link</button>
      <p class="hint copy-status" id="copy-status" hidden></p>
    </section>

    <section class="card">
      <h2>Prize log</h2>
      ${prizeLogAdminHtml()}
      <button type="button" class="btn ghost" id="btn-reset-spin">Reset this week’s spin</button>
      <p class="hint">Lets Austin spin again this week if needed. Does not change sticker counts.</p>
    </section>

    <section class="card">
      <h2>Settings</h2>
      <label class="field">New PIN (4 digits)
        <input id="new-pin" class="input" inputmode="numeric" maxlength="4" placeholder="••••" />
      </label>
      <button type="button" class="btn" id="btn-save-pin">Save PIN</button>
      <p class="hint">PIN is stored in the synced family data. Default was ${DEFAULT_PIN}.</p>
      <hr class="soft" />
      <p class="hint">To leave this family on this device (does not delete cloud data):</p>
      <button type="button" class="btn danger" id="btn-leave">Leave family on this device</button>
    </section>
  </main>`;
}

function awardRow(id, label, on) {
  return `
    <div class="award-row">
      <span class="award-label">${label}</span>
      <div class="award-btns">
        ${on
          ? `<button type="button" class="btn" data-award="${id}" data-mode="undo">Undo</button>
             <span class="got">Done ✓</span>`
          : `<button type="button" class="btn primary" data-award="${id}" data-mode="give">Award</button>`}
      </div>
    </div>`;
}

function poopRow(n) {
  return `
    <div class="award-row">
      <span class="award-label">Toilet ${n ? `(${n} today)` : ""}</span>
      <div class="award-btns">
        <button type="button" class="btn primary" data-award="poop" data-mode="give">Award</button>
        <button type="button" class="btn" data-award="poop" data-mode="undo" ${n ? "" : "disabled"}>Undo</button>
      </div>
    </div>`;
}

function bindAdmin() {
  document.getElementById("btn-kid")?.addEventListener("click", () => {
    mode = "kid";
    render();
  });

  document.getElementById("btn-copy-tablet")?.addEventListener("click", async () => {
    const url = tabletKidUrl();
    const status = document.getElementById("copy-status");
    try {
      await navigator.clipboard.writeText(url);
      if (status) {
        status.hidden = false;
        status.textContent = "Copied! Open this on Austin’s Fire tablet.";
      }
    } catch {
      // fallback select
      const el = document.getElementById("tablet-link-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      if (status) {
        status.hidden = false;
        status.textContent = "Select the link above and copy it.";
      }
    }
  });

  document.getElementById("btn-reset-spin")?.addEventListener("click", () => {
    const weekKey = thisWeekKey();
    if (!prizeForWeek(state, weekKey)) {
      alert("No spin logged for this week yet.");
      return;
    }
    if (!confirm("Reset this week’s prize spin so Austin can spin again?")) return;
    clearPrizeForWeek(state, weekKey);
    touch();
    render();
  });
  document.getElementById("btn-prev")?.addEventListener("click", () => {
    viewWeek = shiftIsoWeek(viewWeek, -1);
    render();
  });
  document.getElementById("btn-next")?.addEventListener("click", () => {
    viewWeek = shiftIsoWeek(viewWeek, 1);
    render();
  });
  document.getElementById("btn-today")?.addEventListener("click", () => {
    viewWeek = thisWeekKey();
    render();
  });

  const week = () => ensureWeek(state, viewWeek);
  const today = todayKey();

  app.querySelectorAll("[data-award]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-award");
      const give = btn.getAttribute("data-mode") === "give";
      const w = week();
      let did = false;
      if (id === "brush-am") { setBrush(w, today, "am", give); did = give; }
      else if (id === "brush-pm") { setBrush(w, today, "pm", give); did = give; }
      else if (id === "sleep") { setSleep(w, today, give); did = give; }
      else if (id === "homework") { setHomework(w, today, give); did = give; }
      else if (id === "poop") {
        if (give) { addPoop(w, today); did = true; }
        else undoPoop(w, today);
      }
      touch();
      if (did) celebrate();
      render();
    });
  });

  app.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const day = btn.getAttribute("data-day");
      const w = week();
      let did = false;
      if (act === "toggle-brush") {
        const slot = btn.getAttribute("data-slot");
        const on = !hasBrush(w, day, slot);
        setBrush(w, day, slot, on);
        did = on;
      } else if (act === "toggle-sleep") {
        const on = !hasSleep(w, day);
        setSleep(w, day, on);
        did = on;
      } else if (act === "toggle-hw") {
        const on = !hasHomework(w, day);
        setHomework(w, day, on);
        did = on;
      } else if (act === "poop-add") {
        addPoop(w, day);
        did = true;
      } else if (act === "poop-undo") {
        undoPoop(w, day);
      }
      touch();
      if (did) celebrate();
      render();
    });
  });

  document.getElementById("btn-save-pin")?.addEventListener("click", () => {
    const input = document.getElementById("new-pin");
    const val = (input?.value || "").replace(/\D/g, "");
    if (val.length !== 4) {
      alert("Please enter exactly 4 digits.");
      return;
    }
    state.pin = val;
    touch();
    alert("PIN saved. Use it next time you open Parent mode.");
    input.value = "";
  });

  document.getElementById("btn-leave")?.addEventListener("click", () => {
    if (!confirm("Leave this family on this device? Stickers stay in the cloud for other devices.")) return;
    if (stopPoll) stopPoll();
    state = emptyState();
    clearLocalStorage();
    clearFamilyCookie();
    replaceFamilyUrl(null);
    persist();
    mode = "boot";
    joinCode = "";
    render();
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* boot */
async function joinFromCode(code, preferKid = true) {
  const found = await findFamilyRemote(code);
  if (!found) {
    throw new Error("No family found for that code. Check it and try again.");
  }
  const keepAdmin =
    !preferKid &&
    state.familyCode === code &&
    mode === "admin";
  state = {
    ...emptyState(),
    ...found.state,
    familyCode: code,
    remoteId: found.id,
  };
  persist();
  saveFamilyCookie(code, found.id);
  replaceFamilyUrl(code);
  mode = keepAdmin ? "admin" : "kid";
  startSyncLoop();
  syncStatus = "ok";
  return found;
}

function enterExistingFamily(code) {
  replaceFamilyUrl(code);
  mode = "kid";
  startSyncLoop();
  findFamilyRemote(code)
    .then((found) => {
      if (found) {
        state.remoteId = found.id;
        state = mergeRemote(state, found.state);
        persist();
        saveFamilyCookie(code, found.id);
        syncStatus = "ok";
        render();
      }
    })
    .catch(() => {
      syncStatus = "error";
      render();
    });
}

async function boot() {
  const urlCode = familyCodeFromUrl();
  const cookie = loadFamilyCookie();

  // Prefer URL code (home-screen shortcut is source of truth on tablet)
  if (urlCode) {
    if (state.familyCode === urlCode && state.remoteId) {
      enterExistingFamily(urlCode);
      render();
      return;
    }
    // missing / mismatched local → prefer URL; clear local so a failed lookup shows setup
    if (state.familyCode && state.familyCode !== urlCode) {
      state = emptyState();
      clearLocalStorage();
      clearFamilyCookie();
    }
    mode = "boot";
    setupError = "";
    joinCode = urlCode;
    render();
    try {
      await joinFromCode(urlCode, true);
      render();
    } catch (e) {
      setupError = e.message || "Could not join from the link. Check Wi‑Fi and try again.";
      mode = "boot";
      render();
    }
    return;
  }

  // No URL code: restore from cookie if localStorage empty/missing family
  if ((!state.familyCode || !state.remoteId) && cookie && cookie.familyCode) {
    mode = "boot";
    joinCode = cookie.familyCode;
    render();
    try {
      await joinFromCode(cookie.familyCode, true);
      render();
    } catch (e) {
      setupError = e.message || "Could not restore family. Enter the code once more.";
      mode = "boot";
      render();
    }
    return;
  }

  if (state.familyCode && state.remoteId) {
    replaceFamilyUrl(state.familyCode);
    enterExistingFamily(state.familyCode);
    render();
    return;
  }

  mode = "boot";
  render();
}

boot();
