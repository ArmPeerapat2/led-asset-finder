import { $ } from "./util.js";

const modal = $("#modal");
export function openModal(title, body) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}
export function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}
modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
