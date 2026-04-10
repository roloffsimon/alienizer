/* ============================================================
   popup.js — Alienisierung Extension Popup Logic
   ============================================================ */

const PRESETS = {
  sneaky: {
    label: "Sneaky",
    replacement_rate: 1.0,
    visual_max_dist: 0.0,
    phonetic_max_dist: 0.0,
    phonetic_ratio: 0.0,
    prefer_scripts: null,
  },
  subtle: {
    label: "Subtle",
    replacement_rate: 0.2,
    visual_max_dist: 0.04,
    phonetic_max_dist: 0.0,
    phonetic_ratio: 0.0,
    prefer_scripts: null,
  },
  threshold: {
    label: "Threshold",
    replacement_rate: 0.5,
    visual_max_dist: 0.12,
    phonetic_max_dist: 0.30,
    phonetic_ratio: 0.2,
    prefer_scripts: null,
  },
  drastic: {
    label: "Drastic",
    replacement_rate: 0.8,
    visual_max_dist: 0.18,
    phonetic_max_dist: 0.50,
    phonetic_ratio: 0.5,
    prefer_scripts: null,
  },
  total: {
    label: "Total",
    replacement_rate: 1.0,
    visual_max_dist: 0.25,
    phonetic_max_dist: 0.60,
    phonetic_ratio: 0.8,
    prefer_scripts: null,
  },
};

const SCRIPT_GROUPS = {
  "European": [
    "Cyrillic", "Greek", "Armenian", "Georgian", "Coptic", "Runic", "Glagolitic",
  ],
  "Historic": [
    "Old_Italic", "Gothic", "Deseret", "Osmanya",
  ],
  "Africa": [
    "Tifinagh", "Ethiopic", "NKo", "Vai", "Bamum", "Adlam",
    "Bassa_Vah", "Medefaidrin", "Meroitic_Cursive", "Meroitic_Hieroglyphs",
  ],
  "Americas": ["Cherokee"],
  "East Asia": ["Lisu", "Katakana", "Hiragana"],
  "SE Asia": ["Thai", "Lao", "Myanmar", "Khmer", "Javanese"],
  "South Asia": [
    "Devanagari", "Bengali", "Tamil", "Telugu", "Kannada",
    "Malayalam", "Sinhala", "Tibetan",
  ],
  "Middle East": ["Arabic", "Hebrew", "Syriac", "Thaana"],
  "Latin Ext.": ["IPA", "Latin_Extended", "Fullwidth", "Math_Alpha"],
};

const DEFAULT_SETTINGS = {
  autoActivate: false,
  preset: "threshold",
  replacement_rate: 0.5,
  visual_max_dist: 0.12,
  phonetic_max_dist: 0.30,
  phonetic_ratio: 0.2,
  prefer_scripts: null,
  seed: null,
};

// -- DOM refs -------------------------------------------------------

const toggleActive = document.getElementById("toggle-active");
const presetBtns = document.querySelectorAll(".preset-btn");
const sliderRate = document.getElementById("slider-rate");
const sliderVisual = document.getElementById("slider-visual");
const sliderPhonetic = document.getElementById("slider-phonetic");
const valRate = document.getElementById("val-rate");
const valVisual = document.getElementById("val-visual");
const valPhonetic = document.getElementById("val-phonetic");
const seedInput = document.getElementById("seed-input");
const scriptCheckboxes = document.getElementById("script-checkboxes");
const autoActivate = document.getElementById("auto-activate");
const resetLink = document.getElementById("reset-link");

let currentSettings = { ...DEFAULT_SETTINGS };
let currentTabId = null;
let debounceTimer = null;

// -- Init -----------------------------------------------------------

async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;

  // Load settings
  const result = await chrome.storage.sync.get("alienSettings");
  currentSettings = { ...DEFAULT_SETTINGS, ...result.alienSettings };

  // Load tab active state
  if (currentTabId) {
    const sessionResult = await chrome.storage.session.get(`tabActive_${currentTabId}`);
    toggleActive.checked = !!sessionResult[`tabActive_${currentTabId}`];
  }

  applySettingsToUI();
  buildScriptCheckboxes();
  bindEvents();
}

// -- Apply settings to UI -------------------------------------------

async function applySettingsToUI() {
  // Preset
  highlightPreset(currentSettings.preset);

  // Sliders
  sliderRate.value = Math.round(currentSettings.replacement_rate * 100);
  sliderVisual.value = Math.round(currentSettings.visual_max_dist * 100);
  sliderPhonetic.value = Math.round(currentSettings.phonetic_ratio * 100);
  updateSliderDisplays();

  // Seed
  seedInput.value = currentSettings.seed != null ? currentSettings.seed : "";

  // Auto-activate — only show as enabled if permission is actually granted
  const hasPermission = await chrome.permissions.contains({ origins: ["<all_urls>"] });
  autoActivate.checked = currentSettings.autoActivate && hasPermission;
  if (currentSettings.autoActivate && !hasPermission) {
    currentSettings.autoActivate = false;
    chrome.storage.sync.set({ alienSettings: currentSettings });
  }
}

function updateSliderDisplays() {
  valRate.textContent = sliderRate.value + "%";
  valVisual.textContent = (sliderVisual.value / 100).toFixed(2);
  valPhonetic.textContent = sliderPhonetic.value + "%";
}

function highlightPreset(key) {
  presetBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === key);
  });
}

// -- Build script checkboxes ----------------------------------------

