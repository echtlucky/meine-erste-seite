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
