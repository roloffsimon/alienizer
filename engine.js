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

const EXCLUDED_PHONETIC_SCRIPTS = new Set([
  "Latin_Extended",
  "Math_Alpha",
  "IPA",
]);

/**
 * Characters that are visually indistinguishable from Latin letters.
 * These are "perfect doubles" from Cyrillic, Greek, Math, etc. that
 * must be excluded when we want a truly alien appearance.
 *
 * Organized by the Latin character they mimic.
 * Codepoints gathered from the visual table (dist = 0.0 or near-zero).
 */
const LATIN_LOOKALIKE_CODEPOINTS = new Set([
  // Lowercase Latin lookalikes
  0x0430, // CYRILLIC SMALL LETTER A (looks like 'a')
  0x1D5BA, // MATHEMATICAL SANS-SERIF SMALL A
  0x1D5EE, // MATHEMATICAL SANS-SERIF BOLD SMALL A
  0x03B1, // GREEK SMALL LETTER ALPHA (close to 'a')
  0x0441, // CYRILLIC SMALL LETTER ES (looks like 'c')
  0x1D5BC, // MATHEMATICAL SANS-SERIF SMALL C
  0x1D5F0, // MATHEMATICAL SANS-SERIF BOLD SMALL C
  0x217D, // SMALL ROMAN NUMERAL HUNDRED (c)
  0x0501, // CYRILLIC SMALL LETTER KOMI DE (like 'd')
  0x0435, // CYRILLIC SMALL LETTER IE (looks like 'e')
  0x1D5BE, // MATHEMATICAL SANS-SERIF SMALL E
  0x1D5F2, // MATHEMATICAL SANS-SERIF BOLD SMALL E
  0x0261, // LATIN SMALL LETTER SCRIPT G (IPA, close to 'g')
  0x04BB, // CYRILLIC SMALL LETTER SHHA (looks like 'h')
  0x1D5C1, // MATHEMATICAL SANS-SERIF SMALL H
  0x0456, // CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I (like 'i')
  0x0131, // LATIN SMALL LETTER DOTLESS I
  0x03B9, // GREEK SMALL LETTER IOTA (like 'i')
  0x1D5C2, // MATHEMATICAL SANS-SERIF SMALL I
  0x1D5F6, // MATHEMATICAL SANS-SERIF BOLD SMALL I
  0x0458, // CYRILLIC SMALL LETTER JE (looks like 'j')
  0x1D5C3, // MATHEMATICAL SANS-SERIF SMALL J
  0x1D5F7, // MATHEMATICAL SANS-SERIF BOLD SMALL J
  0x1D5C4, // MATHEMATICAL SANS-SERIF SMALL K
  0x04CF, // CYRILLIC SMALL LETTER PALOCHKA (like 'l')
  0x0196, // LATIN CAPITAL LETTER IOTA (like 'l' in some fonts)
  0x1D5C5, // MATHEMATICAL SANS-SERIF SMALL L
  0x217C, // SMALL ROMAN NUMERAL FIFTY (l)
  0x1D5C6, // MATHEMATICAL SANS-SERIF SMALL M
  0x1D5FA, // MATHEMATICAL SANS-SERIF BOLD SMALL M
  0x1D5C7, // MATHEMATICAL SANS-SERIF SMALL N
  0x1D5FB, // MATHEMATICAL SANS-SERIF BOLD SMALL N
  0x043E, // CYRILLIC SMALL LETTER O (looks like 'o')
  0x03BF, // GREEK SMALL LETTER OMICRON (like 'o')
  0x1D5C8, // MATHEMATICAL SANS-SERIF SMALL O
  0x1D5FC, // MATHEMATICAL SANS-SERIF BOLD SMALL O
  0x0440, // CYRILLIC SMALL LETTER ER (looks like 'p')
  0x1D5C9, // MATHEMATICAL SANS-SERIF SMALL P
  0x1D5FD, // MATHEMATICAL SANS-SERIF BOLD SMALL P
  0x051B, // CYRILLIC SMALL LETTER QA (like 'q')
  0x1D5CA, // MATHEMATICAL SANS-SERIF SMALL Q
  0x1D5CB, // MATHEMATICAL SANS-SERIF SMALL R
  0x0455, // CYRILLIC SMALL LETTER DZE (looks like 's')
  0x1D5CC, // MATHEMATICAL SANS-SERIF SMALL S
  0x1D600, // MATHEMATICAL SANS-SERIF BOLD SMALL S
  0x1D5CD, // MATHEMATICAL SANS-SERIF SMALL T
  0x1D5CE, // MATHEMATICAL SANS-SERIF SMALL U
  0x1D602, // MATHEMATICAL SANS-SERIF BOLD SMALL U
  0x03BD, // GREEK SMALL LETTER NU (like 'v')
  0x1D5CF, // MATHEMATICAL SANS-SERIF SMALL V
  0x1D5D0, // MATHEMATICAL SANS-SERIF SMALL W
  0x0445, // CYRILLIC SMALL LETTER HA (looks like 'x')
  0x1D5D1, // MATHEMATICAL SANS-SERIF SMALL X
  0x1D605, // MATHEMATICAL SANS-SERIF BOLD SMALL X
  0x0443, // CYRILLIC SMALL LETTER U (looks like 'y')
  0x1D5D2, // MATHEMATICAL SANS-SERIF SMALL Y
  0x1D5D3, // MATHEMATICAL SANS-SERIF SMALL Z

  // Uppercase Latin lookalikes
  0x0410, // CYRILLIC CAPITAL LETTER A (like 'A')
  0x0391, // GREEK CAPITAL LETTER ALPHA (like 'A')
  0x1D5A0, // MATHEMATICAL SANS-SERIF CAPITAL A
  0x1D5D4, // MATHEMATICAL SANS-SERIF BOLD CAPITAL A
  0xA4EE, // LISU LETTER A
  0x0412, // CYRILLIC CAPITAL LETTER VE (like 'B')
  0x0392, // GREEK CAPITAL LETTER BETA (like 'B')
  0x1D5A1, // MATHEMATICAL SANS-SERIF CAPITAL B
  0x1D5D5, // MATHEMATICAL SANS-SERIF BOLD CAPITAL B
  0x0421, // CYRILLIC CAPITAL LETTER ES (like 'C')
  0x1D5A2, // MATHEMATICAL SANS-SERIF CAPITAL C
  0x216D, // ROMAN NUMERAL HUNDRED (C)
  0x1D5A3, // MATHEMATICAL SANS-SERIF CAPITAL D
  0x0415, // CYRILLIC CAPITAL LETTER IE (like 'E')
  0x0395, // GREEK CAPITAL LETTER EPSILON (like 'E')
  0x1D5A4, // MATHEMATICAL SANS-SERIF CAPITAL E
  0x1D5D8, // MATHEMATICAL SANS-SERIF BOLD CAPITAL E
  0x1D5A5, // MATHEMATICAL SANS-SERIF CAPITAL F
  0x1D5A6, // MATHEMATICAL SANS-SERIF CAPITAL G
  0x0397, // GREEK CAPITAL LETTER ETA (like 'H')
  0x041D, // CYRILLIC CAPITAL LETTER EN (like 'H')
  0x1D5A7, // MATHEMATICAL SANS-SERIF CAPITAL H
  0x1D5DB, // MATHEMATICAL SANS-SERIF BOLD CAPITAL H
  0x0399, // GREEK CAPITAL LETTER IOTA (like 'I')
  0x0406, // CYRILLIC CAPITAL LETTER BYELORUSSIAN-UKRAINIAN I
  0x1D5A8, // MATHEMATICAL SANS-SERIF CAPITAL I
  0x2160, // ROMAN NUMERAL ONE (I)
  0x0408, // CYRILLIC CAPITAL LETTER JE (like 'J')
  0x1D5A9, // MATHEMATICAL SANS-SERIF CAPITAL J
  0x041A, // CYRILLIC CAPITAL LETTER KA (like 'K')
  0x039A, // GREEK CAPITAL LETTER KAPPA (like 'K')
  0x1D5AA, // MATHEMATICAL SANS-SERIF CAPITAL K
  0x216C, // ROMAN NUMERAL FIFTY (L)
  0x1D5AB, // MATHEMATICAL SANS-SERIF CAPITAL L
  0x039C, // GREEK CAPITAL LETTER MU (like 'M')
  0x041C, // CYRILLIC CAPITAL LETTER EM (like 'M')
  0x1D5AC, // MATHEMATICAL SANS-SERIF CAPITAL M
  0x1D5E0, // MATHEMATICAL SANS-SERIF BOLD CAPITAL M
  0x039D, // GREEK CAPITAL LETTER NU (like 'N')
  0x1D5AD, // MATHEMATICAL SANS-SERIF CAPITAL N
  0x1D5E1, // MATHEMATICAL SANS-SERIF BOLD CAPITAL N
  0x041E, // CYRILLIC CAPITAL LETTER O (like 'O')
  0x039F, // GREEK CAPITAL LETTER OMICRON (like 'O')
  0x1D5AE, // MATHEMATICAL SANS-SERIF CAPITAL O
  0x1D5E2, // MATHEMATICAL SANS-SERIF BOLD CAPITAL O
  0x0420, // CYRILLIC CAPITAL LETTER ER (like 'P')
  0x03A1, // GREEK CAPITAL LETTER RHO (like 'P')
  0x1D5AF, // MATHEMATICAL SANS-SERIF CAPITAL P
  0x1D5E3, // MATHEMATICAL SANS-SERIF BOLD CAPITAL P
  0x1D5B0, // MATHEMATICAL SANS-SERIF CAPITAL Q
  0x1D5B1, // MATHEMATICAL SANS-SERIF CAPITAL R
  0x0405, // CYRILLIC CAPITAL LETTER DZE (like 'S')
  0x1D5B2, // MATHEMATICAL SANS-SERIF CAPITAL S
  0x0422, // CYRILLIC CAPITAL LETTER TE (like 'T')
  0x03A4, // GREEK CAPITAL LETTER TAU (like 'T')
  0x1D5B3, // MATHEMATICAL SANS-SERIF CAPITAL T
  0x1D5E7, // MATHEMATICAL SANS-SERIF BOLD CAPITAL T
  0x1D5B4, // MATHEMATICAL SANS-SERIF CAPITAL U
  0x2164, // ROMAN NUMERAL FIVE (V)
  0x1D5B5, // MATHEMATICAL SANS-SERIF CAPITAL V
  0x1D5B6, // MATHEMATICAL SANS-SERIF CAPITAL W
  0x2169, // ROMAN NUMERAL TEN (X)
  0x03A7, // GREEK CAPITAL LETTER CHI (like 'X')
  0x0425, // CYRILLIC CAPITAL LETTER HA (like 'X')
  0x1D5B7, // MATHEMATICAL SANS-SERIF CAPITAL X
  0x1D5EB, // MATHEMATICAL SANS-SERIF BOLD CAPITAL X
  0x03A5, // GREEK CAPITAL LETTER UPSILON (like 'Y')
  0x04AE, // CYRILLIC CAPITAL LETTER STRAIGHT U (like 'Y')
  0x1D5B8, // MATHEMATICAL SANS-SERIF CAPITAL Y
  0x0396, // GREEK CAPITAL LETTER ZETA (like 'Z')
  0x1D5B9, // MATHEMATICAL SANS-SERIF CAPITAL Z

  // Digit lookalikes
  0xFF10, // FULLWIDTH DIGIT ZERO
  0xFF11, // FULLWIDTH DIGIT ONE
  0xFF12, // FULLWIDTH DIGIT TWO
  0xFF13, // FULLWIDTH DIGIT THREE
  0xFF14, // FULLWIDTH DIGIT FOUR
  0xFF15, // FULLWIDTH DIGIT FIVE
  0xFF16, // FULLWIDTH DIGIT SIX
  0xFF17, // FULLWIDTH DIGIT SEVEN
  0xFF18, // FULLWIDTH DIGIT EIGHT
  0xFF19, // FULLWIDTH DIGIT NINE
  0x03F4, // GREEK CAPITAL THETA SYMBOL (like '0')
  0x041E, // CYRILLIC CAPITAL LETTER O (like '0')
]);