function buildScriptCheckboxes() {
  scriptCheckboxes.innerHTML = "";
  const allScripts = new Set();
  const preferSet = currentSettings.prefer_scripts
    ? new Set(currentSettings.prefer_scripts)
    : null;

  for (const [group, scripts] of Object.entries(SCRIPT_GROUPS)) {
    const header = document.createElement("div");
    header.className = "script-group-name";
    header.textContent = group;
    scriptCheckboxes.appendChild(header);

    for (const script of scripts) {
      if (allScripts.has(script)) continue;
      allScripts.add(script);

      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = script;
      // If no prefer_scripts (null), all checked; otherwise only preferred
      cb.checked = preferSet ? preferSet.has(script) : true;
      cb.addEventListener("change", () => {
        clearPreset();
        debouncedUpdate();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + script.replace(/_/g, " ")));
      scriptCheckboxes.appendChild(label);
    }
  }
}

// -- Get current settings from UI -----------------------------------

function getSettingsFromUI() {
  const checkedScripts = [];
  scriptCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (cb.checked) checkedScripts.push(cb.value);
  });

  const allCheckboxes = scriptCheckboxes.querySelectorAll('input[type="checkbox"]');
  const allChecked = checkedScripts.length === allCheckboxes.length;

  const seedVal = seedInput.value.trim();

  // Find active preset for phonetic_max_dist
  const activePresetKey = getActivePreset();
  const activePreset = activePresetKey ? PRESETS[activePresetKey] : null;

  return {
    autoActivate: autoActivate.checked,
    preset: activePresetKey,
    replacement_rate: sliderRate.value / 100,
    visual_max_dist: sliderVisual.value / 100,
    phonetic_max_dist: activePreset ? activePreset.phonetic_max_dist : 0.30,
    phonetic_ratio: sliderPhonetic.value / 100,
    prefer_scripts: allChecked ? null : (checkedScripts.length > 0 ? checkedScripts : null),
    seed: seedVal ? parseInt(seedVal, 10) : null,
  };
}

function getActivePreset() {
  for (const btn of presetBtns) {
    if (btn.classList.contains("active")) return btn.dataset.preset;
  }
  return null;
}

function clearPreset() {
  highlightPreset(null);
}

// -- Save and send --------------------------------------------------

function saveAndSend() {
  const settings = getSettingsFromUI();
  currentSettings = settings;
  chrome.storage.sync.set({ alienSettings: settings });

  if (toggleActive.checked && currentTabId) {
    chrome.runtime.sendMessage({
      target: "background",
      action: "updateSettings",
      settings,
    });
  }
}

function debouncedUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveAndSend, 300);
}

// -- Event binding --------------------------------------------------

function bindEvents() {
  // Toggle active
  toggleActive.addEventListener("change", () => {
    if (toggleActive.checked) {
      const settings = getSettingsFromUI();
      currentSettings = settings;
      chrome.storage.sync.set({ alienSettings: settings });
      chrome.runtime.sendMessage({
        target: "background",
        action: "activate",
        settings,
      });
    } else {
      chrome.runtime.sendMessage({
        target: "background",
        action: "deactivate",
      });
    }
  });

  // Preset buttons
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.preset;
      const preset = PRESETS[key];
      if (!preset) return;

      highlightPreset(key);

      sliderRate.value = Math.round(preset.replacement_rate * 100);
      sliderVisual.value = Math.round(preset.visual_max_dist * 100);
      sliderPhonetic.value = Math.round(preset.phonetic_ratio * 100);
      updateSliderDisplays();

      // Update script checkboxes if preset specifies
      if (preset.prefer_scripts) {
        const preferSet = new Set(preset.prefer_scripts);
        scriptCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.checked = preferSet.has(cb.value);
        });
      } else {
        scriptCheckboxes.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
          cb.checked = true;
        });
      }

      saveAndSend();

      // Auto-activate if not yet active
      if (!toggleActive.checked) {
        toggleActive.checked = true;
        chrome.runtime.sendMessage({
          target: "background",
          action: "activate",
          settings: getSettingsFromUI(),
        });
      }
    });
  });

  // Sliders
  [sliderRate, sliderVisual, sliderPhonetic].forEach((slider) => {
    slider.addEventListener("input", () => {
      updateSliderDisplays();
      clearPreset();
      debouncedUpdate();
    });
  });

  // Seed
  seedInput.addEventListener("input", () => {
    debouncedUpdate();
  });

  // Auto-activate checkbox — request/remove host permission
  autoActivate.addEventListener("change", async () => {
    if (autoActivate.checked) {
      const granted = await chrome.permissions.request({ origins: ["<all_urls>"] });
      if (!granted) {
        autoActivate.checked = false;
        return;
      }
    } else {
      await chrome.permissions.remove({ origins: ["<all_urls>"] });
    }
    const settings = getSettingsFromUI();
    currentSettings = settings;
    chrome.storage.sync.set({ alienSettings: settings });
  });

  // Reset
  resetLink.addEventListener("click", (e) => {
    e.preventDefault();
    currentSettings = { ...DEFAULT_SETTINGS };
    chrome.storage.sync.set({ alienSettings: currentSettings });
    applySettingsToUI();
    buildScriptCheckboxes();

    if (toggleActive.checked) {
      chrome.runtime.sendMessage({
        target: "background",
        action: "updateSettings",
        settings: currentSettings,
      });
    }
  });
}

// -- Start ----------------------------------------------------------

init();
