const toggle = document.querySelector(".menu-toggle");
const closeButton = document.querySelector(".menu-close");
const menu = document.querySelector(".mobile-menu");
const backdrop = document.querySelector("[data-backdrop]");
const menuLinks = document.querySelectorAll(".mobile-menu a");

function setMenu(open) {
  if (!menu || !toggle || !backdrop) return;

  menu.classList.toggle("open", open);
  backdrop.classList.toggle("open", open);
  menu.setAttribute("aria-hidden", String(!open));
  toggle.setAttribute("aria-expanded", String(open));
  document.body.style.overflow = open ? "hidden" : "";
}

toggle?.addEventListener("click", () => setMenu(true));
closeButton?.addEventListener("click", () => setMenu(false));
backdrop?.addEventListener("click", () => setMenu(false));
menuLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 1023) setMenu(false);
});
