// Map page: province bubbles when zoomed out, property pins when zoomed in (or a province is chosen).
// Pins come from data/provinces/<name>.json, loaded on demand. Leaflet is loaded by map.html.
import { $, PROVINCES, esc, fmt, thaiDate, parseDate } from "./util.js";
import { loadMeta, loadStatus, loadProvince, dataAgeDays } from "./data.js";
import { pinStyle, popupHTML } from "./mapkit.js";
import "./modal.js";

const ZOOM_PINS = 9;
const THAILAND = [[5.6, 97.3], [20.5, 105.7]];
const state = { meta: null, items: new Map(), loadedProv: new Set() };
let map, bubbles, pins, markers = new Map(), busy = 0, lastSig = "", lastCount = { n: 0, total: 0 };

const filters = () => ({
  q: $("#q").value.trim(), province: $("#fProvince").value, type: $("#fType").value,
  budget: Number($("#fBudget").value) || 0, when: $("#fWhen").value, geo: $("#fGeo").value,
});

function keep(it, f) {
  if (it.lat == null) return false;
  if (f.province && it.province !== f.province) return false;
  if (f.type && it.type !== f.type) return false;
  if (f.geo && it.geo !== f.geo) return false;
  if (f.budget && !(Number(it.appraisal) <= f.budget)) return false;
  if (f.q && !`${it.subdistrict} ${it.district} ${it.province}`.includes(f.q)) return false;
  if (f.when) {
    const t = parseDate(it.auction_date), now = Date.now();
    if (t === null || t < now - 864e5) return false;
    if (f.when !== "upcoming" && t > now + Number(f.when) * 864e5) return false;
  }
  return true;
}

async function loadProvinces(names) {
  const need = names.filter((n) => !state.loadedProv.has(n));
  if (!need.length) return;
  need.forEach((n) => state.loadedProv.add(n));
  try {
    const lists = await Promise.all(need.map(loadProvince));
    lists.flat().forEach((it) => state.items.set(it.id, it));
  } catch {
    need.forEach((n) => state.loadedProv.delete(n));
    $("#mapNotice").textContent = "โหลดข้อมูลจังหวัดไม่สำเร็จ";
  }
}

// provinces worth loading for the current view: the chosen one, or those whose center is near the view center
function provincesInView(f) {
  if (f.province) return [f.province];
  const c = map.getCenter();
  return state.meta.provinces.filter((p) => p.center && Math.hypot(p.center[0] - c.lat, p.center[1] - c.lng) < 2.5).map((p) => p.name);
}

function drawBubbles() {
  bubbles.clearLayers();
  const max = Math.max(1, ...state.meta.provinces.map((p) => p.geo_parcel + p.geo_approx));
  state.meta.provinces.filter((p) => p.center && p.geo_parcel + p.geo_approx > 0).forEach((p) => {
    const n = p.geo_parcel + p.geo_approx;
    const size = 34 + 34 * Math.sqrt(n / max);
    const icon = L.divIcon({ className: "bubble", html: `<span style="width:${size}px;height:${size}px"><b>${fmt(n)}</b></span>`, iconSize: [size, size] });
    L.marker(p.center, { icon, title: `${p.name}: ${fmt(n)} รายการที่มีพิกัด` })
      .on("click", () => { $("#fProvince").value = p.name; refresh(true); })
      .addTo(bubbles);
  });
}

function drawPins(f) {
  pins.clearLayers();
  markers = new Map();
  let n = 0, total = 0;
  for (const it of state.items.values()) {
    if (f.province && it.province !== f.province) continue;
    total++;
    if (!keep(it, f)) continue;
    const st = pinStyle(it);
    const m = L.circleMarker([it.lat, it.lon], { ...st, baseRadius: st.radius }).bindPopup(() => popupHTML(it), { maxWidth: 260 });
    m.addTo(pins);
    markers.set(it.id, m);
    n++;
  }
  return { n, total };
}

