// LED Asset Finder main page. Data: data/meta.json + data/provinces/<name>.json (built weekly by pipeline/).
// Follow list, demo account and alerts live in this browser (localStorage) only.
import { $, $$, PROVINCES, typeLabel, fmt, esc, short, parseDate, thaiDate, daysLeft, discountPct, SIGNALS, mapLink } from "./util.js";
import { store, getFollows, isFollowed, toggleFollow } from "./store.js";
import { openModal, closeModal } from "./modal.js";
import { loadMeta, loadStatus, loadProvince, loadAll, dataAgeDays } from "./data.js";
import { miniMap } from "./mapkit.js";

const state = { meta: { provinces: [] }, byId: new Map(), type: "", shown: 10, filtered: [] };
const listings = () => [...state.byId.values()];

async function ensureLoaded(province) {
  const items = province ? await loadProvince(province) : await loadAll();
  items.forEach((it) => state.byId.set(it.id, it));
}

// ---- follow / account / alerts ------------------------------------------------
function refreshFollowUI() {
  $$(".heart").forEach((b) => {
    const on = isFollowed(b.dataset.id);
    b.classList.toggle("on", on);
    b.textContent = on ? "♥" : "♡";
    b.setAttribute("aria-pressed", String(on));
  });
  $$("[data-follow-count]").forEach((e) => (e.textContent = getFollows().length || ""));
  const dbtn = $("#detailFollow");
  if (dbtn) dbtn.textContent = isFollowed(dbtn.dataset.id) ? "♥ ติดตามอยู่ (กดเพื่อเลิกติดตาม)" : "♡ ติดตามทรัพย์นี้";
}
function refreshAccountUI() {
  const u = store.get("user", null);
  $("#loginBtn").textContent = u ? `สวัสดี ${u.name}` : "เข้าสู่ระบบ";
  $("#loginBtn").dataset.action = u ? "account" : "login";
  $("#signupBtn").textContent = u ? "ออกจากระบบ" : "สมัครฟรี →";
  $("#signupBtn").dataset.action = u ? "logout" : "signup";
}

function authModal(mode) {
  const signup = mode === "signup";
  openModal(signup ? "สมัครสมาชิก (ทดลอง)" : "เข้าสู่ระบบ (ทดลอง)", `
    <form id="authForm" class="mform">
      <p class="hint">ระบบบัญชีอยู่ในช่วงทดลอง บันทึกชื่อและอีเมลไว้ในเบราว์เซอร์ของคุณเท่านั้น ไม่มีรหัสผ่านและไม่ส่งไปเซิร์ฟเวอร์ใด เปลี่ยนเครื่องหรือล้างข้อมูลเบราว์เซอร์แล้วจะหาย</p>
      <label>ชื่อที่แสดง<input name="name" required maxlength="30" placeholder="เช่น สมชาย"></label>
      <label>อีเมล (ใช้เมื่อตั้งแจ้งเตือน)<input name="email" type="email" required placeholder="name@example.com"></label>
      <button class="btn-primary" type="submit">${signup ? "สมัครฟรี" : "เข้าสู่ระบบ"}</button>
      <p class="hint">${signup ? "มีบัญชีแล้ว? " : "ยังไม่มีบัญชี? "}<a href="#" class="link" data-action="${signup ? "login" : "signup"}">${signup ? "เข้าสู่ระบบ" : "สมัครฟรี"}</a></p>
    </form>`);
  $("#authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    store.set("user", { name: String(f.get("name")).trim(), email: String(f.get("email")).trim() });
    refreshAccountUI();
    closeModal();
  });
}

