(() => {
  "use strict";

  if (window.__ECHTLUCKY_GALAXY_BG__) return;
  window.__ECHTLUCKY_GALAXY_BG__ = true;

  const appNS = (window.echtlucky = window.echtlucky || {});

  const TAU = Math.PI * 2;
  const BASE_BG = "#020b06";

  const mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function isLowEndDevice() {
    try {
      const mem = Number(navigator.deviceMemory || 0);
      const cores = Number(navigator.hardwareConcurrency || 0);
      if (mem && mem <= 2) return true;
      if (cores && cores <= 4) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  function createCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function makeNebulaTexture(size) {
    const c = createCanvas(size, size);
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";

    const blobs = 14;
    for (let i = 0; i < blobs; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = (0.25 + Math.random() * 0.55) * size;

      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.10 + Math.random() * 0.12;
      g.addColorStop(0, `rgba(0,255,136,${a})`);
      g.addColorStop(0.55, `rgba(0,190,110,${a * 0.65})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;

    return c;
  }

  function makeStaticStarsTexture(size) {
    const c = createCanvas(size, size);
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    const count = Math.floor(size * size * 0.010);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random();
      const a = 0.06 + Math.random() * 0.18;
      const tint = 0.6 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(0,255,136,${a * tint})`;
      if (r < 0.72) {
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + Math.random() * 0.7, 0, TAU);
        ctx.fill();
      }
    }

    return c;
  }

  function makePlanets(w, h) {
    const count = w >= 900 ? 3 : 2;
    const planets = [];
    for (let i = 0; i < count; i++) {
      const r = (w >= 900 ? 70 : 54) + Math.random() * (w >= 900 ? 110 : 80);
      planets.push({
        x: (Math.random() * 1.4 - 0.2) * w,
        y: (Math.random() * 1.2 - 0.1) * h,
        r,
        driftX: (Math.random() * 2 - 1) * 14,
        driftY: (Math.random() * 2 - 1) * 10,
        speed: 0.00002 + Math.random() * 0.00003,
        alpha: 0.06 + Math.random() * 0.07,
      });
    }
    return planets;
  }

  class GalaxyBackground {
    constructor() {
      this.layer = null;
      this.canvas = null;
      this.ctx = null;
      this.dpr = 1;
      this.w = 0;
      this.h = 0;
      this.running = false;
      this.raf = 0;
      this.lastTs = 0;
      this.targetFps = 60;
      this.lastDt = 16;
      this.scrollY = 0;
      this.scrollAttached = false;
      this.nebulaSize = 512;
      this.starsSize = 512;
      this.nebulaTex = null;
      this.starsTex = null;
      this.nebulaPattern = null;
      this.starsPattern = null;
      this.twinkles = [];
      this.planets = [];
      this.planetSprites = [];
      this.starSprites = null;
    }

    init() {
      if (this.layer) return;

      const prefersReduce = !!(mqReduce && mqReduce.matches);
      const lowEnd = isLowEndDevice();
      const useCss = prefersReduce || lowEnd;

      if (useCss) {
        document.documentElement.classList.add("galaxy-css");
        this.ensureLayer();
        return;
      }

      document.documentElement.classList.remove("galaxy-css");
      this.ensureLayer();

      this.canvas = document.createElement("canvas");
      this.canvas.id = "galaxy-bg";
      this.canvas.setAttribute("aria-hidden", "true");
      this.canvas.setAttribute("role", "presentation");
      this.layer.appendChild(this.canvas);

      this.ctx = this.canvas.getContext("2d", { alpha: true, desynchronized: true });
      if (!this.ctx) {
        document.documentElement.classList.add("galaxy-css");
        this.canvas.remove();
        this.canvas = null;
        return;
      }

      this.targetFps = lowEnd ? 30 : 60;
      this.resize();

      window.addEventListener("resize", () => this.resize(), { passive: true });
      document.addEventListener("visibilitychange", () => this.onVisibility(), { passive: true });
      if (!this.scrollAttached) {
        this.scrollAttached = true;
        window.addEventListener(
          "scroll",
          () => {
            this.scrollY = window.scrollY || window.pageYOffset || 0;
          },
          { passive: true }
        );
      }

      if (mqReduce) {
        try {
          mqReduce.addEventListener("change", () => this.onMotionPref());
        } catch (_) {}
      }

      this.start();
    }

    ensureLayer() {
      const existing = document.getElementById("galaxy-bg-layer");
      if (existing) {
        this.layer = existing;
        return;
      }

      const layer = document.createElement("div");
      layer.id = "galaxy-bg-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.setAttribute("role", "presentation");
      document.body.insertBefore(layer, document.body.firstChild);
      this.layer = layer;
    }

    onMotionPref() {
      const prefersReduce = !!(mqReduce && mqReduce.matches);
      if (prefersReduce) {
        this.stop();
        document.documentElement.classList.add("galaxy-css");
        if (this.canvas) {
          this.canvas.remove();
          this.canvas = null;
        }
      } else {
        document.documentElement.classList.remove("galaxy-css");
        if (!this.canvas) this.init();
      }
    }

    onVisibility() {
      if (document.hidden) this.stop();
      else this.start();
    }

    resize() {
      if (!this.canvas || !this.ctx) return;
      const w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      const h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);

      this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      this.w = w;
      this.h = h;

      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.canvas.width = Math.floor(w * this.dpr);
      this.canvas.height = Math.floor(h * this.dpr);

      this.nebulaSize = w >= 1200 ? 1024 : 768;
      this.starsSize = 512;
      this.nebulaTex = makeNebulaTexture(this.nebulaSize);
      this.starsTex = makeStaticStarsTexture(this.starsSize);
      this.nebulaPattern = this.nebulaTex ? this.ctx.createPattern(this.nebulaTex, "repeat") : null;
      this.starsPattern = this.starsTex ? this.ctx.createPattern(this.starsTex, "repeat") : null;

      this.planets = makePlanets(this.w, this.h);
      this.planetSprites = this.makePlanetSprites(this.planets);
      this.starSprites = this.makeStarSprites();
      this.twinkles = this.makeTwinkles();
      this.render(0, true);
    }

    makeStarSprites() {
      const sprite = createCanvas(24, 24);
      const ctx = sprite.getContext("2d", { alpha: true });
      if (!ctx) return null;

      const make = (r, alpha) => {
        ctx.clearRect(0, 0, 24, 24);
        const x = 12;
        const y = 12;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
        g.addColorStop(0, `rgba(0,255,136,${alpha})`);
        g.addColorStop(0.35, `rgba(0,255,136,${alpha * 0.35})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3.2, 0, TAU);
        ctx.fill();
        const out = createCanvas(24, 24);
        out.getContext("2d", { alpha: true })?.drawImage(sprite, 0, 0);
        return out;
      };

      return {
        small: make(0.6, 0.55),
        med: make(1.2, 0.60),
        big: make(2.0, 0.68)
      };
    }

    makePlanetSprites(planets) {
      const sprites = [];
      for (const p of planets) {
        const size = Math.max(64, Math.ceil(p.r * 2.2));
        const c = createCanvas(size, size);
        const ctx = c.getContext("2d", { alpha: true });
        if (!ctx) {
          sprites.push(null);
          continue;
        }
        const x = size / 2;
        const y = size / 2;
        const r = p.r;
        const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.15, x, y, r);
        g.addColorStop(0, `rgba(0,255,136,${p.alpha})`);
        g.addColorStop(0.55, `rgba(0,120,70,${p.alpha * 0.55})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        sprites.push(c);
      }
      return sprites;
    }

    makeTwinkles() {
      const area = this.w * this.h;
      const base = clamp(Math.floor(area * 0.00016), 160, 520);
      const count = isLowEndDevice() ? Math.min(base, 260) : base;
      const out = new Array(count);
      for (let i = 0; i < count; i++) {
        out[i] = this.spawnTwinkle({});
      }
      return out;
    }

    spawnTwinkle(star) {
      const s = star || {};
      s.x = Math.random() * this.w;
      s.y = Math.random() * this.h;
      s.r = 0.35 + Math.random() * 1.25;
      s.baseA = 0.10 + Math.random() * 0.55;
      s.phase = Math.random() * TAU;
      s.speed = 0.7 + Math.random() * 1.9;
      s.life = Math.random();
      s.lifeDir = Math.random() < 0.22 ? -1 : 1;
      s.lifeSpeed = 0.000035 + Math.random() * 0.00008;
      s.tint = 0.75 + Math.random() * 0.25;
      return s;
    }

    start() {
      if (this.running) return;
      if (!this.canvas || !this.ctx) return;
      if (document.hidden) return;
      this.running = true;
      this.lastTs = performance.now();
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastTs = 0;
    }

    tick(ts) {
      if (!this.running) return;
      const dt = ts - (this.lastTs || ts);
      const minDt = 1000 / this.targetFps;
      if (dt >= minDt) {
        this.lastTs = ts;
        this.lastDt = dt;
        this.render(ts, false);
      }
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }

    render(ts, force) {
      if (!this.ctx || !this.canvas) return;

      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";

      ctx.fillStyle = BASE_BG;
      ctx.fillRect(0, 0, this.w, this.h);

      const scrollY = this.scrollY || 0;
      const time = force ? 0 : ts;

      if (this.nebulaPattern && this.nebulaTex) {
        const ox = ((scrollY * 0.018 + time * 0.004) % this.nebulaSize + this.nebulaSize) % this.nebulaSize;
        const oy = ((scrollY * 0.012 + time * 0.003) % this.nebulaSize + this.nebulaSize) % this.nebulaSize;
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = this.nebulaPattern;
        ctx.fillRect(ox, oy, this.w + this.nebulaSize, this.h + this.nebulaSize);
        ctx.restore();
      }

      if (this.planets.length) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        for (let idx = 0; idx < this.planets.length; idx++) {
          const p = this.planets[idx];
          const x = p.x + Math.sin(time * p.speed) * p.driftX;
          const y = p.y + Math.cos(time * p.speed * 0.9) * p.driftY + scrollY * 0.01;
          const sprite = this.planetSprites[idx];
          if (sprite) {
            ctx.globalAlpha = 1;
            ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
          }
        }
        ctx.restore();
      }

      if (this.starsPattern && this.starsTex) {
        const ox = ((scrollY * 0.06 + time * 0.010) % this.starsSize + this.starsSize) % this.starsSize;
        const oy = ((scrollY * 0.035 + time * 0.007) % this.starsSize + this.starsSize) % this.starsSize;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = this.starsPattern;
        ctx.fillRect(ox, oy, this.w + this.starsSize, this.h + this.starsSize);
        ctx.restore();
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < this.twinkles.length; i++) {
        const s = this.twinkles[i];

        const lifeDelta = (force ? 0 : (s.lifeSpeed * this.lastDt)) * (s.lifeDir || 1);
        s.life = clamp(s.life + lifeDelta, 0, 1);
        if (s.life <= 0.001) {
          this.twinkles[i] = this.spawnTwinkle(s);
          continue;
        }
        if (s.life >= 0.999 && Math.random() < 0.0025) s.lifeDir = -1;
        if (s.lifeDir < 0 && s.life <= 0.02) s.lifeDir = 1;

        const tw = 0.72 + 0.28 * Math.sin((time * 0.001) * s.speed + s.phase);
        const alpha = s.baseA * tw * (0.45 + s.life * 0.55) * s.tint;
        if (alpha <= 0.01) continue;

        const scale = 1 + 0.08 * Math.sin((time * 0.0016) * (s.speed * 0.7) + s.phase);
        const r = s.r * scale;

        ctx.globalAlpha = alpha;
        if (r <= 0.75) {
          ctx.fillStyle = "rgba(0,255,136,1)";
          ctx.fillRect(s.x, s.y, 1, 1);
        } else if (this.starSprites) {
          const spr = r < 1.2 ? this.starSprites.small : r < 2.2 ? this.starSprites.med : this.starSprites.big;
          const sw = spr.width;
          const sh = spr.height;
          const k = r < 1.2 ? 0.65 : r < 2.2 ? 0.85 : 1.05;
          ctx.drawImage(spr, s.x - (sw * k) / 2, s.y - (sh * k) / 2, sw * k, sh * k);
        } else {
          ctx.fillStyle = "rgba(0,255,136,1)";
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  const manager = new GalaxyBackground();

  appNS.galaxyBackground = {
    init: () => manager.init(),
    start: () => manager.start(),
    stop: () => manager.stop(),
  };

  function boot() {
    try {
      manager.init();
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
