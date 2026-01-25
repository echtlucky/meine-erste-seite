// js/notify.js — echtlucky (global toasts)
(() => {
  "use strict";

  if (window.notify) return; // prevent double load

  const DEFAULTS = {
    type: "info",
    title: "",
    message: "",
    duration: 3200, // ms (0 = sticky)
  };

  let stackEl = null;

  function ensureStack() {
    if (stackEl) return stackEl;

    stackEl = document.createElement("div");
    stackEl.className = "notify-stack";
    stackEl.setAttribute("aria-live", "polite");
    stackEl.setAttribute("aria-relevant", "additions removals");
    document.body.appendChild(stackEl);

    return stackEl;
  }

  function iconFor(type){
    if (type === "success") return "✓";
    if (type === "warn") return "!";
    if (type === "error") return "×";
    return "i";
  }

  function sanitizeText(s) {
    return String(s ?? "");
  }

  function removeToast(toast) {
    if (!toast) return;
    toast.classList.add("is-out");
    toast.classList.remove("is-in");
    window.setTimeout(() => toast.remove(), 180);
  }

  function show(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const type = o.type || "info";

    const stack = ensureStack();

    const toast = document.createElement("div");
    toast.className = "notify";
    toast.dataset.type = type;

    const title = sanitizeText(o.title || (type === "success" ? "Erfolg" : type === "warn" ? "Hinweis" : type === "error" ? "Fehler" : "Info"));
    const message = sanitizeText(o.message || "");

    toast.innerHTML = `
      <div class="notify__bar" aria-hidden="true"></div>
      <div class="notify__body">
        <div class="notify__title">${iconFor(type)} ${title}</div>
        ${message ? `<p class="notify__msg">${message}</p>` : ``}
      </div>
      <button class="notify__close" type="button" aria-label="Schließen">×</button>
      <div class="notify__progress" aria-hidden="true"><span></span></div>
    `;

    const closeBtn = toast.querySelector(".notify__close");
    closeBtn.addEventListener("click", () => removeToast(toast));

    // click anywhere -> close (optional nice UX)
    toast.addEventListener("click", (e) => {
      if (e.target === closeBtn) return;
      // don’t close when selecting text
      if (window.getSelection && String(window.getSelection()).length) return;
      removeToast(toast);
    });

    // Insert newest on top
    stack.prepend(toast);

    // animate in
    requestAnimationFrame(() => toast.classList.add("is-in"));

    // auto dismiss with progress
    const duration = Number(o.duration ?? 3200);
    const progressSpan = toast.querySelector(".notify__progress > span");

    let timer = null;
    if (duration > 0) {
      progressSpan.style.transition = `transform ${duration}ms linear`;
      requestAnimationFrame(() => (progressSpan.style.transform = "scaleX(0)"));
      timer = window.setTimeout(() => removeToast(toast), duration);
    } else {
      // sticky: hide progress
      toast.querySelector(".notify__progress").style.display = "none";
    }

    // return control
    return {
      el: toast,
      close: () => {
        if (timer) clearTimeout(timer);
        removeToast(toast);
      }
    };
  }

  // Public API
  window.notify = {
    show,
    info: (message, title = "Info", duration) => show({ type: "info", title, message, duration }),
    success: (message, title = "Success", duration) => show({ type: "success", title, message, duration }),
    warn: (message, title = "In Bearbeitung", duration) => show({ type: "warn", title, message, duration }),
    error: (message, title = "Fehler", duration) => show({ type: "error", title, message, duration }),

    // nice helper: replace alert()
    alert: (message, type = "info") => show({ type, title: type.toUpperCase(), message }),

    // optional: confirm style (lightweight)
    // (wenn du willst, bauen wir dir als nächstes ein richtiges modal-confirm im gleichen design)
  };
})();