const initGeneratorModal = () => {
  const openButton = document.getElementById("open-generator");
  const modal = document.getElementById("generator-modal");
  if (!openButton || !modal) return;

  const textInput = document.getElementById("gen-text");
  const styleSelect = document.getElementById("gen-style");
  const preview = document.getElementById("gen-preview");

  const updatePreview = () => {
    if (!preview) return;
    preview.textContent = textInput.value || "";
    preview.classList.remove("glow-text", "glass-text", "outline-text");
    const style = styleSelect.value;
    if (style === "glass") preview.classList.add("glass-text");
    if (style === "outline") preview.classList.add("outline-text");
    if (style === "mini") {
      preview.textContent = "ˡᶜᵏʸ";
      preview.classList.add("glow-text");
    } else {
      preview.classList.add("glow-text");
    }
  };

  const openModal = () => {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    updatePreview();
  };

  const closeModal = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  openButton.addEventListener("click", openModal);
  modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-generator-close]")) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  [textInput, styleSelect].forEach((el) => {
    if (el) el.addEventListener("input", updatePreview);
  });
};

window.addEventListener("layout:ready", initGeneratorModal);
