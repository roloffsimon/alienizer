/* ============================================================
   content.js — Alienisierung Content Script
   DOM traversal, text replacement, MutationObserver, undo
   ============================================================ */

(() => {
  // Guard against multiple injections
  if (window.__alienisierungLoaded) return;
  window.__alienisierungLoaded = true;

  // -- State ------------------------------------------------------

  let visualTable = null;
  let phoneticTable = null;
  let currentSettings = null;
  let isActive = false;
  let isProcessing = false;
  let observer = null;

  const originalTexts = new WeakMap(); // TextNode → original nodeValue

  // -- Excluded parent tags ---------------------------------------

  const EXCLUDED_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "KBD",
    "SAMP", "VAR", "TEXTAREA", "INPUT", "SELECT", "BUTTON",
  ]);

  const LATIN_RE = /[a-zA-Z]/;

  // -- Load tables ------------------------------------------------

  async function loadTables() {
    if (visualTable && phoneticTable) return;
    const [vResp, pResp] = await Promise.all([
      fetch(chrome.runtime.getURL("visual_table.json")),
      fetch(chrome.runtime.getURL("phonetic_table.json")),
    ]);
    visualTable = await vResp.json();
    phoneticTable = await pResp.json();
  }

  // -- Engine (inlined from engine.js) ----------------------------
  // We include the engine functions directly since content scripts
  // can't use importScripts or ES modules.

  function mulberry32(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

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

  function uniformChoice(candidates, rng) {
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng() * candidates.length)];
  }

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

  function alienisiere(text, vTable, pTable, params = {}) {
    const {
      replacement_rate = 0.8,
      visual_max_dist = 0.15,
      phonetic_max_dist = 0.45,
      phonetic_ratio = 0.0,
      prefer_scripts = null,
      seed = null,
    } = params;

    const actualSeed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
    const rng = mulberry32(actualSeed);

    const latinPositions = [];
    for (let i = 0; i < text.length; i++) {
      if (LATIN_CHARS.has(text[i])) latinPositions.push(i);
    }

    const nLatin = latinPositions.length;
    const nTarget = Math.round(nLatin * replacement_rate);
    const shuffled = shuffle(latinPositions, rng);
    const nPhonetic = Math.round(nTarget * phonetic_ratio);
    const phoneticFirst = new Set(shuffled.slice(0, nPhonetic));
    const visualFirst = new Set(shuffled.slice(nPhonetic, nTarget));

    const chars = [];
    for (let i = 0; i < text.length; i++) {
      chars.push({ original: text[i], replacement: text[i], replaced: false });
    }

    const preferSet = prefer_scripts ? new Set(prefer_scripts) : null;

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

    const replaced = new Set();

    function assign(i, chosen) {
      chars[i].replacement = chosen.char;
      chars[i].replaced = true;
      replaced.add(i);
    }

    // Phonetic-primary group
    for (const i of phoneticFirst) {
      const ch = text[i];
      const pCands = pTable[ch] ? filterPhonetic(pTable[ch]) : [];
      const pChosen = uniformChoice(pCands, rng);
      if (pChosen) { assign(i, pChosen); continue; }
      const vCands = vTable[ch] ? filterVisual(vTable[ch]) : [];
      const vChosen = weightedChoice(vCands, rng);
      if (vChosen) assign(i, vChosen);
    }

    // Visual-primary group
    for (const i of visualFirst) {
      const ch = text[i];
      const vCands = vTable[ch] ? filterVisual(vTable[ch]) : [];
      const vChosen = weightedChoice(vCands, rng);
      if (vChosen) { assign(i, vChosen); continue; }
      const pCands = pTable[ch] ? filterPhonetic(pTable[ch]) : [];
      const pChosen = uniformChoice(pCands, rng);
      if (pChosen) assign(i, pChosen);
    }

    return { text: chars.map((c) => c.replacement).join("") };
  }

  // -- DOM Traversal with idle callback chunking ------------------

  function isExcluded(node) {
    let el = node.parentElement;
    while (el) {
      if (EXCLUDED_TAGS.has(el.tagName)) return true;
      if (el.getAttribute("contenteditable") === "true" || el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
        if (!LATIN_RE.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (isExcluded(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function processNodes(nodes, settings) {
    const CHUNK_SIZE = 50;
    let idx = 0;

    function processChunk(deadline) {
      isProcessing = true;
      while (idx < nodes.length && (deadline ? deadline.timeRemaining() > 1 : idx < idx + CHUNK_SIZE)) {
        const node = nodes[idx];
        // Only store original if not already saved
        if (!originalTexts.has(node)) {
          originalTexts.set(node, node.nodeValue);
        }
        const result = alienisiere(node.nodeValue, visualTable, phoneticTable, settings);
        node.nodeValue = result.text;
        idx++;
        // In non-idle mode, limit per batch
        if (!deadline && (idx % CHUNK_SIZE === 0)) break;
      }
      isProcessing = false;

      if (idx < nodes.length) {
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(processChunk);
        } else {
          setTimeout(() => processChunk(null), 0);
        }
      }
    }

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(processChunk);
    } else {
      processChunk(null);
    }
  }

  // -- MutationObserver -------------------------------------------

  function startObserver(settings) {
    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      if (isProcessing) return;

      const newNodes = [];
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added.nodeType === Node.TEXT_NODE) {
            if (added.nodeValue && added.nodeValue.length >= 3 && LATIN_RE.test(added.nodeValue) && !isExcluded(added)) {
              newNodes.push(added);
            }
          } else if (added.nodeType === Node.ELEMENT_NODE) {
            const childTexts = collectTextNodes(added);
            newNodes.push(...childTexts);
          }
        }
      }

      if (newNodes.length > 0) {
        processNodes(newNodes, settings);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // -- Undo (restore original texts) -----------------------------

  function restoreAll() {
    const allText = collectAllTextNodes(document.body);
    for (const node of allText) {
      const orig = originalTexts.get(node);
      if (orig !== undefined) {
        isProcessing = true;
        node.nodeValue = orig;
        isProcessing = false;
      }
    }
  }

  function collectAllTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  // -- Activate / Deactivate -------------------------------------

  async function activate(settings) {
    await loadTables();
    currentSettings = settings;
    isActive = true;

    const nodes = collectTextNodes(document.body);
    processNodes(nodes, settings);
    startObserver(settings);
  }

  function deactivate() {
    isActive = false;
    stopObserver();
    restoreAll();
  }

  // -- Message listener -------------------------------------------

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "activate") {
      activate(msg.settings);
      sendResponse({ ok: true });
    } else if (msg.action === "deactivate") {
      deactivate();
      sendResponse({ ok: true });
    } else if (msg.action === "updateSettings") {
      if (isActive) {
        deactivate();
        activate(msg.settings);
      }
      sendResponse({ ok: true });
    }
  });
})();
