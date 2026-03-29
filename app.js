/* ============================================================
   app.js — UI logic, presets, event handling
   ============================================================ */

// -- Presets -------------------------------------------------------
// visual_min_dist controls the Latin-lookalike exclusion threshold.
// Higher values ensure no character visually resembles Latin letters.
// The presets form a smooth gradient from invisible (perfect doubles)
// to total (nothing Latin-looking remains).

const PRESETS = {
  subtle: {
    label: "Subtle",
    description:
      "A faint foreign shimmer. Only the closest diacritics and form variants.",
    replacement_rate: 0.2,
    visual_max_dist: 0.04,
    visual_min_dist: 0.0,
    phonetic_max_dist: 0.0,
    prefer_scripts: null,
  },
  threshold: {
    label: "Threshold",
    description:
      "Readability starts to tip. Latin silhouette still recognizable.",
    replacement_rate: 0.5,
    visual_max_dist: 0.10,
    visual_min_dist: 0.0,
    phonetic_max_dist: 0.30,
    prefer_scripts: null,
  },
  drastic: {
    label: "Drastic",
    description:
      "Beyond readability. Forms still guessable, characters foreign.",
    replacement_rate: 0.8,
    visual_max_dist: 0.18,
    visual_min_dist: 0.03,
    phonetic_max_dist: 0.45,
    prefer_scripts: null,
  },
  total: {
    label: "Total",
    description:
      "Full alienization. No Latin-looking characters remain.",
    replacement_rate: 1.0,
    visual_max_dist: 0.25,
    visual_min_dist: 0.08,
    phonetic_max_dist: 0.55,
    prefer_scripts: null,
  },
};

// -- Script Groups (for checkbox UI) --------------------------------

const SCRIPT_GROUPS = {
  "European / Near-European": [
    "Cyrillic", "Greek", "Armenian", "Georgian", "Coptic",
    "Runic", "Glagolitic",
  ],
  "Historic / Ancient": [
    "Old_Italic", "Gothic", "Deseret", "Osmanya",
  ],
  "Africa": [
    "Tifinagh", "Ethiopic", "NKo", "Vai", "Bamum", "Coptic",
    "Adlam", "Bassa_Vah", "Medefaidrin", "Meroitic_Cursive",
    "Meroitic_Hieroglyphs",
  ],
  "North America": ["Cherokee"],
  "East Asia": ["Lisu", "Katakana", "Hiragana"],
  "Southeast Asia": ["Thai", "Lao", "Myanmar", "Khmer", "Javanese"],
  "South Asia": [
    "Devanagari", "Bengali", "Tamil", "Telugu", "Kannada",
    "Malayalam", "Sinhala", "Tibetan",
  ],
  "Middle East": ["Arabic", "Hebrew", "Syriac", "Thaana"],
  "Latin Extended / Technical": [
    "IPA", "Latin_Extended", "Fullwidth", "Math_Alpha",
  ],
};

const SCRIPT_GROUP_PRESETS = {
  european: [
    "Cyrillic", "Greek", "Armenian", "Georgian", "Coptic",
    "Runic", "Glagolitic", "Old_Italic", "Gothic", "Deseret",
  ],
  asian: [
    "Thai", "Lao", "Myanmar", "Khmer", "Javanese", "Devanagari",
    "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam", "Sinhala",
    "Tibetan", "Lisu", "Katakana", "Hiragana",
  ],
  african: [
    "Tifinagh", "Ethiopic", "NKo", "Vai", "Bamum", "Osmanya",
    "Adlam", "Bassa_Vah", "Medefaidrin", "Meroitic_Cursive",
    "Meroitic_Hieroglyphs",
  ],
  mideast: ["Arabic", "Hebrew", "Syriac", "Thaana"],
};

// -- State ----------------------------------------------------------

let visualTable = null;
let phoneticTable = null;
let lastResult = null;
let inspectorEnabled = false;
let activePreset = "subtle";

// -- DOM refs -------------------------------------------------------

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const inputText = $("#input-text");
const presetButtons = $("#preset-buttons");
const sliderRate = $("#slider-rate");
const sliderVisual = $("#slider-visual");
const sliderPhonetic = $("#slider-phonetic");
const valRate = $("#val-rate");
const valVisual = $("#val-visual");
const valPhonetic = $("#val-phonetic");
const scriptGroupOptions = $("#script-group-options");
const scriptCustomSelect = $("#script-custom-select");
const scriptCheckboxes = $("#script-checkboxes");
const seedInput = $("#seed-input");
const btnAlienize = $("#btn-alienize");
const btnCopy = $("#btn-copy");
const btnDownload = $("#btn-download");
const btnInspectorToggle = $("#btn-inspector-toggle");
const outputSection = $("#output-section");
const outputText = $("#output-text");
const statsSection = $("#stats-section");
const statsContent = $("#stats-content");
const inspectorTooltip = $("#inspector-tooltip");
const loadingOverlay = $("#loading-overlay");

// -- Init -----------------------------------------------------------

