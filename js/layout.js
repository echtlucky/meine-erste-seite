(() => {
  "use strict";

  if (window.__ECHTLUCKY_LAYOUT_LOADED__) return;
  window.__ECHTLUCKY_LAYOUT_LOADED__ = true;

  function setLoaded() {
    document.body.classList.add("loaded");
  }

  function safeInitHeader() {
    try {
      if (typeof window.initHeaderScripts === "function") window.initHeaderScripts();
      if (typeof window.initSmartHeaderScroll === "function") window.initSmartHeaderScroll();
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent("echtlucky:header-ready"));
    } catch {}
  }

  async function inject(id, url, after) {
    const host = document.getElementById(id);
    if (!host) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      host.innerHTML = await res.text();
      if (typeof after === "function") after();
    } catch {}
  }

  function boot() {
    setLoaded();
    const v = Date.now();
    inject("header-placeholder", `header.html?v=${v}`, safeInitHeader);
    inject("footer-placeholder", `footer.html?v=${v}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

