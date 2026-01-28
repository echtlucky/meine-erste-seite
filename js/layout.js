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
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) return;
      host.innerHTML = await res.text();
      if (typeof after === "function") after();
    } catch {}
  }

  function ensureScript(src) {
    if (!src) return;
    const base = String(src).split("?")[0];
    const existing = base ? document.querySelector(`script[src*="${base}"]`) : null;
    if (existing) return;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.head.appendChild(s);
  }

  function boot() {
    ensureScript("js/galaxy-bg.js?v=1");
    setLoaded();
    const v = "1";
    inject("header-placeholder", `header.html?v=${v}`, safeInitHeader);
    inject("footer-placeholder", `footer.html?v=${v}`);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

