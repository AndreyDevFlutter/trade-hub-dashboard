// Service worker: armazena últimas 100 requisições no chrome.storage
const MAX = 100;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "ab_request") return;
  chrome.storage.local.get({ entries: [] }, ({ entries }) => {
    entries.unshift(msg.entry);
    if (entries.length > MAX) entries.length = MAX;
    chrome.storage.local.set({ entries });
    // Badge com contador
    chrome.action.setBadgeText({ text: String(entries.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  });
});
