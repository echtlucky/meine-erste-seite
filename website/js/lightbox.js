const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const nextBtn = document.getElementById("lightbox-next");
const prevBtn = document.getElementById("lightbox-prev");

const images = Array.from(document.querySelectorAll(".preview-card img"))
  .filter((img) => img.getAttribute("src"))
  .map((img) => img.getAttribute("src"));

let currentIndex = 0;

const openLightbox = (index) => {
  if (!lightbox || !lightboxImage || !images.length) return;
  currentIndex = index;
  lightboxImage.src = images[currentIndex];
  lightbox.classList.add("active");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const closeLightbox = () => {
  if (!lightbox) return;
  lightbox.classList.remove("active");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

const showNext = () => {
  currentIndex = (currentIndex + 1) % images.length;
  lightboxImage.src = images[currentIndex];
};

const showPrev = () => {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  lightboxImage.src = images[currentIndex];
};

if (lightbox) {
  document.querySelectorAll(".preview-card").forEach((card, index) => {
    card.addEventListener("click", () => openLightbox(index));
  });

  lightbox.addEventListener("click", (event) => {
    if (event.target.matches("[data-lightbox-close]")) {
      closeLightbox();
    }
  });

  nextBtn?.addEventListener("click", showNext);
  prevBtn?.addEventListener("click", showPrev);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowRight") showNext();
    if (event.key === "ArrowLeft") showPrev();
  });
}
