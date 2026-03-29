/* ============================================================
   engine.js — Alienizer Engine (client-side)
   Two-layer substitution: visual + phonetic
   Port of the Python reference implementation
   ============================================================ */

/**
 * Seeded PRNG (Mulberry32) — deterministic random like numpy.RandomState
 */
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Weighted random choice (inverse-distance weighting like Python prototype)
 */
function weightedChoice(candidates, rng) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const weights = candidates.map((c) => 1.0 / (c.dist + 0.001));
  const sum = weights.reduce((a, b) => a + b, 0);

  let r = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Uniform random choice
 */
function uniformChoice(candidates, rng) {
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/**
 * Fisher-Yates shuffle with seeded RNG
 */
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LATIN_CHARS = new Set(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
);


/**
 * Main alienization function.
 *
 * @param {string} text - Input text
 * @param {Object} visualTable - visual_table.json data
 * @param {Object} phoneticTable - phonetic_table.json data
 * @param {Object} params - Parameters
 * @param {number} params.replacement_rate  - 0.0..1.0
 * @param {number} params.visual_max_dist   - 0.0..0.5
 * @param {number} params.phonetic_max_dist - 0.0..0.7
 * @param {number} params.phonetic_ratio    - 0.0..1.0  fraction of targets that try phonetic first
 * @param {string[]|null} params.prefer_scripts - Preferred scripts or null
 * @param {number|null} params.seed - Random seed or null
 *
 * @returns {{ text: string, chars: Array, stats: Object }}
 */
function alienisiere(text, visualTable, phoneticTable, params = {}) {
  const {
    replacement_rate  = 0.8,
    visual_max_dist   = 0.15,
    phonetic_max_dist = 0.45,
    phonetic_ratio    = 0.0,
    prefer_scripts    = null,
    seed              = null,
  } = params;

  const actualSeed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
  const rng = mulberry32(actualSeed);

  // Find all Latin positions
  const latinPositions = [];
  for (let i = 0; i < text.length; i++) {
    if (LATIN_CHARS.has(text[i])) latinPositions.push(i);
  }

  const nLatin  = latinPositions.length;
  const nTarget = Math.round(nLatin * replacement_rate);

  // Shuffle once, then split into phonetic-primary and visual-primary groups
  const shuffled       = shuffle(latinPositions, rng);
  const nPhonetic      = Math.round(nTarget * phonetic_ratio);
  const phoneticFirst  = new Set(shuffled.slice(0, nPhonetic));
  const visualFirst    = new Set(shuffled.slice(nPhonetic, nTarget));

  // Build character result array with metadata
  const chars = [];
  for (let i = 0; i < text.length; i++) {
    chars.push({ original: text[i], replacement: text[i], replaced: false, method: null, candidate: null });
  }

  const preferSet    = prefer_scripts ? new Set(prefer_scripts) : null;
  const scriptCounts = {};
  let visualCount    = 0;
  let phoneticCount  = 0;
  const replaced     = new Set();

  // Filter helpers -------------------------------------------------------

  function applyPreference(filtered) {
    if (preferSet && filtered.length > 0) {
      const preferred = filtered.filter((c) => preferSet.has(c.script));
      if (preferred.length > 0) return preferred;
    }
    return filtered;
  }

  function filterVisual(candidates) {
    return applyPreference(candidates.filter((c) => c.dist <= visual_max_dist));
  }

  function filterPhonetic(candidates) {
    return applyPreference(candidates.filter((c) => c.dist <= phonetic_max_dist));
  }

  // Assign helpers -------------------------------------------------------

  function assignVisual(i, chosen) {
    chars[i].replacement = chosen.char;
    chars[i].replaced    = true;
    chars[i].method      = "visual";
    chars[i].candidate   = chosen;
    replaced.add(i);
    visualCount++;
    scriptCounts[chosen.script] = (scriptCounts[chosen.script] || 0) + 1;
  }

  function assignPhonetic(i, chosen) {
    chars[i].replacement = chosen.char;
    chars[i].replaced    = true;
    chars[i].method      = "phonetic";
    chars[i].candidate   = chosen;
    replaced.add(i);
    phoneticCount++;
    scriptCounts[chosen.script] = (scriptCounts[chosen.script] || 0) + 1;
  }

  // --- Phonetic-primary group: phonetic first, visual as fallback ---
  for (const i of phoneticFirst) {
    const ch = text[i];

    const pCands = phoneticTable[ch] ? filterPhonetic(phoneticTable[ch]) : [];
    const pChosen = uniformChoice(pCands, rng);
    if (pChosen) { assignPhonetic(i, pChosen); continue; }

    const vCands = visualTable[ch] ? filterVisual(visualTable[ch]) : [];
    const vChosen = weightedChoice(vCands, rng);
    if (vChosen) assignVisual(i, vChosen);
  }

  // --- Visual-primary group: visual first, phonetic as fallback ---
  for (const i of visualFirst) {
    const ch = text[i];

    const vCands = visualTable[ch] ? filterVisual(visualTable[ch]) : [];
    const vChosen = weightedChoice(vCands, rng);
    if (vChosen) { assignVisual(i, vChosen); continue; }

    const pCands = phoneticTable[ch] ? filterPhonetic(phoneticTable[ch]) : [];
    const pChosen = uniformChoice(pCands, rng);
    if (pChosen) assignPhonetic(i, pChosen);
  }

  // Build output text
  const outputText = chars.map((c) => c.replacement).join("");

  const scriptsSorted = Object.entries(scriptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([script, count]) => ({ script, count }));

  const stats = {
    total_chars:  text.length,
    latin_chars:  nLatin,
    target:       nTarget,
    replaced:     replaced.size,
    actual_rate:  nLatin > 0 ? replaced.size / nLatin : 0,
    visual:       visualCount,
    phonetic:     phoneticCount,
    scripts_used: scriptsSorted,
    seed:         actualSeed,
  };

  return { text: outputText, chars, stats };
}
