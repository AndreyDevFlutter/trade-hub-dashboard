// Intercepta fetch e XHR direto na página para capturar bodies (que webRequest não vê em MV3)
(function () {
  const send = (entry) => {
    try {
      window.postMessage({ __abSniffer: true, entry }, "*");
    } catch (e) {}
  };

  // --- fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input.url;
    const method = (init?.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    let body = init?.body;
    if (body instanceof FormData) {
      const o = {}; body.forEach((v, k) => (o[k] = v)); body = o;
    } else if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    }
    const startedAt = Date.now();
    try {
      const res = await origFetch.apply(this, args);
      const clone = res.clone();
      let respBody = null;
      try { respBody = await clone.text(); try { respBody = JSON.parse(respBody); } catch {} } catch {}
      if (url.includes("actionbroker.app")) {
        send({ kind: "fetch", url, method, requestBody: body, status: res.status, responseBody: respBody, ts: startedAt });
      }
      return res;
    } catch (err) {
      if (url.includes("actionbroker.app")) {
        send({ kind: "fetch", url, method, requestBody: body, error: String(err), ts: startedAt });
      }
      throw err;
    }
  };

  // --- XHR ---
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = "", _method = "GET", _body = null;
    const origOpen = xhr.open;
    const origSend = xhr.send;
    xhr.open = function (method, url) {
      _method = method.toUpperCase();
      _url = url;
      return origOpen.apply(xhr, arguments);
    };
    xhr.send = function (body) {
      _body = body;
      if (typeof _body === "string") { try { _body = JSON.parse(_body); } catch {} }
      xhr.addEventListener("loadend", () => {
        if (_url.includes("actionbroker.app")) {
          let resp = xhr.responseText;
          try { resp = JSON.parse(resp); } catch {}
          send({ kind: "xhr", url: _url, method: _method, requestBody: _body, status: xhr.status, responseBody: resp, ts: Date.now() });
        }
      });
      return origSend.apply(xhr, arguments);
    };
    return xhr;
  }
  window.XMLHttpRequest = PatchedXHR;
})();
