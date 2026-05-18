// Service worker: armazena últimas 100 requisições no chrome.storage
const MAX = 100;

function saveEntry(entry) {
  chrome.storage.local.get({ entries: [] }, ({ entries }) => {
    entries.unshift(entry);
    if (entries.length > MAX) entries.length = MAX;
    chrome.storage.local.set({ entries });
    chrome.action.setBadgeText({ text: String(entries.length) });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "ab_request") return;
  saveEntry(msg.entry);
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    let requestBody = null;
    const raw = details.requestBody?.raw?.[0]?.bytes;
    const formData = details.requestBody?.formData;

    if (raw) {
      try {
        const text = new TextDecoder("utf-8").decode(raw);
        try { requestBody = JSON.parse(text); } catch { requestBody = text; }
      } catch {
        requestBody = "[corpo não legível]";
      }
    } else if (formData) {
      requestBody = formData;
    }

    saveEntry({
      kind: "webRequest",
      url: details.url,
      method: details.method,
      requestBody,
      status: "capturado",
      ts: Date.now(),
    });
  },
  { urls: ["https://*.actionbroker.app/*"] },
  ["requestBody"]
);
});
