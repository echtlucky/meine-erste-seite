(() => {
  "use strict";

  const form = document.getElementById("contactForm");
  if (!form) return;

  const hint = document.getElementById("hint");
  const copyBtn = document.getElementById("copyBtn");

  function buildMailto() {
    const name = String(document.getElementById("name")?.value || "").trim();
    const email = String(document.getElementById("email")?.value || "").trim();
    const subject = String(document.getElementById("subject")?.value || "").trim();
    const message = String(document.getElementById("message")?.value || "").trim();

    const body = `Name: ${name}\nE-Mail: ${email}\n\nNachricht:\n${message}\n`;
    const to = "lucassteckel04@gmail.com";
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { mailto, body };
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { mailto } = buildMailto();
    window.location.href = mailto;
    if (hint) hint.textContent = "Wenn nichts passiert: Pop-up-Blocker prüfen oder den Text kopieren und manuell senden.";
  });

  copyBtn?.addEventListener("click", async () => {
    const { body } = buildMailto();
    if (!body.trim()) return;

    try {
      await navigator.clipboard.writeText(body);
      if (hint) hint.textContent = "Kopiert. Du kannst den Text jetzt überall einfügen.";
    } catch {
      if (hint) hint.textContent = "Kopieren nicht möglich. Markiere den Text und kopiere manuell.";
    }
  });
})();

