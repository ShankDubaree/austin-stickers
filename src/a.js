/**
 * Short Fire-Kids entry: /austin-stickers/a
 * Bakes Austin's family + remote id so the URL needs no ?query string.
 * Dynamic import so defaults land before kid.js boots (static imports are hoisted).
 */
window.__AUSTIN_KID_DEFAULTS__ = {
  family: "B49ZVF",
  id: "ff808181a09d98f701a17f21db692dcd",
};

await import("./kid.js");
