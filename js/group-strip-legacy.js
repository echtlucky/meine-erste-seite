(function () {
  "use strict";

  if (window.__ECHTLUCKY_GROUP_STRIP__) return;
  window.__ECHTLUCKY_GROUP_STRIP__ = true;

  const defaultGroups = [
    { id: "__dm__", name: "DM", unread: 0, color: "#00ff88", type: "dm" },
    { id: "group-1", name: "Connect Hub", unread: 4, color: "#00ff88", type: "group" },
    { id: "group-2", name: "Ballistic", unread: 2, color: "#00cc66", type: "group" },
    { id: "group-3", name: "Reflex Lab", unread: 0, color: "#00cc66", type: "group" },
    { id: "group-4", name: "Community", unread: 0, color: "#00cc66", type: "group" },
    { id: "group-5", name: "Updates", unread: 3, color: "#00cc66", type: "group" },
    { id: "__create__", name: "+", unread: 0, color: "#00ff88", type: "create" }
  ];

  const contextMenu = document.getElementById("groupStripContextMenu");
  let currentGroups = defaultGroups.slice();
  let contextTarget = null;

  function getShortLabel(name) {
    if (!name) return "CL";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function buildIcon(group) {
    const wrapper = document.createElement("button");
    wrapper.type = "button";
    wrapper.className = "group-strip__item";
    wrapper.dataset.groupId = group.id;
    wrapper.dataset.groupName = group.name;
    wrapper.style.setProperty("--group-color", group.color || "rgba(0,255,136,0.65)");

    const iconContent =
      group.type === "dm" ? "💬" : group.type === "create" ? "+" : getShortLabel(group.name);

    wrapper.innerHTML = `
      <span class="group-strip__icon">${iconContent}</span>
      ${group.unread ? `<span class="group-strip__badge">${group.unread}</span>` : ""}
    `;

    wrapper.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("echtlucky:group-strip-select", { detail: { groupId: group.id } }));
    });

    wrapper.addEventListener("contextmenu", (event) => {
      if (group.type && group.type !== "group") return;
      event.preventDefault();
      contextTarget = group;
      openContextMenu(event.clientX, event.clientY);
    });

    return wrapper;
  }

  function getStripSlots() {
    return Array.from(document.querySelectorAll("[data-group-strip]"));
  }

  function renderStrip() {
    const slots = getStripSlots();
    if (!slots.length) return;
    slots.forEach((slot) => {
      slot.innerHTML = "";
      currentGroups.slice(0, 10).forEach((group) => {
        slot.appendChild(buildIcon(group));
      });
    });
  }

  function closeContextMenu() {
    if (!contextMenu) return;
    contextMenu.classList.remove("is-open");
    contextMenu.hidden = true;
  }

  function openContextMenu(x, y) {
    if (!contextMenu || !contextTarget) return;
    contextMenu.innerHTML = [
      { label: "Gruppe öffnen", action: "open" },
      { label: "Als gelesen markieren", action: "mark-read" },
      { label: "Einstellungen", action: "settings" }
    ]
      .map(
        (item) =>
          `<button class="group-strip__menu-item" type="button" data-action="${item.action}">${item.label}</button>`
      )
      .join("");

    contextMenu.hidden = false;
    contextMenu.classList.add("is-open");
    contextMenu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - 140)}px`;
  }

  function handleMenuClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const group = contextTarget;
    if (!group) return;

    if (action === "open") {
      window.dispatchEvent(
        new CustomEvent("echtlucky:group-strip-select", { detail: { groupId: group.id } })
      );
    } else if (action === "mark-read") {
      window.notify?.show?.({
        type: "success",
        title: "Gelesen",
        message: `${group.name} ist nun als gelesen markiert.`,
        duration: 2400
      });
    } else if (action === "settings") {
      window.notify?.show?.({
        type: "info",
        title: "Einstellungen",
        message: `Einstellungen für ${group.name} öffnen.`,
        duration: 2400
      });
    }

    closeContextMenu();
  }

  function wireContextMenu() {
    if (!contextMenu) return;

    contextMenu.addEventListener("click", handleMenuClick);

    document.addEventListener("click", (event) => {
      if (!contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeContextMenu();
    });

    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
  }

  window.updateGroupStrip = function (groups) {
    if (Array.isArray(groups) && groups.length) {
      currentGroups = groups.slice(0, 10).map((g) => ({
        id: g.id,
        name: g.name,
        unread: g.unread || 0,
        color: g.color || "rgba(0,255,136,0.65)",
        type: g.type || "group"
      }));
    } else {
      currentGroups = defaultGroups.slice();
    }
    renderStrip();
  };

  function initStrip() {
    renderStrip();
    wireContextMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStrip);
  } else {
    initStrip();
  }

  document.addEventListener("echtlucky:auth-change", (event) => {
    if (!event.detail?.user) {
      closeContextMenu();
      renderStrip();
    }
  });
})();