const SIGNAL_LABEL = { discount: "ต่ำกว่าราคาประเมิน", nomort: "ไม่ติดจำนอง", parcel: "มีพิกัดแปลง", new: "ใหม่รอบนี้" };
function currentFilters() {
  return { province: $("#provinceSelect").value, type: state.type, budget: $("#budgetSelect").value, date: $("#dateSelect").value, signal: $("#signalSelect").value };
}
function describeFilters(f) {
  const parts = [f.province || "ทุกจังหวัด", f.type ? typeLabel[f.type] : "ทุกประเภท"];
  if (f.budget) parts.push(`≤ ${fmt(f.budget)} บาท`);
  if (f.date) parts.push(`นัดภายใน ${f.date} วัน`);
  if (f.signal) parts.push(SIGNAL_LABEL[f.signal]);
  return parts.join(" · ");
}
function alertModal() {
  const user = store.get("user", null);
  const alerts = store.get("alerts", []);
  openModal("ตั้งแจ้งเตือนทรัพย์ใหม่ (ทดลอง)", `
    <p>บันทึกเงื่อนไขการค้นหาปัจจุบัน:</p>
    <p class="chipline"><b>${esc(describeFilters(currentFilters()))}</b></p>
    <form id="alertForm" class="mform">
      <label>อีเมลสำหรับรับแจ้งเตือน<input name="email" type="email" required value="${esc(user ? user.email : "")}" placeholder="name@example.com"></label>
      <button class="btn-primary" type="submit">บันทึกเงื่อนไข</button>
      <p class="hint">ช่วงทดลอง: เงื่อนไขเก็บในเบราว์เซอร์นี้ ยังไม่มีระบบส่งอีเมลจริง (ต้องมีเซิร์ฟเวอร์ก่อน)</p>
    </form>
    <h4>เงื่อนไขที่บันทึกไว้ (${alerts.length})</h4>
    <ul class="plain">${alerts.map((a, i) => `<li>${esc(describeFilters(a.f))} <small>→ ${esc(a.email)}</small> <button class="x" data-del-alert="${i}" aria-label="ลบ">✕</button></li>`).join("") || "<li class='hint'>ยังไม่มี</li>"}</ul>`);
  $("#alertForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = store.get("alerts", []);
    a.push({ f: currentFilters(), email: new FormData(e.target).get("email") });
    store.set("alerts", a);
    alertModal();
  });
}

async function followModal() {
  await ensureLoaded("");
  const items = getFollows().map((id) => state.byId.get(id)).filter(Boolean)
    .sort((a, b) => (parseDate(a.auction_date) ?? 9e15) - (parseDate(b.auction_date) ?? 9e15));
  openModal(`ทรัพย์ที่ติดตาม (${items.length})`, items.length ? `
    <p class="hint">เรียงตามวันนัดขายที่ใกล้ที่สุด</p>
    <ul class="plain follow-list">${items.map((it) => {
      const d = daysLeft(it.auction_date);
      const tag = d === null ? "" : d < 0 ? "ผ่านนัดแล้ว" : d <= 7 ? `<b class="urgent">อีก ${d} วัน</b>` : `อีก ${d} วัน`;
      return `<li><a href="#" data-detail="${esc(it.id)}"><b>${esc(it.title)}</b></a><span>${esc(it.province)} · ${esc(it.district)} · นัด ${esc(thaiDate(it.auction_date))} ${tag}</span><span>ประเมิน ${fmt(it.appraisal)} บาท</span><button class="x" data-unfollow="${esc(it.id)}" aria-label="เลิกติดตาม">✕</button></li>`;
    }).join("")}</ul>
    <h4>Checklist ก่อนเคาะ</h4>
    <ul class="plain check"><li>ตรวจประกาศฉบับจริงที่ asset.led.go.th</li><li>ดูทรัพย์จริงและถามผู้ครอบครอง</li><li>ตรวจภาระจำนองและสิทธิติดไป</li><li>เตรียมหลักประกันและเอกสาร</li><li>ตั้งเพดานราคาของตัวเอง</li></ul>`
    : `<p>ยังไม่ได้ติดตามทรัพย์ใด กดไอคอน ♡ บนการ์ดทรัพย์เพื่อเพิ่ม</p>`);
}

