/* ============================================================
   background.js — Service Worker for Alienisierung Extension
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("alienSettings", (result) => {
    if (!result.alienSettings) {
      chrome.storage.sync.set({ alienSettings: DEFAULT_SETTINGS });
    }
  });
});

// -- Auto-activate on page load ----------------------------------

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))) return;

  chrome.storage.sync.get("alienSettings", (result) => {
    const settings = result.alienSettings || DEFAULT_SETTINGS;
    if (!settings.autoActivate) return;

    // Only auto-inject if the user has granted host permissions
    chrome.permissions.contains({ origins: ["<all_urls>"] }, (granted) => {
      if (!granted) return;

      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      }, () => {
        if (chrome.runtime.lastError) return; // ignore errors on restricted pages
        chrome.storage.session.set({ [`tabActive_${tabId}`]: true });
        chrome.tabs.sendMessage(tabId, { action: "activate", settings }).catch(() => {});
      });
    });
  });
});

// -- Clean up tab state on navigation / close --------------------

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    // Content script is gone after navigation — clear active state
    chrome.storage.session.remove(`tabActive_${tabId}`);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`tabActive_${tabId}`);
});

// -- Message relay from popup to content script ------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== "background") return;

  if (msg.action === "activate" || msg.action === "deactivate" || msg.action === "updateSettings") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;

      if (msg.action === "activate") {
        // Inject content script first, then send activate
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          chrome.storage.session.set({ [`tabActive_${tabId}`]: true });
          chrome.tabs.sendMessage(tabId, { action: "activate", settings: msg.settings }).catch(() => {});
          sendResponse({ ok: true });
        });
      } else if (msg.action === "deactivate") {
        chrome.storage.session.set({ [`tabActive_${tabId}`]: false });
        chrome.tabs.sendMessage(tabId, { action: "deactivate" }).catch(() => {});
        sendResponse({ ok: true });
      } else if (msg.action === "updateSettings") {
        chrome.tabs.sendMessage(tabId, { action: "updateSettings", settings: msg.settings }).catch(() => {});
        sendResponse({ ok: true });
      }
    });
    return true; // async response
  }
});
