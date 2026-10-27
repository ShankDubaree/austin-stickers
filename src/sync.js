/**
 * Family sync via crudcrud.com (free JSON REST, CORS open).
 * Family code → resource /fam-{CODE}. Poll every few seconds.
 * Endpoint expires after ~24h of total inactivity — daily use keeps it alive.
 */

const SYNC_BASE = "https://crudcrud.com/api/0858aa4afb2e4990a258763d23106037";
const POLL_MS = 4000;

function famUrl(code) {
  return `${SYNC_BASE}/fam-${encodeURIComponent(code)}`;
}

function docUrl(code, id) {
  return `${famUrl(code)}/${encodeURIComponent(id)}`;
}

export async function createFamilyRemote(code, state) {
  const body = stripLocal(state);
  const res = await fetch(famUrl(code), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Could not create family (" + res.status + ")");
  const data = await res.json();
  return data._id;
}

export async function findFamilyRemote(code) {
  const res = await fetch(famUrl(code), { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not look up family (" + res.status + ")");
  const list = await res.json();
  if (!Array.isArray(list) || list.length === 0) return null;
  const doc = list[0];
  const { _id, ...rest } = doc;
  return { id: _id, state: rest };
}

export async function pushFamilyRemote(code, id, state) {
  const body = stripLocal(state);
  const res = await fetch(docUrl(code, id), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Could not save (" + res.status + ")");
  return true;
}

export async function pullFamilyRemote(code, id) {
  const res = await fetch(docUrl(code, id), { cache: "no-store" });
  if (res.status === 404) {
    // Fallback: list collection
    return findFamilyRemote(code);
  }
  if (!res.ok) throw new Error("Could not load (" + res.status + ")");
  const doc = await res.json();
  const { _id, ...rest } = doc;
  return { id: _id || id, state: rest };
}

function stripLocal(state) {
  const { familyCode, remoteId, role, ...rest } = state;
  return rest;
}

export function startPolling(getMeta, onRemote, onError) {
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped) return;
    const meta = getMeta();
    if (!meta || !meta.code || !meta.id) {
      timer = setTimeout(tick, POLL_MS);
      return;
    }
    try {
      const remote = await pullFamilyRemote(meta.code, meta.id);
      if (remote && remote.state) onRemote(remote.state, remote.id);
    } catch (e) {
      if (onError) onError(e);
    } finally {
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }
  }

  timer = setTimeout(tick, POLL_MS);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export { POLL_MS, SYNC_BASE };
