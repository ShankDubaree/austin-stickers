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
  DEFAULT_PIN,
} from "./state.js";
import {
  createFamilyRemote,
  findFamilyRemote,
  pushFamilyRemote,
  startPolling,
} from "./sync.js";

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
  const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff9cee", "#a66cff"];
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

function stickerGlyph(kind) {
  if (kind === "brush") return "🪥";
  if (kind === "poop") return "⭐";
  if (kind === "homework") return "📚";
  if (kind === "sleep") return "🛏️";
  return "⭐";
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
      mode = "admin";
      startSyncLoop();
      syncStatus = "ok";
      render();
    } catch (e) {
      setupError = e.message || "Could not create family. Check the internet and try again.";
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

function kidHtml() {
  const week = ensureWeek(state, viewWeek);
  const days = daysOfWeek(viewWeek);
  const today = todayKey();
  const isCurrent = viewWeek === thisWeekKey();

  return `
  <main class="shell kid">
    <header class="topbar">
      <div>
        <p class="eyebrow">Austin's stickers</p>
        <h1>${escapeHtml(formatWeekTitle(viewWeek))}${isCurrent ? " · this week" : ""}</h1>
      </div>
      <div class="top-actions">
        <span class="pill" title="${escapeHtml(syncError)}">${escapeHtml(syncLabel())}</span>
        <button type="button" class="btn tiny ghost" id="btn-parent" aria-label="Parent unlock">Parent</button>
      </div>
    </header>

    <nav class="week-nav" aria-label="Week">
      <button type="button" class="btn" id="btn-prev">← Prev</button>
      <button type="button" class="btn" id="btn-today" ${isCurrent ? "disabled" : ""}>This week</button>
      <button type="button" class="btn" id="btn-next">Next →</button>
    </nav>

    <section class="card category">
      <h2><span class="ico">🪥</span> Brush teeth</h2>
      <p class="hint">Morning and evening — every day</p>
      <div class="grid brush-grid">
        <div class="corner"></div>
        ${days.map((d) => `<div class="day-h ${d.key === today ? "today" : ""}">${d.name}</div>`).join("")}
        <div class="slot-label">AM</div>
        ${days.map((d) => slotCell(hasBrush(week, d.key, "am"), "brush")).join("")}
        <div class="slot-label">PM</div>
        ${days.map((d) => slotCell(hasBrush(week, d.key, "pm"), "brush")).join("")}
      </div>
    </section>

    <section class="card category">
      <h2><span class="ico">🛏️</span> Sleep in own bed</h2>
      <p class="hint">One sticker each night</p>
      <div class="row-slots">
        ${days.map((d) => `
          <div class="day-col ${d.key === today ? "today" : ""}">
            <div class="day-h">${d.name}</div>
            ${slotCell(hasSleep(week, d.key), "sleep")}
          </div>`).join("")}
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
            ${school ? slotCell(hasHomework(week, d.key), "homework") : `<div class="slot empty off">—</div>`}
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="card category">
      <h2><span class="ico">⭐</span> Poop</h2>
      <p class="hint">As needed — stars when it happens</p>
      <div class="row-slots">
        ${days.map((d) => {
          const n = poopCount(week, d.key);
          return `
          <div class="day-col ${d.key === today ? "today" : ""}">
            <div class="day-h">${d.name}</div>
            <div class="slot ${n ? "filled" : "empty"}" aria-label="${n} star${n === 1 ? "" : "s"}">
              ${n ? `<span class="sticker pop">⭐</span><span class="count">${n > 1 ? "×" + n : ""}</span>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>

    <p class="foot">View only on this screen. Dad awards stickers from Parent mode on his phone.</p>
  </main>`;
}

function slotCell(filled, kind) {
  return `<div class="slot ${filled ? "filled" : "empty"}" aria-label="${filled ? "sticker" : "empty"}">
    ${filled ? `<span class="sticker">${stickerGlyph(kind)}</span>` : ""}
  </div>`;
}

function bindKid() {
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
  document.getElementById("btn-parent")?.addEventListener("click", () => {
    pinDigits = "";
    pinError = "";
    mode = "pin";
    render();
  });
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
        ${awardRow("brush-am", "🪥 Brush teeth — morning", hasBrush(week, today, "am"))}
        ${awardRow("brush-pm", "🪥 Brush teeth — evening", hasBrush(week, today, "pm"))}
        ${awardRow("sleep", "🛏️ Sleep in own bed", hasSleep(week, today))}
        ${isSchoolNight(today) ? awardRow("homework", "📚 Homework", hasHomework(week, today)) : `<p class="hint">No homework slot tonight (weekend / Friday).</p>`}
        ${poopRow(poopCount(week, today))}
      </div>
    </section>

    <section class="card">
      <h2>This week (adjust if needed)</h2>
      <div class="admin-week">
        ${days.map((d) => `
          <div class="admin-day ${d.key === today ? "today" : ""}">
            <div class="day-h">${d.label}</div>
            <button type="button" class="chip ${hasBrush(week, d.key, "am") ? "on" : ""}" data-act="toggle-brush" data-day="${d.key}" data-slot="am">AM brush</button>
            <button type="button" class="chip ${hasBrush(week, d.key, "pm") ? "on" : ""}" data-act="toggle-brush" data-day="${d.key}" data-slot="pm">PM brush</button>
            <button type="button" class="chip ${hasSleep(week, d.key) ? "on" : ""}" data-act="toggle-sleep" data-day="${d.key}">Own bed</button>
            ${isSchoolNight(d.key)
              ? `<button type="button" class="chip ${hasHomework(week, d.key) ? "on" : ""}" data-act="toggle-hw" data-day="${d.key}">Homework</button>`
              : `<span class="chip off">No HW</span>`}
            <div class="poop-mini">
              <button type="button" class="chip" data-act="poop-add" data-day="${d.key}">Poop +</button>
              <span class="mini-count">${poopCount(week, d.key) ? "⭐×" + poopCount(week, d.key) : "—"}</span>
              <button type="button" class="chip ghost" data-act="poop-undo" data-day="${d.key}" ${poopCount(week, d.key) ? "" : "disabled"}>Undo</button>
            </div>
          </div>`).join("")}
      </div>
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
      <span class="award-label">⭐ Poop ${n ? `(${n} today)` : ""}</span>
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
if (state.familyCode && state.remoteId) {
  mode = "kid";
  startSyncLoop();
  // immediate pull
  findFamilyRemote(state.familyCode)
    .then((found) => {
      if (found) {
        state.remoteId = found.id;
        state = mergeRemote(state, found.state);
        persist();
        syncStatus = "ok";
        render();
      }
    })
    .catch(() => {
      syncStatus = "error";
      render();
    });
} else {
  mode = "boot";
}
render();
