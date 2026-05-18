// Roda no MAIN world (configurado no manifest) — então pode patchear fetch/XHR diretamente
(function () {
  if (window.__abSnifferInstalled) return;
  window.__abSnifferInstalled = true;

  const post = (entry) => window.postMessage({ __abSniffer: true, entry }, "*");

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = (init?.method || (typeof input !== "string" && input?.method) || "GET").toUpperCase();
    let body = init?.body;
    if (body instanceof FormData) { const o = {}; body.forEach((v, k) => (o[k] = v)); body = o; }
    else if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }
    const ts = Date.now();
    try {
      const res = await origFetch.call(this, input, init);
      if (url.includes("actionbroker.app")) {
        let respBody = null;
        try { respBody = await res.clone().text(); try { respBody = JSON.parse(respBody); } catch {} } catch {}
        post({ kind: "fetch", url, method, requestBody: body, status: res.status, responseBody: respBody, ts });
      }
      return res;
    } catch (err) {
      if (url.includes("actionbroker.app")) post({ kind: "fetch", url, method, requestBody: body, error: String(err), ts });
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
      _body = b;
      if (typeof _body === "string") { try { _body = JSON.parse(_body); } catch {} }
      xhr.addEventListener("loadend", () => {
        if (_url.includes("actionbroker.app")) {
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
