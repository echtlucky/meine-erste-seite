(() => {
  "use strict";

  if (window.__ECHTLUCKY_FONTS_LOADED__) return;
  window.__ECHTLUCKY_FONTS_LOADED__ = true;

  const LS_TEXT = "echtlucky:fonts:text:v1";
  const LS_FAVS = "echtlucky:fonts:favs:v1";

  const el = (id) => document.getElementById(id);

  const ui = {
    text: el("fontsText"),
    filter: el("fontsFilter"),
    grid: el("fontsGrid"),
    count: el("fontsCount"),
    hint: el("fontsHint"),
    btnReset: el("btnResetFonts"),
    btnUseLcky: el("btnUseLcky"),
    btnCopyBest: el("btnCopyBest"),
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function loadFavs() {
    const arr = safeJsonParse(localStorage.getItem(LS_FAVS) || "[]", []);
    return Array.isArray(arr) ? arr.map(String) : [];
  }

  function saveFavs(arr) {
    localStorage.setItem(LS_FAVS, JSON.stringify(arr.slice(0, 40)));
  }

  function setFav(styleId, next) {
    const favs = new Set(loadFavs());
    if (next) favs.add(styleId);
    else favs.delete(styleId);
    saveFavs(Array.from(favs));
  }

  const superscriptMap = (() => {
    const map = new Map(
      Object.entries({
        a: "ᵃ",
        b: "ᵇ",
        c: "ᶜ",
        d: "ᵈ",
        e: "ᵉ",
        f: "ᶠ",
        g: "ᵍ",
        h: "ʰ",
        i: "ᶦ",
        j: "ʲ",
        k: "ᵏ",
        l: "ˡ",
        m: "ᵐ",
        n: "ⁿ",
        o: "ᵒ",
        p: "ᵖ",
        r: "ʳ",
        s: "ˢ",
        t: "ᵗ",
        u: "ᵘ",
        v: "ᵛ",
        w: "ʷ",
        x: "ˣ",
        y: "ʸ",
        z: "ᶻ",
        "0": "⁰",
        "1": "¹",
        "2": "²",
        "3": "³",
        "4": "⁴",
        "5": "⁵",
        "6": "⁶",
        "7": "⁷",
        "8": "⁸",
        "9": "⁹",
      })
    );
    map.set("+", "⁺");
    map.set("-", "⁻");
    map.set("=", "⁼");
    map.set("(", "⁽");
    map.set(")", "⁾");
    return map;
  })();

  function toSuperscript(text) {
    return Array.from(String(text)).map((ch) => {
      const lower = ch.toLowerCase();
      return superscriptMap.get(lower) || superscriptMap.get(ch) || ch;
    }).join("");
  }

  function rangeAlphabet(startCodePoint, count) {
    const out = [];
    for (let i = 0; i < count; i += 1) out.push(String.fromCodePoint(startCodePoint + i));
    return out;
  }

  function makeLatinMapper(lowerStart, upperStart, digitStart) {
    const lower = rangeAlphabet(lowerStart, 26);
    const upper = rangeAlphabet(upperStart, 26);
    const digits = digitStart != null ? rangeAlphabet(digitStart, 10) : null;

    return (text) =>
      Array.from(String(text)).map((ch) => {
        const code = ch.codePointAt(0);
        if (code == null) return ch;
        if (code >= 97 && code <= 122) return lower[code - 97] || ch;
        if (code >= 65 && code <= 90) return upper[code - 65] || ch;
        if (digits && code >= 48 && code <= 57) return digits[code - 48] || ch;
        return ch;
      }).join("");
  }

  const MAP = {
    bold: makeLatinMapper(0x1d41a, 0x1d400, 0x1d7ce),
    italic: makeLatinMapper(0x1d44e, 0x1d434, null),
    boldItalic: makeLatinMapper(0x1d482, 0x1d468, null),
    script: makeLatinMapper(0x1d4b6, 0x1d49c, null),
    fraktur: makeLatinMapper(0x1d51e, 0x1d504, null),
    doubleStruck: makeLatinMapper(0x1d552, 0x1d538, 0x1d7d8),
    sans: makeLatinMapper(0x1d5ba, 0x1d5a0, 0x1d7e2),
    sansBold: makeLatinMapper(0x1d5ee, 0x1d5d4, 0x1d7ec),
    sansItalic: makeLatinMapper(0x1d622, 0x1d608, null),
    sansBoldItalic: makeLatinMapper(0x1d656, 0x1d63c, null),
    monospace: makeLatinMapper(0x1d68a, 0x1d670, 0x1d7f6),
    fullwidth: (text) =>
      Array.from(String(text)).map((ch) => {
        const code = ch.codePointAt(0);
        if (code == null) return ch;
        if (code >= 33 && code <= 126) return String.fromCodePoint(code + 0xfee0);
        if (code === 32) return "　";
        return ch;
      }).join(""),
  };

  function underline(text) {
    const comb = "\u0332";
    return Array.from(String(text)).map((ch) => (/\s/.test(ch) ? ch : ch + comb)).join("");
  }

  function strike(text) {
    const comb = "\u0336";
    return Array.from(String(text)).map((ch) => (/\s/.test(ch) ? ch : ch + comb)).join("");
  }

  function bubble(text) {
    const circledDigits = ["⓪", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
    const A = 0x24b6;
    const a = 0x24d0;
    return Array.from(String(text)).map((ch) => {
      const code = ch.codePointAt(0);
      if (code == null) return ch;
      if (code >= 65 && code <= 90) return String.fromCodePoint(A + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(a + (code - 97));
      if (code >= 48 && code <= 57) return circledDigits[code - 48] || ch;
      return ch;
    }).join("");
  }

  function squared(text) {
    const map = new Map();
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c, i) => {
      map.set(c, String.fromCodePoint(0x1f130 + i)); // 🄰..🅉
    });
    return Array.from(String(text).toUpperCase()).map((ch) => map.get(ch) || ch).join("");
  }

  function smallCaps(text) {
    const map = new Map(
      Object.entries({
        a: "ᴀ",
        b: "ʙ",
        c: "ᴄ",
        d: "ᴅ",
        e: "ᴇ",
        f: "ғ",
        g: "ɢ",
        h: "ʜ",
        i: "ɪ",
        j: "ᴊ",
        k: "ᴋ",
        l: "ʟ",
        m: "ᴍ",
        n: "ɴ",
        o: "ᴏ",
        p: "ᴘ",
        q: "ǫ",
        r: "ʀ",
        s: "s",
        t: "ᴛ",
        u: "ᴜ",
        v: "ᴠ",
        w: "ᴡ",
        x: "x",
        y: "ʏ",
        z: "ᴢ",
      })
    );
    return Array.from(String(text)).map((ch) => map.get(ch.toLowerCase()) || ch).join("");
  }

  const styles = [
    { id: "plain", name: "Standard", desc: "Clean", apply: (t) => String(t) },
    { id: "lcky", name: "Tag (ˡᶜᵏʸ)", desc: "Klein links oben", apply: (t) => toSuperscript(t) },
    { id: "bold", name: "Bold", desc: "Mathematical", apply: (t) => MAP.bold(t) },
    { id: "italic", name: "Italic", desc: "Mathematical", apply: (t) => MAP.italic(t) },
    { id: "boldItalic", name: "Bold Italic", desc: "Mathematical", apply: (t) => MAP.boldItalic(t) },
    { id: "sans", name: "Sans", desc: "Modern", apply: (t) => MAP.sans(t) },
    { id: "sansBold", name: "Sans Bold", desc: "Modern", apply: (t) => MAP.sansBold(t) },
    { id: "sansItalic", name: "Sans Italic", desc: "Modern", apply: (t) => MAP.sansItalic(t) },
    { id: "sansBoldItalic", name: "Sans Bold Italic", desc: "Modern", apply: (t) => MAP.sansBoldItalic(t) },
    { id: "monospace", name: "Monospace", desc: "Code look", apply: (t) => MAP.monospace(t) },
    { id: "script", name: "Script", desc: "Smooth", apply: (t) => MAP.script(t) },
    { id: "fraktur", name: "Fraktur", desc: "Gothic", apply: (t) => MAP.fraktur(t) },
    { id: "doubleStruck", name: "Double Struck", desc: "Clean premium", apply: (t) => MAP.doubleStruck(t) },
    { id: "smallCaps", name: "Small Caps", desc: "Team tag", apply: (t) => smallCaps(t) },
    { id: "fullwidth", name: "Fullwidth", desc: "Wide", apply: (t) => MAP.fullwidth(t) },
    { id: "bubble", name: "Circled", desc: "Bubble", apply: (t) => bubble(t) },
    { id: "squared", name: "Squared", desc: "Blocks", apply: (t) => squared(t) },
    { id: "underline", name: "Underline", desc: "Combining", apply: (t) => underline(t) },
    { id: "strike", name: "Strike", desc: "Combining", apply: (t) => strike(t) },
    { id: "mirror", name: "Reverse", desc: "Backwards", apply: (t) => Array.from(String(t)).reverse().join("") },
  ];

  function bestStyleId() {
    const t = String(ui.text?.value || "").trim();
    if (t.length > 0 && t.length <= 10) return "lcky";
    return "bold";
  }

  async function copyToClipboard(text) {
    const value = String(text || "");
    if (!value) return false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}

    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }

  function announce(msg) {
    if (window.notify?.show) {
      window.notify.show({ type: "success", title: "Kopiert", message: msg, duration: 1800 });
      return;
    }
    if (ui.hint) ui.hint.textContent = msg;
  }

  function normalizeInput(text) {
    return String(text || "").slice(0, 40);
  }

  function render() {
    if (!ui.grid) return;

    const rawText = normalizeInput(ui.text?.value || "");
    const filter = String(ui.filter?.value || "").trim().toLowerCase();
    const favs = new Set(loadFavs());

    const list = styles
      .filter((s) => (filter ? (s.name + " " + s.desc).toLowerCase().includes(filter) : true))
      .sort((a, b) => {
        const af = favs.has(a.id) ? 1 : 0;
        const bf = favs.has(b.id) ? 1 : 0;
        return bf - af || a.name.localeCompare(b.name);
      });

    ui.grid.innerHTML = "";

    list.forEach((s) => {
      const tile = document.createElement("div");
      tile.className = "font-tile" + (favs.has(s.id) ? " is-fav" : "");
      tile.dataset.styleId = s.id;

      const output = s.apply(rawText || "echtlcky");

      tile.innerHTML = `
        <div class="font-tile__top">
          <div class="font-tile__name">${s.name}</div>
          <div class="font-tile__actions">
            <button class="font-tile__btn" data-action="fav" type="button" aria-label="Favorit">★</button>
            <button class="font-tile__btn" data-action="copy" type="button" aria-label="Kopieren">Copy</button>
          </div>
        </div>
        <div class="font-tile__preview" data-role="preview"></div>
        <div class="font-tile__meta">
          <span>${s.desc}</span>
          <span>${output.length} chars</span>
        </div>
      `;

      const preview = tile.querySelector("[data-role='preview']");
      if (preview) preview.textContent = output;

      ui.grid.appendChild(tile);
    });

    if (ui.count) ui.count.textContent = `${list.length} Styles`;
  }

  async function copyStyle(styleId) {
    const rawText = normalizeInput(ui.text?.value || "");
    const s = styles.find((x) => x.id === styleId);
    if (!s) return;
    const output = s.apply(rawText || "echtlcky");
    const ok = await copyToClipboard(output);
    if (ok) announce(`${s.name} kopiert.`);
  }

  function bind() {
    if (ui.text) {
      ui.text.value = normalizeInput(localStorage.getItem(LS_TEXT) || "");
      ui.text.addEventListener("input", () => {
        localStorage.setItem(LS_TEXT, normalizeInput(ui.text.value));
        render();
      });
    }

    if (ui.filter) ui.filter.addEventListener("input", render);

    if (ui.btnReset) {
      ui.btnReset.addEventListener("click", () => {
        if (ui.text) ui.text.value = "";
        if (ui.filter) ui.filter.value = "";
        localStorage.removeItem(LS_TEXT);
        render();
      });
    }

    if (ui.btnUseLcky) {
      ui.btnUseLcky.addEventListener("click", () => {
        if (!ui.text) return;
        ui.text.value = "lcky";
        localStorage.setItem(LS_TEXT, "lcky");
        render();
        copyStyle("lcky");
      });
    }

    if (ui.btnCopyBest) {
      ui.btnCopyBest.addEventListener("click", () => {
        copyStyle(bestStyleId());
      });
    }

    if (ui.grid) {
      ui.grid.addEventListener("click", (e) => {
        const target = e.target instanceof HTMLElement ? e.target : null;
        const tile = target?.closest?.(".font-tile");
        if (!tile) return;

        const styleId = String(tile.dataset.styleId || "");
        const action = target?.getAttribute?.("data-action");

        if (action === "fav") {
          e.preventDefault();
          const next = !tile.classList.contains("is-fav");
          setFav(styleId, next);
          render();
          return;
        }

        copyStyle(styleId);
      });
    }
  }

  bind();
  render();
})();
