(() => {
  "use strict";

  if (window.__ECHTLUCKY_GROUP_STRIP_V2__) return;
  window.__ECHTLUCKY_GROUP_STRIP_V2__ = true;

  const DEFAULT_GROUPS = [
    { id: "__dm__", name: "Direktnachrichten", unread: 0, color: "#00ff88", type: "dm" },
    { id: "group-1", name: "Connect Hub", unread: 4, color: "#00ff88", type: "group" },
    { id: "group-2", name: "Ballistic", unread: 2, color: "#ff3366", type: "group" },
    { id: "group-3", name: "Reflex Lab", unread: 0, color: "#5865f2", type: "group" },
    { id: "group-4", name: "Community", unread: 0, color: "#00a8ff", type: "group" },
    { id: "group-5", name: "Updates", unread: 3, color: "#ff9a00", type: "group" },
    { id: "__create__", name: "Gruppe erstellen", unread: 0, color: "#00ff88", type: "create" },
  ];

  let currentGroups = DEFAULT_GROUPS.slice();
  let contextTarget = null;
  let contextMenu = null;

  function getShortLabel(name) {
    if (!name) return "EL";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function ensureDockSlot() {
    const existing = document.querySelector("[data-group-strip='dock']");
    if (existing) return existing;

    const dock = document.createElement("div");
    dock.className = "group-strip group-strip--dock";
    dock.setAttribute("data-group-strip", "dock");
    dock.setAttribute("aria-label", "Gruppen-Leiste");
    document.body.appendChild(dock);
    return dock;
  }

  function ensureContextMenu() {
    contextMenu = document.getElementById("groupStripContextMenu");
    if (contextMenu) return contextMenu;

    contextMenu = document.createElement("div");
    contextMenu.id = "groupStripContextMenu";
    contextMenu.className = "group-strip__menu";
    contextMenu.setAttribute("role", "menu");
    contextMenu.setAttribute("aria-label", "Gruppen-Aktionen");
    contextMenu.hidden = true;
    document.body.appendChild(contextMenu);
    return contextMenu;
  }

  function closeContextMenu() {
    if (!contextMenu) return;
    contextMenu.classList.remove("is-open");
    contextMenu.hidden = true;
  }

  function openContextMenu(x, y) {
    if (!contextMenu || !contextTarget) return;

    contextMenu.innerHTML = [
      { label: "Öffnen", action: "open" },
      { label: "Als gelesen markieren", action: "mark-read" },
      { label: "Einstellungen", action: "settings" },
      { label: "Gruppe löschen", action: "delete" },
    ]
      .map(
        (item) =>
          `<button class="group-strip__menu-item" type="button" data-action="${item.action}">${item.label}</button>`
      )
      .join("");

    contextMenu.hidden = false;
    contextMenu.classList.add("is-open");

    const safeX = Math.min(x, window.innerWidth - 190);
    const safeY = Math.min(y, window.innerHeight - 170);
    contextMenu.style.left = `${Math.max(10, safeX)}px`;
    contextMenu.style.top = `${Math.max(10, safeY)}px`;
  }

  function buildDockIcon(group) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-strip__item";
    btn.dataset.groupId = group.id;
    btn.dataset.groupName = group.name;
    btn.style.setProperty("--group-color", group.color || "rgba(0,255,136,0.65)");

    const iconContent =
      group.type === "dm" ? "💬" : group.type === "create" ? "+" : getShortLabel(group.name);

    btn.innerHTML = `
      <span class="group-strip__icon">${iconContent}</span>
      ${group.unread ? `<span class="group-strip__badge">${group.unread}</span>` : ""}
    `;

    btn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("echtlucky:group-strip-select", { detail: { groupId: group.id } }));
    });

    btn.addEventListener("contextmenu", (event) => {
      if (group.type && group.type !== "group") return;
      event.preventDefault();
      contextTarget = group;
      openContextMenu(event.clientX, event.clientY);
    });

    return btn;
  }

  function renderDock() {
    const dock = ensureDockSlot();
    dock.innerHTML = "";
    currentGroups.slice(0, 10).forEach((g) => dock.appendChild(buildDockIcon(g)));
  }

  function renderGroupsDropdown() {
    const menu = document.getElementById("groupsMenu");
    if (!menu) return;

    menu.innerHTML = "";

    currentGroups.forEach((group) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "dropdown-item";
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "0.7rem";

      const icon = document.createElement("span");
      icon.className = "group-strip__icon";
      icon.style.width = "28px";
      icon.style.height = "28px";
      icon.style.borderRadius = "50%";
      icon.style.background = group.color || "rgba(0,255,136,0.65)";
      icon.textContent = group.type === "dm" ? "💬" : group.type === "create" ? "+" : getShortLabel(group.name);

      const label = document.createElement("span");
      label.textContent = group.name;
      label.style.flex = "1";

      row.appendChild(icon);
      row.appendChild(label);

      if (group.unread) {
        const badge = document.createElement("span");
        badge.className = "group-strip__badge";
        badge.style.position = "static";
        badge.style.border = "none";
        badge.style.minWidth = "24px";
        badge.style.height = "18px";
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.textContent = String(group.unread);
        row.appendChild(badge);
      }

      row.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("echtlucky:group-strip-select", { detail: { groupId: group.id } }));
        menu.classList.remove("show");
        document.getElementById("groupsToggle")?.setAttribute("aria-expanded", "false");
      });

      row.addEventListener("contextmenu", (event) => {
        if (group.type && group.type !== "group") return;
        event.preventDefault();
        contextTarget = group;
        openContextMenu(event.clientX, event.clientY);
      });

      menu.appendChild(row);
    });
  }

  function handleContextMenuClick(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const group = contextTarget;
    if (!group) return;

    if (action === "open") {
      window.dispatchEvent(new CustomEvent("echtlucky:group-strip-select", { detail: { groupId: group.id } }));
    } else if (action === "mark-read") {
      window.notify?.show?.({ type: "success", title: "Gelesen", message: `${group.name} ist nun als gelesen markiert.`, duration: 2400 });
    } else if (action === "settings") {
      window.notify?.show?.({ type: "info", title: "Einstellungen", message: `Einstellungen für ${group.name} öffnen.`, duration: 2400 });
    } else if (action === "delete") {
      window.notify?.show?.({ type: "error", title: "Gruppe löschen", message: `${group.name} wird (später) gelöscht.`, duration: 2400 });
    }

    closeContextMenu();
  }

  function wireContextMenu() {
    ensureContextMenu();
    if (!contextMenu || contextMenu.__wired) return;
    contextMenu.__wired = true;

    contextMenu.addEventListener("click", handleContextMenuClick);

    document.addEventListener("click", (event) => {
      if (!contextMenu.contains(event.target)) closeContextMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeContextMenu();
    });

    window.addEventListener("scroll", closeContextMenu, true);
    window.addEventListener("resize", closeContextMenu);
  }

  function renderAll() {
    renderDock();
    renderGroupsDropdown();
  }

  window.updateGroupStrip = function updateGroupStrip(groups) {
    if (Array.isArray(groups) && groups.length) {
      currentGroups = groups.slice(0, 10).map((g) => ({
        id: g.id,
        name: g.name,
        unread: g.unread || 0,
        color: g.color || "rgba(0,255,136,0.65)",
        type: g.type || "group",
      }));
    } else {
      currentGroups = DEFAULT_GROUPS.slice();
    }
    renderAll();
  };

  function init() {
    wireContextMenu();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

