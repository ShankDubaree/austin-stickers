// Sea creatures for Austin's sticker slots — same set/style as austin-homework.
// Emoji/SVG only (Fire-tablet-safe). No downloaded images.

export const CREATURES = [
  { id: "tropical", name: "Finn the Tropical Fish", emoji: "🐠" },
  { id: "octopus", name: "Ollie the Octopus", emoji: "🐙" },
  { id: "crab", name: "Snappy the Crab", emoji: "🦀" },
  { id: "starfish", name: "Twinkle the Starfish", svg: "star", color: "#ff9f43" },
  { id: "dolphin", name: "Flip the Dolphin", emoji: "🐬" },
  { id: "turtle", name: "Shelly the Turtle", emoji: "🐢" },
  { id: "jelly", name: "Wobble the Jellyfish", svg: "jelly", color: "#ff7eb6" },
  { id: "whale", name: "Spout the Whale", emoji: "🐳" },
  { id: "shrimp", name: "Tiny the Shrimp", emoji: "🦐" },
  { id: "fish", name: "Splash the Fish", emoji: "🐟" },
  { id: "shark", name: "Chomp the Shark", emoji: "🦈" },
  { id: "squid", name: "Inky the Squid", emoji: "🦑" },
  { id: "lobster", name: "Clawdia the Lobster", emoji: "🦞" },
  { id: "shell", name: "Swirl the Shell", emoji: "🐚" },
  { id: "penguin", name: "Pip the Penguin", emoji: "🐧" },
  { id: "bluewhale", name: "Big Blue the Whale", emoji: "🐋" },
  { id: "purplestar", name: "Violet the Starfish", svg: "star", color: "#b57bff" },
  { id: "bluetang", name: "Bubbles the Blue Fish", emoji: "🐠", hue: 160 },
  { id: "greenocto", name: "Ziggy the Green Octopus", emoji: "🐙", hue: 100 },
  { id: "moonjelly", name: "Glow the Moon Jelly", svg: "jelly", color: "#7fd6ff" },
  { id: "bluecrab", name: "Bella the Blue Crab", emoji: "🦀", hue: 200 },
  { id: "pinkdolphin", name: "Rosie the Pink Dolphin", emoji: "🐬", hue: 290 },
  { id: "goldfish", name: "Goldie the Fish", emoji: "🐟", hue: 180 },
  { id: "seaturtle", name: "Sunny the Sea Turtle", emoji: "🐢", hue: 50 },
  { id: "redstar", name: "Ruby the Starfish", svg: "star", color: "#ff5b6e" },
  { id: "purplesquid", name: "Captain Squiggle", emoji: "🦑", hue: 240 },
  { id: "glowshrimp", name: "Glimmer the Shrimp", emoji: "🦐", hue: 120 },
  { id: "greenjelly", name: "Jiggle the Jellyfish", svg: "jelly", color: "#8dff9a" },
  { id: "pinkshell", name: "Pearl the Shell", emoji: "🐚", hue: 300 },
  { id: "mintwhale", name: "Misty the Whale", emoji: "🐳", hue: 120 },
  { id: "lanternshark", name: "Sparky the Lantern Shark", emoji: "🦈", glow: true },
];

// Golden puffer used for the weekly target mascot (same vibe as homework full-marks bonus).
export const SPECIAL = {
  id: "golden-puffer",
  name: "Sparkle the Golden Puffer Fish",
  emoji: "🐡",
  special: true,
};

export function creatureById(id) {
  return id === SPECIAL.id ? SPECIAL : CREATURES.find((c) => c.id === id) || null;
}

function svgArt(c, size) {
  if (c.svg === "star") {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 19 : 46,
        a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(
        `${(50 + r * Math.cos(a)).toFixed(1)},${(52 + r * Math.sin(a)).toFixed(1)}`
      );
    }
    return `<svg class="sea-svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${pts.join(" ")}" fill="${c.color}" stroke="#0b1b4a" stroke-width="4" stroke-linejoin="round"/><circle cx="42" cy="46" r="4" fill="#0b1b4a"/><circle cx="58" cy="46" r="4" fill="#0b1b4a"/><path d="M42 58 Q50 65 58 58" stroke="#0b1b4a" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
  }
  return `<svg class="sea-svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="${c.color}" stroke-width="5" stroke-linecap="round"><path d="M30 55 q-6 10 0 20 t0 20"/><path d="M45 57 q-6 10 0 20 t0 20"/><path d="M58 57 q6 10 0 20 t0 20"/><path d="M72 55 q6 10 0 20 t0 20"/></g><path d="M16 58 Q16 14 50 14 Q84 14 84 58 Z" fill="${c.color}" stroke="#0b1b4a" stroke-width="4" stroke-linejoin="round"/><circle cx="40" cy="40" r="4.5" fill="#0b1b4a"/><circle cx="60" cy="40" r="4.5" fill="#0b1b4a"/><path d="M42 49 Q50 55 58 49" stroke="#0b1b4a" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`;
}

export function creatureArt(c, size = 56) {
  if (c.svg) return svgArt(c, size);
  const style = [`font-size:${Math.round(size * 0.86)}px`];
  if (c.hue) style.push(`filter:hue-rotate(${c.hue}deg) saturate(1.3)`);
  if (c.glow)
    style.push(
      "filter:drop-shadow(0 0 6px #7fd6ff) drop-shadow(0 0 12px #7fd6ff)"
    );
  if (c.special)
    style.push(
      "filter:sepia(1) saturate(4) hue-rotate(-12deg) drop-shadow(0 0 8px #ffe066)"
    );
  return `<span class="sea-emoji" style="${style.join(";")}" aria-hidden="true">${c.emoji}</span>`;
}

/** Stable hash → creature for a sticker slot (category + date + slot). */
export function creatureForSlot(category, dateKey, slot = "") {
  const key = `${category}|${dateKey}|${slot}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % CREATURES.length;
  return CREATURES[idx];
}

export const WEEK_TARGET = 20;
