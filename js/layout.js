const headerContainer = document.getElementById("header-container");
const footerContainer = document.getElementById("footer-container");

const setupHeader = () => {
  const header = document.getElementById("site-header");
  if (!header) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const pageName = currentPage.replace(".html", "") || "index";

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.dataset.page === pageName) {
      link.classList.add("active");
    }
  });
};

const legalContent = {
  impressum: {
    title: "Impressum",
    content: `
      <h3>Angaben gemäß § 5 TMG</h3>
      <p><strong>LCKY HUB</strong><br>
      Ein Projekt von LCKY</p>
      
      <h3>Kontakt</h3>
      <p>E-Mail: contact@lcky-hub.com</p>
      
      <h3>Haftung für Inhalte</h3>
      <p>Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
      
      <h3>Haftung für Links</h3>
      <p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
      
      <h3>Urheberrecht</h3>
      <p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>
    `
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    content: `
      <h3>1. Datenschutz auf einen Blick</h3>
      <p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.</p>
      
      <h3>2. Allgemeine Hinweise</h3>
      <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.</p>
      
      <h3>3. Datenerfassung auf unserer Website</h3>
      <p><strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong></p>
      <p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.</p>
      
      <h3>4. Ihre Rechte</h3>
      <p>Sie haben jederzeit das Recht:</p>
      <ul>
          <li>Auskunft über Ihre bei uns gespeicherten Daten zu erhalten</li>
          <li>Die Berichtigung unrichtiger Daten zu verlangen</li>
          <li>Die Löschung Ihrer Daten zu verlangen</li>
          <li>Die Einschränkung der Datenverarbeitung zu verlangen</li>
          <li>Widerspruch gegen die Datenverarbeitung einzulegen</li>
      </ul>
      
      <h3>5. Datensicherheit</h3>
      <p>Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure Socket Layer) in Verbindung mit der jeweils höchsten Verschlüsselungsstufe, die von Ihrem Browser unterstützt wird.</p>
    `
  },
  nutzungsbedingungen: {
    title: "Nutzungsbedingungen",
    content: `
      <h3>1. Geltungsbereich</h3>
      <p>Diese Nutzungsbedingungen gelten für die Nutzung der Website LCKY HUB. Mit dem Zugriff auf diese Website erklären Sie sich mit diesen Bedingungen einverstanden.</p>
      
      <h3>2. Nutzung der Website</h3>
      <p>Die Inhalte dieser Website dienen ausschließlich zu Informationszwecken. Eine kommerzielle Nutzung der Inhalte bedarf der vorherigen schriftlichen Zustimmung.</p>
      
      <h3>3. Geistiges Eigentum</h3>
      <p>Alle Inhalte dieser Website, einschließlich Texte, Grafiken, Logos und Bilder, sind Eigentum von LCKY HUB oder seinen Lizenzgebern und durch Urheberrechte geschützt.</p>
      
      <h3>4. Haftungsausschluss</h3>
      <p>Die Informationen auf dieser Website werden mit größtmöglicher Sorgfalt erstellt. Dennoch können wir keine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen.</p>
      
      <h3>5. Änderungen der Bedingungen</h3>
      <p>Wir behalten uns das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Die geänderten Bedingungen werden auf dieser Website veröffentlicht.</p>
      
      <h3>6. Salvatorische Klausel</h3>
      <p>Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
    `
  }
};

const setupFooter = () => {
  const modal = document.getElementById("legal-modal");
  if (!modal) return;

  window.openLegalModal = (type) => {
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");
    if (!title || !body) return;

    const content = legalContent[type];
    if (!content) return;

    title.textContent = content.title;
    body.innerHTML = content.content;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  window.closeLegalModal = () => {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      window.closeLegalModal();
    }
  });
};

export const loadLayout = async () => {
  if (!headerContainer || !footerContainer) return;

  const [header, footer] = await Promise.all([
    fetch("header.html").then((res) => res.text()),
    fetch("footer.html").then((res) => res.text())
  ]);

  headerContainer.innerHTML = header;
  footerContainer.innerHTML = footer;

  setupHeader();
  setupFooter();
};
