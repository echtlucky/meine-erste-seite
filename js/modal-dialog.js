(() => {
  "use strict";

  if (window.echtluckyModal) return; // prevent double load

  const echtluckyModal = {
    input: function(options = {}) {
      return new Promise((resolve) => {
        const {
          title = "Eingabe",
          placeholder = "Text eingeben...",
          initialValue = "",
          cancelText = "Abbrechen",
          confirmText = "Bestätigen"
        } = options;

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal-dialog input-dialog";

        modal.innerHTML = `
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
          </div>
          <div class="modal-body">
            <input 
              type="text" 
              class="modal-input" 
              placeholder="${placeholder}" 
              value="${initialValue}"
              autofocus
            />
          </div>
          <div class="modal-footer">
            <button class="modal-btn cancel-btn">${cancelText}</button>
            <button class="modal-btn confirm-btn primary">${confirmText}</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = modal.querySelector(".modal-input");
        const cancelBtn = modal.querySelector(".cancel-btn");
        const confirmBtn = modal.querySelector(".confirm-btn");

        input.focus();

        cancelBtn.addEventListener("click", () => {
          overlay.remove();
          resolve(null);
        });

        confirmBtn.addEventListener("click", () => {
          const value = input.value.trim();
          if (value.length === 0) {
            input.classList.add("error");
            setTimeout(() => input.classList.remove("error"), 300);
            return;
          }
          overlay.remove();
          resolve(value);
        });

        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            confirmBtn.click();
          }
        });

        input.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            cancelBtn.click();
          }
        });

        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            cancelBtn.click();
          }
        });

        setTimeout(() => {
          overlay.classList.add("show");
        }, 10);
      });
    },

    form: function(options = {}) {
      return new Promise((resolve) => {
        const {
          title = "Formular",
          fields = [],
          cancelText = "Abbrechen",
          confirmText = "Speichern"
        } = options;

        const safeFields = Array.isArray(fields) ? fields : [];

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal-dialog form-dialog";

        const bodyHtml = safeFields
          .map((f) => {
            const name = String(f?.name || "").trim();
            if (!name) return "";

            const label = String(f?.label || name);
            const type = String(f?.type || "text");
            const placeholder = String(f?.placeholder || "");
            const required = !!f?.required;
            const maxLength = Number.isFinite(Number(f?.maxLength)) ? String(Number(f.maxLength)) : "";

            if (type === "select") {
              const optionsHtml = (Array.isArray(f?.options) ? f.options : [])
                .map((opt) => {
                  const v = String(opt?.value ?? "");
                  const l = String(opt?.label ?? v);
                  return `<option value="${v.replace(/"/g, "&quot;")}">${l.replace(/</g, "&lt;")}</option>`;
                })
                .join("");
              return `
                <label class="modal-field">
                  <span class="modal-label">${label}</span>
                  <select class="modal-select" data-name="${name}" ${required ? "required" : ""}>
                    ${optionsHtml}
                  </select>
                </label>
              `;
            }

            if (type === "textarea") {
              return `
                <label class="modal-field">
                  <span class="modal-label">${label}</span>
                  <textarea class="modal-textarea" data-name="${name}" placeholder="${placeholder.replace(/"/g, "&quot;")}" ${required ? "required" : ""} ${maxLength ? `maxlength="${maxLength}"` : ""}></textarea>
                </label>
              `;
            }

            return `
              <label class="modal-field">
                <span class="modal-label">${label}</span>
                <input class="modal-input" data-name="${name}" type="${type.replace(/"/g, "")}" placeholder="${placeholder.replace(/"/g, "&quot;")}" ${required ? "required" : ""} ${maxLength ? `maxlength="${maxLength}"` : ""} />
              </label>
            `;
          })
          .join("");

        modal.innerHTML = `
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
          </div>
          <div class="modal-body">
            <div class="modal-form">
              ${bodyHtml}
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn cancel-btn">${cancelText}</button>
            <button class="modal-btn confirm-btn primary">${confirmText}</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const cancelBtn = modal.querySelector(".cancel-btn");
        const confirmBtn = modal.querySelector(".confirm-btn");
        const firstFocusable = modal.querySelector("input,select,textarea,button");
        firstFocusable?.focus?.();

        const close = (value) => {
          overlay.remove();
          resolve(value);
        };

        cancelBtn.addEventListener("click", () => close(null));

        confirmBtn.addEventListener("click", () => {
          const result = {};
          let ok = true;

          modal.querySelectorAll("[data-name]").forEach((node) => {
            const key = node.getAttribute("data-name");
            if (!key) return;

            const required = node.hasAttribute("required");
            const val = String(node.value || "").trim();
            if (required && !val) {
              ok = false;
              node.classList.add("error");
              setTimeout(() => node.classList.remove("error"), 320);
            }
            result[key] = val;
          });

          if (!ok) return;
          close(result);
        });

        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) close(null);
        });

        document.addEventListener(
          "keydown",
          (e) => {
            if (e.key === "Escape") close(null);
          },
          { once: true }
        );

        setTimeout(() => {
          overlay.classList.add("show");
        }, 10);
      });
    },

    confirm: function(options = {}) {
      return new Promise((resolve) => {
        const {
          title = "Bestätigung",
          message = "Sind Sie sicher?",
          cancelText = "Abbrechen",
          confirmText = "Bestätigen",
          type = "warning" // warning, danger, info
        } = options;

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = `modal-dialog confirm-dialog confirm-${type}`;

        modal.innerHTML = `
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
          </div>
          <div class="modal-body">
            <p class="modal-message">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="modal-btn cancel-btn">${cancelText}</button>
            <button class="modal-btn confirm-btn primary">${confirmText}</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const cancelBtn = modal.querySelector(".cancel-btn");
        const confirmBtn = modal.querySelector(".confirm-btn");

        cancelBtn.addEventListener("click", () => {
          overlay.remove();
          resolve(false);
        });

        confirmBtn.addEventListener("click", () => {
          overlay.remove();
          resolve(true);
        });

        overlay.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            cancelBtn.click();
          }
        });

        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            cancelBtn.click();
          }
        });

        setTimeout(() => {
          overlay.classList.add("show");
        }, 10);

        confirmBtn.focus();
      });
    },

    alert: function(options = {}) {
      return new Promise((resolve) => {
        const {
          title = "Hinweis",
          message = "Information",
          buttonText = "OK",
          type = "info" // info, success, error, warning
        } = options;

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = `modal-dialog alert-dialog alert-${type}`;

        modal.innerHTML = `
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
          </div>
          <div class="modal-body">
            <p class="modal-message">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="modal-btn confirm-btn primary full">${buttonText}</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const btn = modal.querySelector(".confirm-btn");

        btn.addEventListener("click", () => {
          overlay.remove();
          resolve(true);
        });

        overlay.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            btn.click();
          }
        });

        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            btn.click();
          }
        });

        setTimeout(() => {
          overlay.classList.add("show");
        }, 10);

        btn.focus();
      });
    }
  };

  window.echtluckyModal = echtluckyModal;

  window.promptModal = (title, placeholder) => {
    return echtluckyModal.input({ title, placeholder });
  };

})();