async function refresh(fit = false) {
  const f = filters(), run = ++busy;
  const pinMode = !!f.province || !!f.q || map.getZoom() >= ZOOM_PINS;
  if (pinMode) await loadProvinces(f.q && !f.province ? state.meta.provinces.map((p) => p.name) : provincesInView(f));
  if (run !== busy) return;
  if (pinMode) {
    map.removeLayer(bubbles); pins.addTo(map);
    const sig = JSON.stringify(f) + state.items.size;
    if (sig !== lastSig) { lastSig = sig; lastCount = drawPins(f); }  // keeps an open popup when only the view moved
    markers.forEach((m) => m.setRadius(map.getZoom() < 11 ? 4 : m.options.baseRadius));
    const { n, total } = lastCount;
    $("#mapCount").textContent = `แสดง ${fmt(n)} หมุด จาก ${fmt(total)} รายการที่โหลดแล้ว`;
    if (fit && n) {
      const b = L.latLngBounds([...markers.values()].map((m) => m.getLatLng()));
      map.fitBounds(b.pad(0.15), { maxZoom: 15 });
    }
  } else {
    map.removeLayer(pins); bubbles.addTo(map); lastSig = "";
    const all = state.meta.provinces.reduce((s, p) => s + p.geo_parcel + p.geo_approx, 0);
    $("#mapCount").textContent = `ทรัพย์ที่มีพิกัด ${fmt(all)} จาก ${fmt(state.meta.total)} รายการ · กดฟองหรือซูมเข้าเพื่อดูหมุด`;
  }
}

function openFromHash() {
  const m = location.hash.match(/^#p=([^&]*)(?:&id=(.+))?$/);
  if (!m) return Promise.resolve();
  const prov = decodeURIComponent(m[1]), id = m[2] ? decodeURIComponent(m[2]) : "";
  $("#fProvince").value = prov;
  return refresh(!id).then(() => {
    const mk = markers.get(id);
    if (!mk) return;
    map.setView(mk.getLatLng(), 17);
    mk.openPopup();
  });
}

function init(meta, status) {
  state.meta = meta;
  $("#fProvince").innerHTML = '<option value="">ทุกจังหวัด</option>' +
    PROVINCES.filter((p) => meta.provinces.some((x) => x.name === p && x.geo_parcel + x.geo_approx > 0)).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  const age = dataAgeDays(meta);
  let note = `ข้อมูล ณ ${thaiDate(meta.updated)} · จากกรมบังคับคดี ตำแหน่งจากกรมที่ดิน`;
  if (age !== null && age > 8) note += ` · ⚠ ข้อมูลเก่า ${age} วัน วันนัดอาจผ่านไปแล้ว`;
  if (status && status.result === "failed") note += " · ⚠ อัปเดตรอบล่าสุดไม่สำเร็จ ใช้ข้อมูลเดิม";
  $("#mapNotice").textContent = note;

  map = L.map("map", { preferCanvas: true, zoomControl: true });
  map.invalidateSize();
  map.fitBounds(THAILAND);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  bubbles = L.layerGroup().addTo(map);
  pins = L.layerGroup();
  drawBubbles();

  let t;
  map.on("zoomend moveend", () => { clearTimeout(t); t = setTimeout(() => refresh(false), 250); });
  ["fProvince", "fType", "fBudget", "fWhen", "fGeo"].forEach((id) => $("#" + id).addEventListener("change", () => refresh(true)));
  $("#mapForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#q").value.trim();
    const hit = state.meta.provinces.filter((p) => q && p.name.includes(q));
    if (hit.length === 1) { $("#fProvince").value = hit[0].name; $("#q").value = ""; }
    refresh(true);
  });
  $("#locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => map.flyTo([p.coords.latitude, p.coords.longitude], 12), () => { $("#mapCount").textContent = "เข้าถึงตำแหน่งของคุณไม่ได้"; });
  });
  const toggle = $("#menuToggle"), nav = $("#mainNav");
  toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", String(nav.classList.toggle("open"))));
  window.addEventListener("hashchange", openFromHash);
  return openFromHash().then(() => { if (!location.hash) refresh(false); });
}

Promise.all([loadMeta(), loadStatus()]).then(([m, s]) => init(m, s)).catch(() => {
  $("#mapNotice").textContent = "โหลดข้อมูลไม่สำเร็จ (ต้องเปิดผ่านเซิร์ฟเวอร์ และต่ออินเทอร์เน็ตเพื่อโหลดแผนที่)";
});
