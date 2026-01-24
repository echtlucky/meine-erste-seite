// js/legal-modal.js – robust bei Footer via fetch (lazy DOM lookup)

(function () {
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-modal]');
    if (!a) return;

    e.preventDefault();

    // Modal-Elemente erst beim Klick holen (Footer kann später geladen sein)
    const modal = document.getElementById('legalModal');
    const contentEl = document.getElementById('legalModalContent');
    const titleEl = document.getElementById('legalModalTitle');
    const closeBtn = document.getElementById('legalModalClose');

    // Wenn Modal noch nicht existiert -> normale Navigation statt Freeze
    if (!modal || !contentEl || !titleEl) {
      window.location.href = a.getAttribute('href') || a.dataset.modal;
      return;
    }

    const url = a.dataset.modal || a.getAttribute('href');
    const title = a.textContent.trim() || "Info";

    function openModal() {
      titleEl.textContent = title;
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    }

    function closeModal() {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      contentEl.innerHTML = "";
    }

    // Close Binding nur 1x
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = "1";
      closeBtn.addEventListener('click', closeModal);
    }

    if (!modal.dataset.bound) {
      modal.dataset.bound = "1";

      modal.addEventListener('click', (evt) => {
        if (evt.target && evt.target.dataset && evt.target.dataset.close) closeModal();
      });

      document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && modal.classList.contains('show')) closeModal();
      });
    }

    contentEl.innerHTML = "<p style='opacity:.8'>Lade Inhalt...</p>";
    openModal();

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const html = await res.text();
      const temp = document.createElement('div');
      temp.innerHTML = html;

      const main = temp.querySelector('main');
      contentEl.innerHTML = main ? main.innerHTML : temp.innerHTML;
    } catch (err) {
      contentEl.innerHTML = "<p style='color:#ff3366'>Fehler beim Laden: " + err.message + "</p>";
    }
  });
})();