/*
 * koeln-barf.de – Daten-Loader
 * ------------------------------------------------------------
 * Liest Öffnungszeiten & aktuelle Menüs aus einem öffentlich
 * veröffentlichten Google Sheet (Datei > Freigeben > Im Web
 * veröffentlichen > CSV). Bis die Sheet-URLs eingetragen sind,
 * werden die Fallback-Daten unten benutzt, damit die Seite auch
 * ohne Sheet funktioniert.
 *
 * EINRICHTEN:
 * 1. Google Sheet mit zwei Tabellenblättern anlegen: "Oeffnungszeiten" und "Menues"
 * 2. Datei > Freigeben > Im Web veröffentlichen > jeweiliges Blatt als CSV
 * 3. Die beiden Links unten bei SHEET_HOURS_CSV / SHEET_MENU_CSV eintragen
 */

const SHEET_HOURS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtGbH2m67RaahadJ9kfbJUhpkSnq4nX3ulCromlhGucbb1YITfKuqT5Qn3NIK6M9riMIw8WoOP-v5R/pub?gid=0&single=true&output=csv";
const SHEET_MENU_CSV  = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtGbH2m67RaahadJ9kfbJUhpkSnq4nX3ulCromlhGucbb1YITfKuqT5Qn3NIK6M9riMIw8WoOP-v5R/pub?gid=1754545929&single=true&output=csv";

// Fallback-Öffnungszeiten (Stand: alte Homepage)
const FALLBACK_HOURS = [
  { tag: "Montag",     von: "",      bis: "",      status: "geschlossen" },
  { tag: "Dienstag",   von: "10:00", bis: "13:00", status: "offen" },
  { tag: "Mittwoch",   von: "10:00", bis: "13:00", status: "offen" },
  { tag: "Donnerstag", von: "10:00", bis: "20:00", status: "offen" },
  { tag: "Freitag",    von: "",      bis: "",      status: "geschlossen" },
  { tag: "Samstag",    von: "",      bis: "",      status: "geschlossen" },
  { tag: "Sonntag",    von: "",      bis: "",      status: "geschlossen" },
];
const FALLBACK_HOURS_NOTE = "In den kompletten Sommer-Schulferien jeden Donnerstag 10:00–20:00 Uhr geöffnet! Kein Futter mehr da? Schreiben Sie uns an kontakt@koeln-barf.de.";

// Fallback-Menüs (Stand: Designvorschlag / letzte bekannte Preise)
const FALLBACK_MENUS = [
  { name: "RIND-Menü",        preis: "ab 5,00 €/kg (bis 500g 5,40 €, 500g–1000g 5,20 €)",  beschreibung: "Mit Gemüse/Salat und Mineralstoffmischung (inkl. Calciumcitrat)" },
  { name: "GEFLÜGEL-Menü",    preis: "ab 5,00 €/kg (bis 500g 5,40 €, 500g–1000g 5,20 €)",  beschreibung: "Mit Gemüse/Salat und Mineralstoffmischung (inkl. Calciumcitrat)" },
  { name: "POWERMIX-Menü",    preis: "ab 5,00 €/kg (bis 500g 5,40 €, 500g–1000g 5,20 €)",  beschreibung: "Mit Gemüse/Salat und Mineralstoffmischung (inkl. Calciumcitrat)" },
  { name: "WELPEN-Rind-Menü", preis: "ab 5,00 €/kg (bis 500g 5,40 €, 500g–1000g 5,20 €)",  beschreibung: "Speziell für Welpen, mit Gemüse/Salat und Mineralstoffmischung" },
  { name: "RIND/FISCH-Menü",  preis: "ab 5,00 €/kg (bis 500g 5,40 €, 500g–1000g 5,20 €)",  beschreibung: "Mit Gemüse/Salat und Mineralstoffmischung (inkl. Calciumcitrat)" },
];
const FALLBACK_MENUS_NOTE = "Preise Stand letzte bekannte Liste – bitte im Zweifel telefonisch bestätigen lassen.";

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ""; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).filter(r => r.some(c => c.trim() !== "")).map(r => {
    const obj = {};
    header.forEach((h, idx) => obj[h] = (r[idx] || "").trim());
    return obj;
  });
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("CSV fetch failed: " + res.status);
  return parseCsv(await res.text());
}

