const listEl = document.getElementById("list");
const filterEl = document.getElementById("filter");
let allEntries = [];

function render() {
  const q = filterEl.value.trim().toLowerCase();
  const filtered = allEntries.filter((e) => {
    if (!q) return true;
    return (e.url + " " + e.method + " " + JSON.stringify(e.requestBody || "")).toLowerCase().includes(q);
  });
  if (!filtered.length) { listEl.innerHTML = '<div class="empty">Nenhuma requisição. Abra trade.actionbroker.app e interaja com o site.</div>'; return; }
  listEl.innerHTML = filtered.map((e, i) => `
    <div class="entry ${e.method === 'POST' ? 'post' : ''}">
      <div class="row">
        <span class="method ${e.method}">${e.method}</span>
        <span class="kind">${escapeHtml(e.kind || '')}</span>
        <span class="url">${escapeHtml(e.url)}</span>
        <span class="status">${e.status || ''}</span>
      </div>
      ${e.requestBody ? `<div class="label">Request Body</div><pre>${escapeHtml(JSON.stringify(e.requestBody, null, 2))}</pre>` : ''}
      ${e.responseBody ? `<div class="label">Response</div><pre>${escapeHtml(typeof e.responseBody === 'string' ? e.responseBody.slice(0, 800) : JSON.stringify(e.responseBody, null, 2).slice(0, 1200))}</pre>` : ''}
    </div>
  `).join("");
}

function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function load() {
  chrome.storage.local.get({ entries: [] }, ({ entries }) => { allEntries = entries; render(); });
}

document.getElementById("clear").onclick = () => {
  chrome.storage.local.set({ entries: [] }, () => { chrome.action.setBadgeText({ text: "" }); load(); });
};
document.getElementById("copy").onclick = () => {
  navigator.clipboard.writeText(JSON.stringify(allEntries, null, 2));
  alert("Copiado " + allEntries.length + " requisições!");
};
filterEl.oninput = render;

chrome.storage.onChanged.addListener(load);
load();
