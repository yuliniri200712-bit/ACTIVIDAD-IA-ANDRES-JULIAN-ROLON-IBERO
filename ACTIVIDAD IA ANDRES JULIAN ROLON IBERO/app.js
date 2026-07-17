// ---------- configuración ----------
// Base de tu Realtime Database. Los datos deben importarse en el nodo "clientes"
// (usa el archivo trendgear_firebase_import.json y en la consola de Firebase
// selecciona ese nodo antes de "Importar JSON").
const FIREBASE_BASE_URL = "https://actividad-ia-default-rtdb.firebaseio.com/";
const FIREBASE_NODE = "clientes";

const TIER_ORDER = ["Bronze", "Silver", "Gold", "Platinum"];
const TIER_CLASS = {
  Bronze: "badge-bronze",
  Silver: "badge-silver",
  Gold: "badge-gold",
  Platinum: "badge-platinum"
};
const TIER_DOT_COLOR = {
  Bronze: "#E8602C",
  Silver: "#8A909C",
  Gold: "#B8862F",
  Platinum: "#1B8A80"
};

// ---------- estado ----------
let clients = [];
let filtered = [];
let sortKey = "Purchase Date";
let sortDir = "desc";

// ---------- utilidades ----------
const currencyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

function formatCurrency(value) {
  return currencyFmt.format(value);
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function setSyncStatus(text) {
  document.getElementById("sync-status").textContent = text;
}

// ---------- carga de datos ----------
async function loadClients() {
  setSyncStatus("Conectando a Firebase…");
  try {
    const res = await fetch(`${FIREBASE_BASE_URL}${FIREBASE_NODE}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data) {
      setSyncStatus("Firebase conectado · nodo \"clientes\" vacío");
      renderEmptyState();
      return;
    }

    clients = Object.values(data);
    setSyncStatus(`Sincronizado · ${clients.length} clientes`);
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);
    setSyncStatus("No se pudo conectar a Firebase");
    renderEmptyState("No se pudieron cargar los datos desde Firebase. Verifica la conexión o el nodo \"clientes\".");
  }
}

function renderEmptyState(message) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = `<tr><td colspan="11" class="empty-row">${message || "Sin datos disponibles."}</td></tr>`;
  document.getElementById("table-count").textContent = "0 clientes";
  ["kpi-total-clientes", "kpi-ingresos", "kpi-ticket", "kpi-edad"].forEach(id => {
    document.getElementById(id).textContent = "—";
  });
  document.getElementById("city-chart").innerHTML = "";
  document.getElementById("tier-chart").innerHTML = "";
}

// ---------- KPIs ----------
function renderKpis(data) {
  const total = data.length;
  const ingresos = data.reduce((sum, c) => sum + Number(c["Amount Spent"] || 0), 0);
  const ticket = total ? ingresos / total : 0;
  const edadProm = total ? data.reduce((sum, c) => sum + Number(c.Age || 0), 0) / total : 0;

  document.getElementById("kpi-total-clientes").textContent = total;
  document.getElementById("kpi-ingresos").textContent = formatCurrency(ingresos);
  document.getElementById("kpi-ticket").textContent = formatCurrency(ticket);
  document.getElementById("kpi-edad").textContent = `${edadProm.toFixed(1)} años`;
}

// ---------- gráfico de ciudades ----------
function renderCityChart(data) {
  const totals = {};
  data.forEach(c => {
    totals[c.City] = (totals[c.City] || 0) + Number(c["Amount Spent"] || 0);
  });

  const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = rows.length ? rows[0][1] : 1;

  const container = document.getElementById("city-chart");
  container.innerHTML = rows.map(([city, amount]) => `
    <div class="bar-row">
      <span class="bar-city">${city}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${max ? (amount / max) * 100 : 0}%"></span></span>
      <span class="bar-amount">${formatCurrency(amount)}</span>
    </div>
  `).join("");
}

// ---------- gráfico de membresía ----------
function renderTierChart(data) {
  const counts = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 };
  data.forEach(c => {
    if (counts[c["Membership Status"]] !== undefined) counts[c["Membership Status"]]++;
  });
  const max = Math.max(...Object.values(counts), 1);

  const container = document.getElementById("tier-chart");
  container.innerHTML = TIER_ORDER.map(tier => `
    <div class="tier-row">
      <span class="tier-dot" style="background:${TIER_DOT_COLOR[tier]}"></span>
      <span class="tier-name">${tier}</span>
      <span class="tier-track"><span class="tier-fill" style="width:${(counts[tier] / max) * 100}%; background:${TIER_DOT_COLOR[tier]}"></span></span>
      <span class="tier-count">${counts[tier]}</span>
    </div>
  `).join("");
}

// ---------- tabla ----------
function renderTable(data) {
  const tbody = document.getElementById("table-body");
  document.getElementById("table-count").textContent = `${data.length} cliente${data.length === 1 ? "" : "s"}`;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-row">No hay clientes que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(c => `
    <tr>
      <td class="mono">${c["Customer ID"]}</td>
      <td>${c.Name}</td>
      <td>${c.Email}</td>
      <td>${c["Product Purchased"]}</td>
      <td>${formatDate(c["Purchase Date"])}</td>
      <td class="num">${formatCurrency(Number(c["Amount Spent"] || 0))}</td>
      <td class="num">${c.Age}</td>
      <td>${c.City}</td>
      <td>${c["Payment Method"]}</td>
      <td>${formatDate(c["Last Login Date"])}</td>
      <td><span class="badge ${TIER_CLASS[c["Membership Status"]] || ""}">${c["Membership Status"]}</span></td>
    </tr>
  `).join("");
}

// ---------- filtros, búsqueda y orden ----------
function applyFiltersAndRender() {
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  const tier = document.getElementById("tier-filter").value;

  filtered = clients.filter(c => {
    const matchesSearch = !search ||
      c.Name.toLowerCase().includes(search) ||
      c.Email.toLowerCase().includes(search) ||
      c.City.toLowerCase().includes(search);
    const matchesTier = !tier || c["Membership Status"] === tier;
    return matchesSearch && matchesTier;
  });

  filtered.sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === "Amount Spent" || sortKey === "Age") {
      va = Number(va); vb = Number(vb);
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  renderKpis(clients);
  renderCityChart(clients);
  renderTierChart(clients);
  renderTable(filtered);
}

// ---------- eventos ----------
document.getElementById("search-input").addEventListener("input", applyFiltersAndRender);
document.getElementById("tier-filter").addEventListener("change", applyFiltersAndRender);
document.getElementById("refresh-btn").addEventListener("click", loadClients);

document.querySelectorAll("#clients-table thead th").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;
    if (sortKey === key) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = "asc";
    }
    applyFiltersAndRender();
  });
});

// ---------- inicio ----------
loadClients();
