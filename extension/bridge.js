// Bridge: roda no isolated world, escuta eventos do patcher e envia ao background
document.addEventListener("__abSnifferEvent", (e) => {
  try {
    chrome.runtime.sendMessage({ type: "ab_request", entry: e.detail });
  } catch (err) {}
});
