/** Prize wheel: 5 equal-odds prizes unlocked at WEEK_TARGET stickers. */

export const PRIZES = [
  "Robux",
  "V-Bucks",
  "McDonald's",
  "£5 Cash",
  "Zoo Trip",
];

export function prizeForWeek(state, weekKey) {
  const list = Array.isArray(state?.prizes) ? state.prizes : [];
  return list.find((p) => p && p.week === weekKey) || null;
}

export function addPrize(state, weekKey, prize) {
  const list = Array.isArray(state.prizes) ? [...state.prizes] : [];
  const filtered = list.filter((p) => p && p.week !== weekKey);
  filtered.push({ week: weekKey, prize, at: Date.now() });
  // Keep newest first, cap log length
  filtered.sort((a, b) => (b.at || 0) - (a.at || 0));
  state.prizes = filtered.slice(0, 52);
  return state.prizes[0];
}

export function clearPrizeForWeek(state, weekKey) {
  const list = Array.isArray(state.prizes) ? state.prizes : [];
  state.prizes = list.filter((p) => !p || p.week !== weekKey);
  return state.prizes;
}

export function pickRandomPrize() {
  const i = Math.floor(Math.random() * PRIZES.length);
  return PRIZES[i];
}

/** Index of a prize label in PRIZES (for wheel rotation). */
export function prizeIndex(label) {
  const i = PRIZES.indexOf(label);
  return i >= 0 ? i : 0;
}

/**
 * Wheel HTML: 5 equal segments. When result is set, show locked celebration.
 * spinning / result drive CSS classes from the caller.
 */
export function wheelCardHtml({
  unlocked,
  total,
  target,
  weekKey,
  result,
  spinning,
  recentWins,
  showSpinButton,
}) {
  const need = Math.max(0, target - total);
  if (!unlocked) {
    return `
    <section class="card wheel-card locked" aria-label="Prize wheel locked">
      <h2><span class="ico">🎡</span> Prize wheel</h2>
      <p class="hint">Earn <strong>${need}</strong> more sticker${need === 1 ? "" : "s"} this week to unlock the spin (${total}/${target}).</p>
      <div class="wheel-lock" aria-hidden="true">🔒</div>
    </section>`;
  }

  const segDeg = 360 / PRIZES.length;
  const segments = PRIZES.map((label, i) => {
    const start = i * segDeg;
    return `<li class="wheel-seg" style="--i:${i};--start:${start}deg;--seg:${segDeg}deg" data-prize="${escapeAttr(label)}"><span>${escapeHtml(label)}</span></li>`;
  }).join("");

  let status = "";
  if (result) {
    status = `<p class="wheel-result" role="status">You won: <strong>${escapeHtml(result.prize)}</strong>!</p>`;
  } else if (spinning) {
    status = `<p class="wheel-result spinning-msg" role="status">Spinning…</p>`;
  } else {
    status = `<p class="hint">You hit ${target}/${target} — spin for a prize!</p>`;
  }

  const btn =
    showSpinButton && !result && !spinning
      ? `<button type="button" class="btn primary wheel-spin-btn" id="btn-spin">Spin the prize wheel</button>`
      : result
        ? `<p class="hint">This week’s prize is locked. Ask Dad if you need a re-spin.</p>`
        : "";

  const wins = (recentWins || []).slice(0, 5);
  const winsHtml = wins.length
    ? `<ul class="prize-log">${wins
        .map(
          (w) =>
            `<li><span class="prize-week">${escapeHtml(w.week)}</span> · <strong>${escapeHtml(w.prize)}</strong></li>`
        )
        .join("")}</ul>`
    : `<p class="hint">No prizes logged yet.</p>`;

  return `
  <section class="card wheel-card ${result ? "won" : ""} ${spinning ? "is-spinning" : ""}" aria-label="Prize wheel">
    <h2><span class="ico">🎡</span> Spin the prize wheel</h2>
    ${status}
    <div class="wheel-stage">
      <div class="wheel-pointer" aria-hidden="true"></div>
      <div class="wheel ${spinning ? "spinning" : ""}" id="prize-wheel" data-week="${escapeAttr(weekKey)}" ${result ? `data-landed="${prizeIndex(result.prize)}"` : ""}>
        <ul class="wheel-segs">${segments}</ul>
        <div class="wheel-hub" aria-hidden="true">★</div>
      </div>
    </div>
    ${btn}
    <div class="prize-log-wrap">
      <h3 class="prize-log-title">Recent wins</h3>
      ${winsHtml}
    </div>
  </section>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/**
 * Animate wheel to land on prizeIndex, then call onDone.
 * Uses CSS custom property --spin-end.
 */
export function animateWheelSpin(wheelEl, landIndex, onDone) {
  if (!wheelEl) {
    onDone();
    return;
  }
  const n = PRIZES.length;
  const seg = 360 / n;
  // Pointer at top; segment i centre is at i*seg + seg/2 from 0.
  // Rotate so that centre lands under the top pointer.
  const centre = landIndex * seg + seg / 2;
  const extraTurns = 4 + Math.floor(Math.random() * 2); // 4–5 full turns
  const end = extraTurns * 360 + (360 - centre);
  wheelEl.style.setProperty("--spin-end", `${end}deg`);
  wheelEl.classList.remove("spinning");
  // force reflow
  void wheelEl.offsetWidth;
  wheelEl.classList.add("spinning");
  const ms = 4200;
  setTimeout(() => {
    wheelEl.classList.remove("spinning");
    wheelEl.style.transform = `rotate(${end}deg)`;
    onDone();
  }, ms);
}
