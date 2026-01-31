const headerContainer = document.getElementById("header-container");
import "./generator-modal.js";

const footerContainer = document.getElementById("footer-container");

const setupHeader = () => {
  const header = document.getElementById("site-header");
  if (!header) return;

  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    const current = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const nearBottom = current + window.innerHeight >= docHeight - 80;

    if (current > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    if (nearBottom || current < lastScroll) {
      header.classList.remove("hidden");
    } else if (current > 120) {
      header.classList.add("hidden");
    }

    lastScroll = current;
  });

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const pageName = currentPage.replace(".html", "") || "index";

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.dataset.page === pageName) {
      link.classList.add("active");
    }
  });
};

export const loadLayout = async () => {
  if (!headerContainer || !footerContainer) return;

  const base = window.location.pathname.includes("/pages/") ? "../" : "";
  const [header, footer] = await Promise.all([
    fetch(`${base}partials/header.html`).then((res) => res.text()),
    fetch(`${base}partials/footer.html`).then((res) => res.text())
  ]);

  headerContainer.innerHTML = header.replaceAll("{{BASE}}", base);
  footerContainer.innerHTML = footer.replaceAll("{{BASE}}", base);

  setupHeader();
  window.dispatchEvent(new Event("layout:ready"));
};