/**
 * Scripts that produce predominantly Latin-lookalike characters.
 * When excluding Latin lookalikes, candidates from these scripts
 * with low visual distance are highly suspect.
 */
const LATIN_LOOKALIKE_SCRIPTS = new Set([
  "Math_Alpha",
  "Fullwidth",
  "IPA",
  "Latin_Extended",
]);

/**
 * Check if a candidate character looks too much like Latin.
 * Uses both a codepoint set and a distance-based heuristic.
 *
 * @param {Object} candidate - { dist, char, cp, script, name }
 * @param {number} minDist - minimum visual distance required
 * @returns {boolean} true if the candidate should be excluded
 */
function isLatinLookalike(candidate, minDist) {
  // Check explicit codepoint exclusion list
  const cp = parseInt(candidate.cp.replace("U+", ""), 16);
  if (LATIN_LOOKALIKE_CODEPOINTS.has(cp)) return true;

  // Exclude all characters from scripts that are essentially Latin variants
  if (LATIN_LOOKALIKE_SCRIPTS.has(candidate.script)) return true;

  // Exclude any character below the minimum distance threshold
  if (candidate.dist < minDist) return true;

  return false;
}

/**
 * Main alienization function.
 *
 * @param {string} text - Input text
 * @param {Object} visualTable - visual_table.json data
 * @param {Object} phoneticTable - phonetic_table.json data
 * @param {Object} params - Parameters
 * @param {number} params.replacement_rate - 0.0..1.0
 * @param {number} params.visual_max_dist - 0.0..0.5
 * @param {number} params.visual_min_dist - 0.0..0.3 (exclude Latin lookalikes)
 * @param {number} params.phonetic_max_dist - 0.0..0.7
 * @param {string[]|null} params.prefer_scripts - Preferred scripts or null
 * @param {number|null} params.seed - Random seed or null
 *
 * @returns {{ text: string, chars: Array, stats: Object }}
 */