async function loadHours() {
  if (SHEET_HOURS_CSV) {
    try {
      const rows = await fetchCsv(SHEET_HOURS_CSV);
      if (rows.length) {
        return {
          hours: rows.map(r => ({
            tag: r.tag || r.wochentag || "",
            von: r.von || "",
            bis: r.bis || "",
            status: (r.status || "").toLowerCase() || (r.von ? "offen" : "geschlossen"),
          })),
          note: rows[0].hinweis || FALLBACK_HOURS_NOTE,
        };
      }
    } catch (e) { console.warn("Konnte Öffnungszeiten-Sheet nicht laden, nutze Fallback:", e); }
  }
  return { hours: FALLBACK_HOURS, note: FALLBACK_HOURS_NOTE };
}

async function loadMenus() {
  if (SHEET_MENU_CSV) {
    try {
      const rows = await fetchCsv(SHEET_MENU_CSV);
      if (rows.length) {
        return {
          menus: rows.map(r => ({
            name: r.name || "",
            preis: r.preis || "",
            beschreibung: r.beschreibung || r.beschreibung_kurz || "",
          })),
          note: rows[0].hinweis || FALLBACK_MENUS_NOTE,
        };
      }
    } catch (e) { console.warn("Konnte Menü-Sheet nicht laden, nutze Fallback:", e); }
  }
  return { menus: FALLBACK_MENUS, note: FALLBACK_MENUS_NOTE };
}

function currentBerlinDayAndMinutes() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const dayNames = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  return { day: dayNames[now.getDay()], minutes: now.getHours() * 60 + now.getMinutes() };
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function renderHoursWidget(container, { hours, note }, opts = {}) {
  const { day, minutes } = currentBerlinDayAndMinutes();
  const todayEntry = hours.find(h => h.tag === day);

  let isOpenNow = false;
  if (todayEntry && todayEntry.status === "offen") {
    const von = toMinutes(todayEntry.von), bis = toMinutes(todayEntry.bis);
    if (von !== null && bis !== null) isOpenNow = minutes >= von && minutes <= bis;
  }

  const banner = document.createElement("div");
  banner.className = "status-banner " + (isOpenNow ? "status-open" : "status-closed");
  banner.textContent = isOpenNow ? "Jetzt geöffnet" : "Aktuell geschlossen";

  const table = document.createElement("table");
  table.className = "hours-table";
  table.innerHTML = "<tr><th>Tag</th><th>Uhrzeit</th></tr>" + hours.map(h => {
    const isToday = h.tag === day;
    const closed = h.status !== "offen";
    const zeit = closed ? "geschlossen" : `${h.von} – ${h.bis} Uhr`;
    return `<tr class="${isToday ? "today" : ""} ${closed ? "closed" : ""}"><td>${h.tag}</td><td class="status">${zeit}</td></tr>`;
  }).join("");

  container.innerHTML = "";
  if (!opts.hideBanner) container.appendChild(banner);
  container.appendChild(table);
  if (note) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = note;
    container.appendChild(p);
  }
}

function renderMenuGrid(container, { menus, note }) {
  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "menu-grid";
  grid.innerHTML = menus.map(m => `
    <div class="menu-card">
      <h3>${m.name}</h3>
      <div class="price">${m.preis}</div>
      <div class="desc">${m.beschreibung}</div>
    </div>
  `).join("");
  container.appendChild(grid);
  if (note) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = note;
    container.appendChild(p);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const hoursTargets = document.querySelectorAll("[data-hours-widget]");
  if (hoursTargets.length) {
    const data = await loadHours();
    hoursTargets.forEach(t => renderHoursWidget(t, data, { hideBanner: t.dataset.hoursWidget === "compact" }));
  }
  const menuTargets = document.querySelectorAll("[data-menu-widget]");
  if (menuTargets.length) {
    const data = await loadMenus();
    menuTargets.forEach(t => renderMenuGrid(t, data));
  }
});
