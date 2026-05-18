// Roda no MAIN world (configurado no manifest) — então pode patchear fetch/XHR diretamente
(function () {
  if (window.__abSnifferInstalled) return;
  window.__abSnifferInstalled = true;

  const isActionBrokerUrl = (url) => {
    try {
      const parsed = new URL(String(url), location.href);
      return parsed.hostname === "actionbroker.app" || parsed.hostname.endsWith(".actionbroker.app");
    } catch {
      return String(url || "").includes("actionbroker.app");
    }
  };

  const normalizeBody = (body) => {
    if (!body) return null;
    if (body instanceof FormData) { const o = {}; body.forEach((v, k) => (o[k] = String(v))); return o; }
    if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
    if (typeof body === "string") { try { return JSON.parse(body); } catch { return body; } }
    return body;
  };

  const post = (entry) => window.postMessage({ __abSniffer: true, entry }, "*");

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || (typeof input !== "string" && input?.method) || "GET").toUpperCase();
    const body = normalizeBody(init?.body || (typeof input !== "string" && input?.body));
    const ts = Date.now();
    try {
      const res = await origFetch.call(this, input, init);
      if (isActionBrokerUrl(url)) {
        let respBody = null;
        try { respBody = await res.clone().text(); try { respBody = JSON.parse(respBody); } catch {} } catch {}
        post({ kind: "fetch", url, method, requestBody: body, status: res.status, responseBody: respBody, ts });
      }
      return res;
    } catch (err) {
      if (isActionBrokerUrl(url)) post({ kind: "fetch", url, method, requestBody: body, error: String(err), ts });
      throw err;
    }
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    let _url = "", _method = "GET", _body = null;
    const origOpen = xhr.open, origSend = xhr.send;
    xhr.open = function (m, u) { _method = m.toUpperCase(); _url = u; return origOpen.apply(xhr, arguments); };
    xhr.send = function (b) {
      _body = normalizeBody(b);
      xhr.addEventListener("loadend", () => {
        if (isActionBrokerUrl(_url)) {
          let resp = xhr.responseText; try { resp = JSON.parse(resp); } catch {}
          post({ kind: "xhr", url: _url, method: _method, requestBody: _body, status: xhr.status, responseBody: resp, ts: Date.now() });
        }
      });
      return origSend.apply(xhr, arguments);
    };
    return xhr;
  };

  // Bridge para o isolated world enviar ao background
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || !e.data.__abSniffer) return;
    // Re-dispatch via custom event para o content script isolado captar
    document.dispatchEvent(new CustomEvent("__abSnifferEvent", { detail: e.data.entry }));
  });

  console.log("%c[ActionBroker Sniffer] ATIVO", "color:#10b981;font-weight:bold");
})();