function alienisiere(text, visualTable, phoneticTable, params = {}) {
  const {
    replacement_rate = 0.8,
    visual_max_dist = 0.15,
    visual_min_dist = 0.0,
    phonetic_max_dist = 0.45,
    prefer_scripts = null,
    seed = null,
  } = params;

  const actualSeed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
  const rng = mulberry32(actualSeed);

  // Find all Latin positions
  const latinPositions = [];
  for (let i = 0; i < text.length; i++) {
    if (LATIN_CHARS.has(text[i])) {
      latinPositions.push(i);
    }
  }

  const nLatin = latinPositions.length;
  const nTarget = Math.round(nLatin * replacement_rate);

  // Shuffle and pick target positions
  const shuffled = shuffle(latinPositions, rng);
  const targetPositions = new Set(shuffled.slice(0, nTarget));

  // Build character result array with metadata
  const chars = [];
  for (let i = 0; i < text.length; i++) {
    chars.push({
      original: text[i],
      replacement: text[i],
      replaced: false,
      method: null,
      candidate: null,
    });
  }

  const preferSet = prefer_scripts ? new Set(prefer_scripts) : null;
  const scriptCounts = {};
  let visualCount = 0;
  let phoneticCount = 0;

  // --- Pass 1: Visual substitution ---
  const replaced = new Set();

  for (const i of targetPositions) {
    const ch = text[i];
    const candidates = visualTable[ch];
    if (!candidates) continue;

    // Filter by distance range and optionally exclude Latin lookalikes
    let filtered = candidates.filter((c) => {
      if (c.dist > visual_max_dist) return false;
      if (visual_min_dist > 0 && isLatinLookalike(c, visual_min_dist)) return false;
      return true;
    });

    // Prefer scripts if specified
    if (preferSet && filtered.length > 0) {
      const preferred = filtered.filter((c) => preferSet.has(c.script));
      if (preferred.length > 0) filtered = preferred;
    }

    const chosen = weightedChoice(filtered, rng);
    if (chosen) {
      chars[i].replacement = chosen.char;
      chars[i].replaced = true;
      chars[i].method = "visual";
      chars[i].candidate = chosen;
      replaced.add(i);
      visualCount++;
      scriptCounts[chosen.script] = (scriptCounts[chosen.script] || 0) + 1;
    }
  }

  // --- Pass 2: Phonetic substitution (fallback for unreplaced targets) ---
  for (const i of targetPositions) {
    if (replaced.has(i)) continue;

    const ch = text[i];
    const candidates = phoneticTable[ch];
    if (!candidates) continue;

    // Filter by max distance, exclude boring scripts, and optionally Latin lookalikes
    let filtered = candidates.filter((c) => {
      if (c.dist > phonetic_max_dist) return false;
      if (EXCLUDED_PHONETIC_SCRIPTS.has(c.script)) return false;
      if (visual_min_dist > 0 && isLatinLookalike(c, visual_min_dist)) return false;
      return true;
    });

    // Prefer scripts if specified
    if (preferSet && filtered.length > 0) {
      const preferred = filtered.filter((c) => preferSet.has(c.script));
      if (preferred.length > 0) filtered = preferred;
    }

    const chosen = uniformChoice(filtered, rng);
    if (chosen) {
      chars[i].replacement = chosen.char;
      chars[i].replaced = true;
      chars[i].method = "phonetic";
      chars[i].candidate = chosen;
      replaced.add(i);
      phoneticCount++;
      scriptCounts[chosen.script] = (scriptCounts[chosen.script] || 0) + 1;
    }
  }

  // --- Pass 3: Relaxed fallback for stubborn characters ---
  // If min_dist filtering left some targets unreplaced, retry with relaxed
  // constraints: only exclude the explicit codepoint/script list, not the
  // distance-based heuristic. This ensures maximum coverage in "Total" mode.
  if (visual_min_dist > 0) {
    for (const i of targetPositions) {
      if (replaced.has(i)) continue;

      const ch = text[i];

      // Try visual table first with relaxed filter
      const vCandidates = visualTable[ch];
      if (vCandidates) {
        let filtered = vCandidates.filter((c) => {
          if (c.dist > visual_max_dist) return false;
          // Only exclude explicit lookalike codepoints and scripts, not distance-based
          const cp = parseInt(c.cp.replace("U+", ""), 16);
          if (LATIN_LOOKALIKE_CODEPOINTS.has(cp)) return false;
          if (LATIN_LOOKALIKE_SCRIPTS.has(c.script)) return false;
          return true;
        });

        if (preferSet && filtered.length > 0) {
          const preferred = filtered.filter((c) => preferSet.has(c.script));
          if (preferred.length > 0) filtered = preferred;
        }

        const chosen = weightedChoice(filtered, rng);
        if (chosen) {
          chars[i].replacement = chosen.char;
          chars[i].replaced = true;
          chars[i].method = "visual";
          chars[i].candidate = chosen;
          replaced.add(i);
          visualCount++;
          scriptCounts[chosen.script] = (scriptCounts[chosen.script] || 0) + 1;
          continue;
        }
      }

      // Try phonetic table with relaxed filter
      const pCandidates = phoneticTable[ch];
      if (pCandidates) {
        let filtered = pCandidates.filter((c) => {
          if (c.dist > phonetic_max_dist) return false;
          if (EXCLUDED_PHONETIC_SCRIPTS.has(c.script)) return false;
          const cp = parseInt(c.cp.replace("U+", ""), 16);
          if (LATIN_LOOKALIKE_CODEPOINTS.has(cp)) return false;
          if (LATIN_LOOKALIKE_SCRIPTS.has(c.script)) return false;
          return true;
        });

        if (preferSet && filtered.length > 0) {
          const preferred = filtered.filter((c) => preferSet.has(c.script));
          if (preferred.length > 0) filtered = preferred;
        }

        const chosen = uniformChoice(filtered, rng);
        if (chosen) {
          chars[i].replacement = chosen.char;
          chars[i].replaced = true;
          chars[i].method = "phonetic";
          chars[i].candidate = chosen;
          replaced.add(i);
          phoneticCount++;
          scriptCounts[chosen.script] = (scriptCounts[chosen.script] || 0) + 1;
        }
      }
    }
  }

  // Build output text
  const outputText = chars.map((c) => c.replacement).join("");

  // Sort scripts by count
  const scriptsSorted = Object.entries(scriptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([script, count]) => ({ script, count }));

  const stats = {
    total_chars: text.length,
    latin_chars: nLatin,
    target: nTarget,
    replaced: replaced.size,
    actual_rate: nLatin > 0 ? replaced.size / nLatin : 0,
    visual: visualCount,
    phonetic: phoneticCount,
    scripts_used: scriptsSorted,
    seed: actualSeed,
  };

  return { text: outputText, chars, stats };
}
