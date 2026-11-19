// Shared map helpers (Leaflet + OpenStreetMap tiles, same stack as fastledchecker.com/map).
import { esc, fmt, thaiDate, daysLeft, discountPct, typeLabel, mapLink } from "./util.js";

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/leaflet";
let leafletP = null;
export function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leafletP ??= new Promise((ok, fail) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET + ".css";
    document.head.append(css);
    const s = document.createElement("script");
    s.src = LEAFLET + ".js";
    s.onload = () => ok(window.L);
    s.onerror = () => fail(new Error("โหลดแผนที่ไม่สำเร็จ"));
    document.head.append(s);
  });
  return leafletP;
}

export function baseMap(L, el, opts = {}) {
  const map = L.map(el, { zoomControl: true, preferCanvas: true, ...opts });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  return map;
}

// Pin color = how soon the auction is. Passed / no date = gray.
export const PIN = { soon: "#d93025", month: "#f29900", later: "#1a73e8", past: "#9aa0a6" };
export function pinKind(it) {
  const d = daysLeft(it.auction_date);
  if (d === null || d < 0) return "past";
  return d <= 7 ? "soon" : d <= 30 ? "month" : "later";
}

// Exact parcel -> solid dot. Tambon-level estimate -> hollow ring (position can be off by km).
export function pinStyle(it) {
  const c = PIN[pinKind(it)];
  return it.geo === "parcel"
    ? { radius: 7, color: "#fff", weight: 1.5, fillColor: c, fillOpacity: 0.95 }
    : { radius: 8, color: c, weight: 2, dashArray: "3 3", fillColor: c, fillOpacity: 0.12 };
}

export function popupHTML(it) {
  const dp = discountPct(it), d = daysLeft(it.auction_date);
  const when = d === null ? "" : d < 0 ? " · ผ่านนัดแล้ว" : ` · อีก ${d} วัน`;
  return `<div class="mpop">
    ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
    <b>${esc(typeLabel[it.type] || "ทรัพย์")}</b>
    <div>${it.subdistrict ? `ต.${esc(it.subdistrict)} ` : ""}${esc(it.district)} · ${esc(it.province)}</div>
    ${it.area ? `<div>${esc(it.area)}</div>` : ""}
    <div>ราคาประเมิน ${fmt(it.appraisal)} บาท</div>
    ${it.start_price ? `<div>ราคาเริ่มต้น <b>${fmt(it.start_price)}</b> บาท${dp ? ` <span class="pill warn">ต่ำกว่าประเมิน ${dp}%</span>` : ""}</div>` : ""}
    <div>นัด ${esc(thaiDate(it.auction_date))}${when}</div>
    ${it.mortgage ? `<div><span class="pill mort">จำนองติดไป</span></div>` : ""}
    ${it.geo === "approx" ? `<div class="hint">ตำแหน่งประมาณระดับตำบล คลาดได้หลาย กม.</div>` : ""}
    <div class="mpop-links"><a href="index.html#id=${encodeURIComponent(it.id)}&p=${encodeURIComponent(it.province)}">รายละเอียด</a>
    <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${it.lat},${it.lon}">Google Maps ↗</a></div>
  </div>`;
}

// Small map used inside the detail dialog.
export async function miniMap(el, it) {
  const L = await ensureLeaflet();
  const map = baseMap(L, el, { scrollWheelZoom: false });
  const ll = [it.lat, it.lon];
  if (it.geo === "parcel") {
    map.setView(ll, 17);
    L.circleMarker(ll, pinStyle(it)).addTo(map);
  } else {
    const c = L.circle(ll, { radius: 2500, color: "#f29900", weight: 2, dashArray: "4 4", fillOpacity: 0.1 }).addTo(map);
    map.fitBounds(c.getBounds());
  }
  setTimeout(() => map.invalidateSize(), 50);
  return map;
}
export { mapLink };