async function detailModal(id, province = "") {
  if (!state.byId.has(id)) await ensureLoaded(province).catch(() => {});
  const it = state.byId.get(id);
  if (!it) return;
  const dp = discountPct(it), d = daysLeft(it.auction_date);
  openModal(it.title, `
    <div class="detail-head"><span class="pill">${esc(typeLabel[it.type] || it.type)}</span>${it.new ? `<span class="pill new">ใหม่รอบนี้</span>` : ""}${it.changed === "price" ? `<span class="pill warn">ราคาเปลี่ยน</span>` : it.changed === "date" ? `<span class="pill warn">วันนัดเปลี่ยน</span>` : ""}${dp ? `<span class="pill warn">ต่ำกว่าประเมิน ${dp}%</span>` : ""}</div>
    <dl class="kv">
      <dt>ที่ตั้ง</dt><dd>${it.subdistrict ? `ต.${esc(it.subdistrict)} ` : ""}${esc(it.district)} · ${esc(it.province)}</dd>
      ${it.area ? `<dt>เนื้อที่</dt><dd>${esc(it.area)}</dd>` : ""}
      ${it.sale_type ? `<dt>เงื่อนไขขาย</dt><dd>${esc(it.sale_type)}</dd>` : ""}
      <dt>ราคาประเมิน</dt><dd>${fmt(it.appraisal)} บาท</dd>
      ${it.start_price ? `<dt>ราคาเริ่มต้น</dt><dd><b>${fmt(it.start_price)} บาท</b></dd>` : ""}
      <dt>นัดขาย</dt><dd>${esc(thaiDate(it.auction_date))}${it.round ? ` (นัด ${esc(it.round)})` : ""}${d !== null && d >= 0 ? ` · อีก ${d} วัน` : ""}${d !== null && d < 0 ? ` · <b class="urgent">ผ่านนัดแล้ว (ข้อมูลอาจเก่า)</b>` : ""}</dd>
      ${it.deposit ? `<dt>หลักประกัน</dt><dd>${fmt(it.deposit)} บาท</dd>` : ""}
      ${it.office ? `<dt>สำนักงาน</dt><dd>${esc(it.office)}</dd>` : ""}
      <dt>รหัสรายการ</dt><dd>${esc(it.id)}</dd>
    </dl>
    ${it.lat ? `<div class="mini-map" id="miniMap" role="img" aria-label="แผนที่ตำแหน่งทรัพย์"></div>
      <p class="hint">${it.geo === "parcel" ? "หมุดคือตำแหน่งแปลงจากกรมที่ดิน" : "วงกลมคือบริเวณประมาณระดับตำบล ตำแหน่งจริงอาจคลาดหลาย กม."} · ${it.lat}, ${it.lon} ·
      <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${it.lat},${it.lon}">Google Maps ↗</a> ·
      <a class="link" href="${mapLink(it.id, it.province)}">ดูบนแผนที่ใหญ่</a></p>` : `<p class="hint">ยังไม่มีพิกัดของทรัพย์นี้</p>`}
    ${it.mortgage ? `<p class="warnbox">ทรัพย์นี้ขายแบบ "การจำนองติดไป" ผู้ซื้อต้องรับภาระจำนองเพิ่มจากราคาเริ่มต้น เว็บนี้ยังไม่มียอดหนี้ จึงไม่คำนวณส่วนลด ตรวจยอดหนี้จากประกาศก่อนเคาะ</p>` : ""}
    ${it.image ? `<img class="detail-img" src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
    <p class="hint">ก่อนตัดสินใจควรตรวจประกาศและเงื่อนไขกับกรมบังคับคดีทุกครั้ง</p>
    <div class="detail-actions">
      <button class="btn-primary" id="detailFollow" data-id="${esc(it.id)}"></button>
      <a class="btn-outline" target="_blank" rel="noopener" href="https://asset.led.go.th/newbidreg/">เปิดเว็บกรมบังคับคดี ↗</a>
    </div>`);
  $("#detailFollow").addEventListener("click", () => { toggleFollow(it.id); refreshFollowUI(); });
  refreshFollowUI();
  if (it.lat) miniMap($("#miniMap"), it).catch(() => { $("#miniMap").textContent = "โหลดแผนที่ไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต)"; });
}

function allProvincesModal() {
  const counts = countByProvince();
  openModal("ทุกจังหวัด", `<div class="provinces all">${PROVINCES.map((p) => `<button type="button" class="prov" data-province="${esc(p)}"><b>${esc(p)}</b><span>${fmt(counts[p] || 0)} รายการ</span></button>`).join("")}</div>`);
}

function guideModal() {
  openModal("คู่มืออ่านก่อนประมูล", `
    <ol class="guide">
      <li><b>รู้จักประเภทการขาย</b> ทรัพย์บังคับคดีขายทอดตลาดเป็นนัด ๆ ราคาเริ่มต้นอาจลดลงในนัดถัด ๆ ไป</li>
      <li><b>ตรวจเอกสารสิทธิ์</b> ดูโฉนด/น.ส.3 ที่ตั้ง เนื้อที่ และภาระผูกพันในประกาศ</li>
      <li><b>ดูทรัพย์จริง</b> ไปดูพื้นที่ ทางเข้าออก สภาพ และถามผู้ครอบครอง</li>
      <li><b>เตรียมหลักประกัน</b> วางเงินตามที่ประกาศกำหนดก่อนเข้าประมูล</li>
      <li><b>ตั้งเพดานราคา</b> รวมค่าซ่อม ค่าโอน ภาษี และส่วนเผื่อกำไรก่อนวันนัด</li>
      <li><b>หลังชนะการประมูล</b> ชำระเงินและโอนกรรมสิทธิ์ภายในเวลาที่กำหนด</li>
    </ol>
    <p class="hint">สรุปภาพรวมเบื้องต้นเท่านั้น ไม่ใช่คำแนะนำทางกฎหมาย รายละเอียดจริงดูที่กรมบังคับคดี</p>`);
}

function videoModal() {
  openModal("ใช้งานยังไง", `<ol class="guide"><li>เลือกประเภทและจังหวัดที่สนใจ</li><li>ตั้งงบและช่วงวันนัดขาย แล้วกด "ค้นหาทรัพย์"</li><li>กดการ์ดเพื่อดูรายละเอียดและแผนที่ กด ♡ เพื่อติดตาม</li><li>เปิดเมนู "แผนที่" เพื่อดูหมุดทรัพย์ทั้งหมด</li></ol><p class="hint">ยังไม่มีวิดีโอจริง ใช้ขั้นตอนสั้น ๆ นี้แทน</p>`);
}

function infoModal(kind) {
  const t = {
    privacy: ["นโยบายความเป็นส่วนตัว", "เว็บนี้เก็บเฉพาะข้อมูลในเบราว์เซอร์ของคุณ (รายการที่ติดตาม ชื่อ อีเมล เงื่อนไขแจ้งเตือน) ไม่มีการส่งออกไปเซิร์ฟเวอร์ และไม่มีคุกกี้โฆษณา ข้อมูลทรัพย์ไม่มีชื่อคู่ความหรือผู้ถือกรรมสิทธิ์"],
    terms: ["ข้อกำหนดการใช้งาน", "ข้อมูลในเว็บนี้ใช้เพื่อการค้นหาเบื้องต้น ไม่รับประกันความถูกต้องหรือความเป็นปัจจุบัน ผู้ใช้ต้องตรวจสอบกับกรมบังคับคดีก่อนตัดสินใจทุกครั้ง"],
    contact: ["ติดต่อเรา", "ช่องทางติดต่อยังไม่เปิดใช้งาน (เว็บนี้อยู่ระหว่างพัฒนา)"],
    about: ["แหล่งที่มาของข้อมูล", `ต้นทางคือประกาศขายทอดตลาดของกรมบังคับคดี (asset.led.go.th) เก็บเป็นรอบและประมวลผลทุกสัปดาห์ ข้อมูล ณ ${thaiDate(state.meta.updated)} ตำแหน่งบนแผนที่มาจากกรมที่ดิน (แปลง) หรือประมาณระดับตำบล`],
  }[kind];
  openModal(t[0], `<p>${esc(t[1])}</p>`);
}

// ---- rendering ------------------------------------------------------------------
function cardHTML(it) {
  const dp = discountPct(it);
  return `
    <article class="card" data-detail="${esc(it.id)}" tabindex="0">
      <div class="thumb" role="img" aria-label="ภาพตัวอย่าง">
        ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <div class="tags">${it.new ? `<span class="pill new">ใหม่</span>` : ""}${it.mortgage ? `<span class="pill mort">จำนองติดไป</span>` : ""}${it.geo === "parcel" ? `<span class="pill pin-ok">📍 มีพิกัด</span>` : ""}${dp ? `<span class="pill warn">ต่ำกว่าประเมิน ${dp}%</span>` : ""}</div>
        <button type="button" class="heart" data-id="${esc(it.id)}" aria-label="ติดตามทรัพย์" aria-pressed="false">♡</button>
        ${esc(typeLabel[it.type] || "ทรัพย์")}
      </div>
      <div class="card-body">
        <h3>${esc(it.district)} ${esc(it.province)}</h3>
        <div class="meta">${esc(typeLabel[it.type] || it.type)}${it.area ? ` · ${esc(it.area)}` : ""}</div>
        <div class="meta">ประเมิน ${esc(short(Number(it.appraisal)))}${it.round ? ` · นัด ${esc(it.round)}` : ""}</div>
      </div>
      <div class="card-foot">
        <span>${esc(thaiDate(it.auction_date))}${(daysLeft(it.auction_date) ?? 0) < 0 ? ' <em class="past">ผ่านนัดแล้ว</em>' : ""}</span>
        <span class="price">${fmt(it.start_price || it.appraisal)}<small>บาท</small></span>
      </div>
    </article>`;
}

function render() {
  const items = state.filtered;
  $("#cards").innerHTML = items.slice(0, state.shown).map(cardHTML).join("");
  $("#resultCount").textContent = `${fmt(items.length)} รายการ`;
  $("#empty").hidden = items.length > 0;
  const more = $("#moreBtn");
  more.hidden = items.length <= state.shown;
  more.textContent = `แสดงเพิ่ม (เหลือ ${fmt(items.length - state.shown)} รายการ)`;
  refreshFollowUI();
}

function countByProvince() {
  return Object.fromEntries(state.meta.provinces.map((p) => [p.name, p.count]));
}
function renderProvinceGrid() {
  const counts = countByProvince();
  const top = [...PROVINCES].sort((a, b) => (counts[b] || 0) - (counts[a] || 0)).slice(0, 12);
  $("#provinceGrid").innerHTML = top.map((p) => `<button type="button" class="prov" data-province="${esc(p)}"><b>${esc(p)}</b><span>${fmt(counts[p] || 0)} รายการ</span></button>`).join("");
  $("#footProvinces").innerHTML = top.slice(0, 5).map((p) => `<li><a href="#area=${encodeURIComponent(p)}" data-province="${esc(p)}">${esc(p)}</a></li>`).join("");
}

let filterRun = 0;
async function applyFilters(resetPage = true) {
  const f = currentFilters();
  const run = ++filterRun;
  try { await ensureLoaded(f.province); } catch { $("#dataNotice").textContent = "โหลดข้อมูลจังหวัดนี้ไม่สำเร็จ"; return; }
  if (run !== filterRun) return;
  const budget = Number(f.budget) || 0, days = Number(f.date) || 0, now = Date.now();
  state.filtered = listings().filter((it) => {
    if (f.province && it.province !== f.province) return false;
    if (f.type && it.type !== f.type) return false;
    if (f.signal && !SIGNALS[f.signal](it)) return false;
    if (budget && !(Number(it.appraisal) <= budget)) return false;
    if (days) {
      const t = parseDate(it.auction_date);
      if (t === null || t < now - 864e5 || t > now + days * 864e5) return false;
    }
    return true;
  }).sort((a, b) => {
    const ta = parseDate(a.auction_date), tb = parseDate(b.auction_date);
    const fa = ta !== null && ta >= now - 864e5, fb = tb !== null && tb >= now - 864e5;
    if (fa !== fb) return fa ? -1 : 1;
    if (fa) return ta - tb;
    return (tb ?? 0) - (ta ?? 0);
  });
  if (resetPage) state.shown = 10;
  $("#resultTitle").textContent = f.province ? `ทรัพย์ใน${f.province}` : "รายการทรัพย์ทั้งหมด";
  const first = state.filtered[0];
  $("#previewType").textContent = first ? typeLabel[first.type] || "ทรัพย์" : "";
  $("#previewTitle").textContent = first ? `${first.district} · ${first.province}` : "ไม่พบรายการ";
  $("#previewMeta").textContent = first ? `ราคาประเมิน ${fmt(first.appraisal)} บาท · นัด ${thaiDate(first.auction_date)}` : "ลองเปลี่ยนเงื่อนไขการค้นหา";
  $("#badgeCount").textContent = fmt(state.filtered.length);
  $("#allCount").textContent = fmt(state.meta.total || 0);
  render();
}

function setType(type) {
  state.type = type;
  $$("#typeTabs .tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.type === type)));
  return applyFilters();
}
const scrollToResults = () => $("#results").scrollIntoView({ behavior: "smooth" });
function selectProvince(name) {
  $("#provinceSelect").value = name;
  history.replaceState(null, "", "#area=" + encodeURIComponent(name));
  applyFilters();
  closeModal();
  scrollToResults();
}
function applyHash() {
  const id = location.hash.match(/^#id=([^&]+)(?:&p=(.+))?$/);
  if (id) { detailModal(decodeURIComponent(id[1]), id[2] ? decodeURIComponent(id[2]) : ""); return; }
  const m = location.hash.match(/^#area=(.+)$/);
  if (!m) return;
  const name = decodeURIComponent(m[1]);
  if ([...$("#provinceSelect").options].some((o) => o.value === name)) {
    $("#provinceSelect").value = name;
    applyFilters();
  }
}
window.addEventListener("hashchange", () => {
  applyHash();
  if (/^#area=/.test(location.hash)) scrollToResults();
});

// ---- actions ----------------------------------------------------------------------
const nav = $("#mainNav");
const actions = {
  login: () => authModal("login"),
  signup: () => authModal("signup"),
  account: () => { const u = store.get("user"); openModal("บัญชีของฉัน (ทดลอง)", `<p><b>${esc(u.name)}</b><br>${esc(u.email)}</p><p class="hint">ติดตาม ${getFollows().length} ทรัพย์ · แจ้งเตือน ${store.get("alerts", []).length} เงื่อนไข</p><div class="detail-actions"><button class="btn-primary" data-action="follow">ดูรายการติดตาม</button><button class="btn-outline" data-action="logout">ออกจากระบบ</button></div>`); },
  logout: () => { store.del("user"); refreshAccountUI(); closeModal(); },
  follow: followModal,
  alert: alertModal,
  guide: guideModal,
  video: videoModal,
  provinces: allProvincesModal,
  condo: () => { closeModal(); setType("condo"); scrollToResults(); },
  search: () => { closeModal(); scrollToResults(); },
  all: () => { ["#provinceSelect", "#budgetSelect", "#dateSelect", "#signalSelect"].forEach((s) => ($(s).value = "")); history.replaceState(null, "", location.pathname); setType(""); scrollToResults(); },
};

document.addEventListener("click", (e) => {
  const t = e.target;
  const del = t.closest("[data-del-alert]");
  if (del) { const a = store.get("alerts", []); a.splice(Number(del.dataset.delAlert), 1); store.set("alerts", a); alertModal(); return; }
  const unf = t.closest("[data-unfollow]");
  if (unf) { toggleFollow(unf.dataset.unfollow); refreshFollowUI(); followModal(); return; }
  const heart = t.closest(".heart");
  if (heart) { e.stopPropagation(); toggleFollow(heart.dataset.id); refreshFollowUI(); return; }
  const info = t.closest("[data-info]");
  if (info) { e.preventDefault(); infoModal(info.dataset.info); return; }
  const det = t.closest("[data-detail]");
  if (det) { e.preventDefault(); detailModal(det.dataset.detail); return; }
  const act = t.closest("[data-action]");
  if (act && actions[act.dataset.action]) { e.preventDefault(); nav.classList.remove("open"); actions[act.dataset.action](); return; }
  const prov = t.closest("[data-province]");
  if (prov) { e.preventDefault(); selectProvince(prov.dataset.province); }
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card")) { e.preventDefault(); detailModal(e.target.dataset.detail); }
});

const toggle = $("#menuToggle");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});

$("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); applyFilters(); scrollToResults(); });
["#provinceSelect", "#budgetSelect", "#dateSelect", "#signalSelect"].forEach((s) => $(s).addEventListener("change", () => applyFilters()));
$$("#typeTabs .tab").forEach((t) => t.addEventListener("click", () => setType(t.dataset.type)));
$("#moreBtn").addEventListener("click", () => { state.shown += 10; render(); });

const bar = $("#cookie");
if (localStorage.getItem("cookieOk")) bar.hidden = true;
$("#cookieOk").addEventListener("click", () => { localStorage.setItem("cookieOk", "1"); bar.hidden = true; });

// ---- start ------------------------------------------------------------------------
$("#provinceSelect").innerHTML = '<option value="">ทุกจังหวัด</option>' + PROVINCES.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
refreshAccountUI();
refreshFollowUI();

function noticeText(meta, status) {
  const parts = [meta.notice || ""];
  const age = dataAgeDays(meta);
  const d = meta.diff;
  if (d && d.since) parts.push(`เทียบรอบ ${thaiDate(d.since)}: ใหม่ ${fmt(d.new)} · หายไป ${fmt(d.removed)} · เปลี่ยน ${fmt(d.changed)}`);
  let stale = false;
  if (age !== null && age > 8) { stale = true; parts.push(`⚠ ข้อมูลเก็บเมื่อ ${age} วันที่แล้ว วันนัดขายส่วนใหญ่อาจผ่านไปแล้ว เกินรอบอัปเดตรายสัปดาห์แล้ว`); }
  if (status && status.result === "failed") { stale = true; parts.push(`⚠ การอัปเดตรอบล่าสุดไม่สำเร็จ ยังใช้ข้อมูลเดิม: ${status.message}`); }
  return { text: parts.filter(Boolean).join(" · "), stale };
}

Promise.all([loadMeta(), loadStatus()])
  .then(async ([meta, status]) => {
    state.meta = meta;
    $("#subCount").textContent = fmt(meta.provinces.length);
    $("#heroCount").textContent = fmt(meta.total);
    $("#subUpdated").textContent = `ข้อมูล ณ ${thaiDate(meta.updated)}`;
    const n = noticeText(meta, status);
    $("#dataNotice").textContent = n.text;
    $("#dataNotice").classList.toggle("stale", n.stale);
    $("#dateSelect").disabled = false;
    renderProvinceGrid();
    await applyFilters();
    applyHash();
  })
  .catch(() => {
    $("#dataNotice").textContent = "โหลดข้อมูลไม่สำเร็จ (ต้องเปิดผ่านเซิร์ฟเวอร์ ไม่ใช่ไฟล์โดยตรง)";
    $("#empty").hidden = false;
  });
