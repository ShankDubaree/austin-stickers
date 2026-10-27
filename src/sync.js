/**
 * Family sync via https://api.restful-api.dev (CORS open, persistent objects).
 *
 * Model:
 *   Create → POST /objects { name: "fam-CODE", data: stripLocal(state) } → remoteId
 *   Push   → PUT  /objects/{id} with same shape
 *   Pull   → GET  /objects/{id} → .data
 *   Join   → look up CODE in a secondary index object, then GET by id
 *            (GET /objects only lists sample rows 1–13, not user-created ones)
 *
 * Free public tier ~50 requests/day per client IP — poll sparingly.
 */

const SYNC_BASE = "https://api.restful-api.dev/objects";
const INDEX_NAME = "austin-stickers-fam-index";
/** Secondary code→id map (user-created objects are not in GET /objects). */
const INDEX_ID = "ff808181a09d98f701a17f1eff6b2dc8";
const POLL_MS = 25000;
const CREATE_RETRIES = 3;

function famName(code) {
  return `fam-${code}`;
}

function stripLocal(state) {
  const { familyCode, remoteId, role, ...rest } = state;
  return rest;
}

function networkError(err, fallback) {
  const msg = err && err.message ? String(err.message) : "";
  if (
    msg === "Failed to fetch" ||
    msg === "Load failed" ||
    msg === "NetworkError when attempting to fetch resource." ||
    err instanceof TypeError
  ) {
    return new Error(
      "Could not reach the sync server. Check Wi‑Fi and try again."
    );
  }
  return err instanceof Error ? err : new Error(fallback || "Sync failed");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, cache: options.cache || "no-store" });
  } catch (e) {
    throw networkError(e, "Could not reach the sync server.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text && text.length < 120
        ? `Sync error (${res.status}): ${text}`
        : `Sync error (${res.status})`
    );
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    // Some error pages still return 200-ish empty; treat as failure
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Unexpected response from sync server.");
    }
  }
  return res.json();
}

async function getIndex() {
  try {
    const doc = await fetchJson(`${SYNC_BASE}/${encodeURIComponent(INDEX_ID)}`);
    if (!doc || !doc.id) return null;
    return doc;
  } catch (e) {
    if (e.message && e.message.includes("(404)")) return null;
    throw e;
  }
}

async function putIndex(data) {
  return fetchJson(`${SYNC_BASE}/${encodeURIComponent(INDEX_ID)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: INDEX_NAME, data }),
  });
}

async function registerCode(code, objectId) {
  const index = await getIndex();
  const prev = (index && index.data) || { _v: 1 };
  const data = { ...prev, _v: prev._v || 1, [code]: objectId };
  await putIndex(data);
}

export async function createFamilyRemote(code, state) {
  const body = {
    name: famName(code),
    data: stripLocal(state),
  };
  let lastErr;
  for (let attempt = 1; attempt <= CREATE_RETRIES; attempt++) {
    try {
      const created = await fetchJson(SYNC_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!created || !created.id) {
        throw new Error("Could not create family (no id returned).");
      }
      try {
        await registerCode(code, created.id);
      } catch (regErr) {
        // Family object exists; without index, join-by-code fails — surface clearly
        throw new Error(
          "Family created but could not register the code for joining. Try again in a moment."
        );
      }
      return created.id;
    } catch (e) {
      lastErr = e;
      if (attempt < CREATE_RETRIES) {
        await sleep(300 * attempt);
        continue;
      }
    }
  }
  throw networkError(lastErr, "Could not create family. Try again.");
}

export async function findFamilyRemote(code) {
  const index = await getIndex();
  if (!index || !index.data) return null;
  const id = index.data[code];
  if (!id || typeof id !== "string") return null;
  return pullFamilyRemote(code, id);
}

export async function pushFamilyRemote(code, id, state) {
  const body = {
    name: famName(code),
    data: stripLocal(state),
  };
  await fetchJson(`${SYNC_BASE}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return true;
}

export async function pullFamilyRemote(code, id) {
  try {
    const doc = await fetchJson(`${SYNC_BASE}/${encodeURIComponent(id)}`);
    if (!doc) return null;
    const remoteState = doc.data != null ? doc.data : {};
    return { id: doc.id || id, state: remoteState };
  } catch (e) {
    if (e.message && e.message.includes("(404)")) {
      // Index may be stale — try re-resolve via code
      if (code) {
        const index = await getIndex();
        const alt = index && index.data && index.data[code];
        if (alt && alt !== id) {
          const doc = await fetchJson(`${SYNC_BASE}/${encodeURIComponent(alt)}`);
          if (doc) {
            return {
              id: doc.id || alt,
              state: doc.data != null ? doc.data : {},
            };
          }
        }
      }
      return null;
    }
    throw e;
  }
}

export function startPolling(getMeta, onRemote, onError) {
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;
    const schedule = () => {
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      schedule();
      return;
    }

    const meta = getMeta();
    if (!meta || !meta.code || !meta.id) {
      schedule();
      return;
    }
    try {
      const remote = await pullFamilyRemote(meta.code, meta.id);
      if (remote && remote.state) onRemote(remote.state, remote.id);
    } catch (e) {
      if (onError) onError(e);
    } finally {
      schedule();
    }
  }

  function onVisibility() {
    if (
      !stopped &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, 500);
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  timer = setTimeout(tick, POLL_MS);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

export { POLL_MS, SYNC_BASE, INDEX_ID };