async function init() {
  loadingOverlay.classList.remove("hidden");
  btnAlienize.disabled = true;

  // Try loading tables: first check for preloaded globals (file:// compatible),
  // then fall back to fetch (HTTP server)
  try {
    if (window.__VISUAL_TABLE__ && window.__PHONETIC_TABLE__) {
      visualTable = window.__VISUAL_TABLE__;
      phoneticTable = window.__PHONETIC_TABLE__;
    } else {
      const [vResp, pResp] = await Promise.all([
        fetch("data/visual_table.json"),
        fetch("data/phonetic_table.json"),
      ]);
      if (!vResp.ok || !pResp.ok) throw new Error("HTTP error");
      visualTable = await vResp.json();
      phoneticTable = await pResp.json();
    }
  } catch (e) {
    loadingOverlay.querySelector("p").textContent =
      "Error loading tables: " + e.message;
    return;
  }

  loadingOverlay.classList.add("hidden");
  btnAlienize.disabled = false;

  buildPresetButtons();
  buildScriptCheckboxes();
  applyPreset("subtle");
  bindEvents();
}

// -- Presets UI -----------------------------------------------------

function buildPresetButtons() {
  for (const [key, preset] of Object.entries(PRESETS)) {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.dataset.preset = key;
    btn.textContent = preset.label;
    btn.title = preset.description;
    presetButtons.appendChild(btn);
  }
}

function applyPreset(key) {
  const p = PRESETS[key];
  if (!p) return;

  activePreset = key;

  sliderRate.value = Math.round(p.replacement_rate * 100);
  sliderVisual.value = Math.round(p.visual_max_dist * 100);
  sliderPhonetic.value = Math.round(p.phonetic_max_dist * 100);
  updateSliderDisplays();

  // Update script selection
  if (p.prefer_scripts) {
    setActiveScriptOption("custom");
    scriptCheckboxes.classList.remove("hidden");
    scriptCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = p.prefer_scripts.includes(cb.value);
    });
  } else {
    setActiveScriptOption("all");
    scriptCheckboxes.classList.add("hidden");
  }

  // Highlight active preset button
  presetButtons.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === key);
  });
}

function clearActivePreset() {
  activePreset = null;
  presetButtons.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
}

// -- Script Checkboxes ----------------------------------------------

function buildScriptCheckboxes() {
  scriptCheckboxes.innerHTML = "";
  const allScripts = new Set();

  for (const [group, scripts] of Object.entries(SCRIPT_GROUPS)) {
    const header = document.createElement("div");
    header.className = "script-group-header";
    header.textContent = group;
    scriptCheckboxes.appendChild(header);

    for (const script of scripts) {
      if (allScripts.has(script)) continue;
      allScripts.add(script);

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = script;
      cb.checked = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + script.replace(/_/g, " ")));
      scriptCheckboxes.appendChild(label);
    }
  }
}

let activeScriptGroup = "all";

function setActiveScriptOption(value) {
  activeScriptGroup = value;
  // Update button states
  scriptGroupOptions.querySelectorAll(".script-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
  // Update custom select state
  scriptCustomSelect.classList.toggle("active", value === "custom");
  if (value !== "custom") {
    scriptCustomSelect.selectedIndex = 0;
  }
  // Show/hide checkboxes
  if (value === "custom") {
    scriptCheckboxes.classList.remove("hidden");
  } else {
    scriptCheckboxes.classList.add("hidden");
  }
}

function getSelectedScripts() {
  if (activeScriptGroup === "all") return null;
  if (activeScriptGroup === "custom") {
    const checked = [];
    scriptCheckboxes.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      checked.push(cb.value);
    });
    return checked.length > 0 ? checked : null;
  }
  return SCRIPT_GROUP_PRESETS[activeScriptGroup] || null;
}

// -- Slider Displays ------------------------------------------------

function updateSliderDisplays() {
  valRate.textContent = sliderRate.value + "%";
  valVisual.textContent = (sliderVisual.value / 100).toFixed(2);
  valPhonetic.textContent = (sliderPhonetic.value / 100).toFixed(2);
}

// -- Event Binding --------------------------------------------------

