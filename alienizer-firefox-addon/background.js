/* ============================================================
   background.js — Service Worker for Alienizer (Firefox)
   Uses async/await throughout — Firefox Promise-based API
   ============================================================ */

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

// -- Install: write defaults if no settings exist ----------------

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.sync.get("alienSettings");
  if (!result.alienSettings) {
    await chrome.storage.sync.set({ alienSettings: DEFAULT_SETTINGS });
  }
});

// -- Auto-activate on page load ----------------------------------

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))) return;

  const result = await chrome.storage.sync.get("alienSettings");
  const settings = result.alienSettings || DEFAULT_SETTINGS;
  if (!settings.autoActivate) return;

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.storage.session.set({ [`tabActive_${tabId}`]: true });
    await chrome.tabs.sendMessage(tabId, { action: "activate", settings });
  } catch {
    // Restricted page or script already injected — ignore
  }
});

// -- Clean up tab state on navigation / close --------------------

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.storage.session.remove(`tabActive_${tabId}`);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`tabActive_${tabId}`);
});

// -- Message relay from popup to content script ------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== "background") return;
  if (!["activate", "deactivate", "updateSettings"].includes(msg.action)) return;

  handleMessage(msg).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { error: "no active tab" };
  const tabId = tab.id;

  if (msg.action === "activate") {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await chrome.storage.session.set({ [`tabActive_${tabId}`]: true });
    await chrome.tabs.sendMessage(tabId, { action: "activate", settings: msg.settings });
    return { ok: true };
  }

  if (msg.action === "deactivate") {
    await chrome.storage.session.set({ [`tabActive_${tabId}`]: false });
    await chrome.tabs.sendMessage(tabId, { action: "deactivate" }).catch(() => {});
    return { ok: true };
  }

  if (msg.action === "updateSettings") {
    await chrome.tabs.sendMessage(tabId, { action: "updateSettings", settings: msg.settings }).catch(() => {});
    return { ok: true };
  }
}
