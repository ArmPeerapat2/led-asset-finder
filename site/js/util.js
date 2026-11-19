export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const PROVINCES = ["กระบี่","กรุงเทพมหานคร","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พะเยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี","อำนาจเจริญ"];

export const typeLabel = { land: "ที่ดินว่างเปล่า", house: "ที่ดินพร้อมสิ่งปลูกสร้าง", condo: "คอนโด" };
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export const fmt = (n) => Number(n).toLocaleString("th-TH");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")} ล.` : `${Math.round(n / 1e3)}k`);

export function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}
export function thaiDate(s) {
  const t = parseDate(s);
  if (t === null) return s || "-";
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(2)}`;
}
export function daysLeft(s) {
  const t = parseDate(s);
  return t === null ? null : Math.ceil((t - Date.now()) / 864e5);
}
// Mortgage-attached sales: buyer also takes the mortgage debt (not in the data), so no discount is computed.
export function discountPct(it) {
  if (it.mortgage) return 0;
  const a = Number(it.appraisal), s = Number(it.start_price);
  if (!a || !s || s >= a) return 0;
  return Math.round(((a - s) / a) * 100);
}

// "signal" filters: facts computed from the data, not advice.
export const SIGNALS = {
  discount: (it) => discountPct(it) > 0,
  nomort: (it) => !it.mortgage,
  parcel: (it) => it.geo === "parcel",
  new: (it) => !!it.new,
};

export const mapLink = (id, province) => `map.html#p=${encodeURIComponent(province)}&id=${encodeURIComponent(id)}`;