function bindEvents() {
  // Preset clicks
  presetButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".preset-btn");
    if (!btn) return;
    applyPreset(btn.dataset.preset);
  });

  // Sliders — update display on input, clear preset
  [sliderRate, sliderVisual, sliderPhonetic].forEach((slider) => {
    slider.addEventListener("input", () => {
      updateSliderDisplays();
      clearActivePreset();
    });
  });

  // Script option buttons
  scriptGroupOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".script-option");
    if (!btn) return;
    setActiveScriptOption(btn.dataset.value);
    clearActivePreset();
  });

  // Custom dropdown
  scriptCustomSelect.addEventListener("change", () => {
    if (scriptCustomSelect.value === "custom") {
      setActiveScriptOption("custom");
      clearActivePreset();
    }
  });

  // Script checkboxes
  scriptCheckboxes.addEventListener("change", () => {
    clearActivePreset();
  });

  // Alienize button
  btnAlienize.addEventListener("click", runAlienization);

  // Keyboard shortcut: Ctrl/Cmd+Enter
  inputText.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runAlienization();
    }
  });

  // Copy
  btnCopy.addEventListener("click", () => {
    if (!lastResult) return;
    navigator.clipboard.writeText(lastResult.text).then(() => {
      btnCopy.textContent = "Copied!";
      setTimeout(() => (btnCopy.textContent = "Copy"), 1500);
    });
  });

  // Download
  btnDownload.addEventListener("click", () => {
    if (!lastResult) return;
    const blob = new Blob([lastResult.text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alienized.txt";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Inspector toggle
  btnInspectorToggle.addEventListener("click", () => {
    inspectorEnabled = !inspectorEnabled;
    btnInspectorToggle.classList.toggle("active", inspectorEnabled);
    if (!inspectorEnabled) {
      inspectorTooltip.classList.add("hidden");
    }
  });

  // Inspector hover (delegated)
  outputText.addEventListener("mouseover", handleInspectorHover);
  outputText.addEventListener("mouseout", () => {
    inspectorTooltip.classList.add("hidden");
  });
  outputText.addEventListener("mousemove", (e) => {
    if (!inspectorTooltip.classList.contains("hidden")) {
      positionTooltip(e);
    }
  });
}

// -- Run Alienization -----------------------------------------------

function runAlienization() {
  const text = inputText.value;
  if (!text.trim()) return;
  if (!visualTable || !phoneticTable) return;

  const seedVal = seedInput.value.trim();
  const seed = seedVal ? parseInt(seedVal, 10) : null;

  const params = {
    replacement_rate: sliderRate.value / 100,
    visual_max_dist: sliderVisual.value / 100,
    visual_min_dist: 0,
    phonetic_max_dist: sliderPhonetic.value / 100,
    prefer_scripts: getSelectedScripts(),
    seed: seed,
  };

  lastResult = alienisiere(text, visualTable, phoneticTable, params);

  // Show seed used
  seedInput.value = lastResult.stats.seed;

  renderOutput();
  renderStats();
  statsSection.style.display = "";
}

// -- Render Output --------------------------------------------------

function renderOutput() {
  if (!lastResult) return;

  outputText.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (let i = 0; i < lastResult.chars.length; i++) {
    const c = lastResult.chars[i];
    const span = document.createElement("span");
    span.className = "char-span" + (c.replaced ? " replaced" : "");
    span.textContent = c.replacement;
    span.dataset.index = i;
    frag.appendChild(span);
  }

  outputText.appendChild(frag);
}

// -- Render Stats ---------------------------------------------------

function renderStats() {
  if (!lastResult) return;
  const s = lastResult.stats;

  let html = `<strong>${s.latin_chars}</strong> Latin characters &rarr; <strong>${s.replaced}</strong> replaced (<strong>${Math.round(s.actual_rate * 100)}%</strong>)<br>`;
  html += `Visual: <strong>${s.visual}</strong> | Phonetic: <strong>${s.phonetic}</strong>`;

  if (s.scripts_used.length > 0) {
    html += '<div class="stats-scripts">Scripts: ';
    html += s.scripts_used
      .map(
        (sc) =>
          `<span class="script-tag">${sc.script.replace(/_/g, " ")} (${sc.count})</span>`
      )
      .join("");
    html += "</div>";
  }

  statsContent.innerHTML = html;
}

// -- Inspector ------------------------------------------------------

function handleInspectorHover(e) {
  if (!inspectorEnabled || !lastResult) return;

  const span = e.target.closest(".char-span");
  if (!span) return;

  const idx = parseInt(span.dataset.index, 10);
  const c = lastResult.chars[idx];

  if (!c || !c.replaced || !c.candidate) {
    inspectorTooltip.classList.add("hidden");
    return;
  }

  const cand = c.candidate;
  inspectorTooltip.innerHTML = `
    <div class="tt-char">${c.replacement}</div>
    <div class="tt-row"><span class="tt-label">Code:</span> ${cand.cp}</div>
    <div class="tt-row"><span class="tt-label">Name:</span> ${cand.name}</div>
    <div class="tt-row"><span class="tt-label">Script:</span> ${cand.script.replace(/_/g, " ")}</div>
    <div class="tt-row"><span class="tt-label">Distance:</span> ${cand.dist.toFixed(4)}</div>
    <div class="tt-row"><span class="tt-label">Method:</span> ${c.method}</div>
    <div class="tt-row"><span class="tt-label">Original:</span> "${c.original}"</div>
  `;

  inspectorTooltip.classList.remove("hidden");
  positionTooltip(e);
}

function positionTooltip(e) {
  const tt = inspectorTooltip;
  const pad = 12;
  let x = e.clientX + pad;
  let y = e.clientY + pad;

  const rect = tt.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) {
    x = e.clientX - rect.width - pad;
  }
  if (y + rect.height > window.innerHeight) {
    y = e.clientY - rect.height - pad;
  }

  tt.style.left = x + "px";
  tt.style.top = y + "px";
}

// -- Start ----------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);
