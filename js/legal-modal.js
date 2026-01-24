(function () {
  function qs(id) { return document.getElementById(id); }

  function wireUpModal() {
    const modal = qs('legalModal');
    const contentEl = qs('legalModalContent');
    const titleEl = qs('legalModalTitle');
    const closeBtn = qs('legalModalClose');

    if (!modal || !contentEl || !titleEl || !closeBtn) return;

    function openModal(title) {
      titleEl.textContent = title || "Info";
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

    async function loadIntoModal(url, title) {
      contentEl.innerHTML = "<p style='opacity:.8'>Lade Inhalt...</p>";
      openModal(title);

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);

        const html = await res.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;

        const main = temp.querySelector('main');
        contentEl.innerHTML = main ? main.innerHTML : temp.innerHTML;
      } catch (err) {
        contentEl.innerHTML =
          "<p style='color:#ff3366'>Fehler beim Laden: " + err.message + "</p>";
      }
    }

    // Footer-Links öffnen Modal
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-modal]');
      if (!a) return;

      e.preventDefault();
      loadIntoModal(a.dataset.modal, a.textContent.trim());
    });

    // X schließt Modal
    closeBtn.addEventListener('click', closeModal);

    // Klick auf Backdrop schließt
    modal.addEventListener('click', (e) => {
      if (e.target?.dataset?.close) closeModal();
    });

    // ESC schließt
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
    });
  }

  // läuft nach DOM
  document.addEventListener('DOMContentLoaded', wireUpModal);

  // falls Footer später per fetch reinkommt: nochmal kurz nachziehen
  setTimeout(wireUpModal, 500);
})();