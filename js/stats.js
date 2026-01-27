(() => {
  "use strict";

  if (window.__ECHTLUCKY_STATS_LOADED__) return;
  window.__ECHTLUCKY_STATS_LOADED__ = true;

  const fillElements = document.querySelectorAll(".progress-fill, .skill-fill");
  fillElements.forEach((el) => {
    const value = parseFloat(el.dataset.value || "0");
    el.style.width = `${Math.min(Math.max(value, 0), 1) * 100}%`;
  });

  const heatmap = document.getElementById("heatmap");
  if (heatmap) {
    const shades = [0.1, 0.25, 0.4, 0.55, 0.72, 0.9];
    for (let i = 0; i < 28; i += 1) {
      const cell = document.createElement("span");
      const shade = shades[Math.floor(Math.random() * shades.length)];
      cell.style.background = `rgba(0, 255, 136, ${shade})`;
      heatmap.appendChild(cell);
    }
  }

  const streakRows = document.getElementById("streakRows");
  if (streakRows) {
    const data = [5, 12, 8, 14, 9, 11, 7];
    streakRows.innerHTML = "";
    data.forEach((value) => {
      const el = document.createElement("div");
      el.textContent = `${value} XP`;
      streakRows.appendChild(el);
    });
  }

  const spark = document.getElementById("xpSpark");
  if (spark) {
    const points = 40;
    spark.innerHTML = "";
    for (let i = 0; i < points; i += 1) {
      const dot = document.createElement("span");
      dot.className = "spark";
      dot.style.left = `${(i / points) * 100}%`;
      dot.style.animationDelay = `${i * 0.05}s`;
      spark.appendChild(dot);
    }
  }
})();
