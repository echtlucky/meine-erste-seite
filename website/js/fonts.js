import { loadLayout } from "./layout.js";
import "./auth-modal.js";

const textInput = document.getElementById("font-text");
const sizeInput = document.getElementById("font-size");
const weightInput = document.getElementById("font-weight");
const spacingInput = document.getElementById("letter-spacing");
const lineHeightInput = document.getElementById("line-height");
const transformInput = document.getElementById("text-transform");

const previewTexts = document.querySelectorAll(".preview-text");

const updatePreview = () => {
  const text = textInput.value || "";
  const fontSize = `${sizeInput.value}px`;
  const fontWeight = weightInput.value;
  const letterSpacing = `${spacingInput.value}px`;
  const lineHeight = lineHeightInput.value;
  const transform = transformInput.value;

  previewTexts.forEach((el) => {
    el.textContent = text;
    el.style.fontSize = fontSize;
    el.style.fontWeight = fontWeight;
    el.style.letterSpacing = letterSpacing;
    el.style.lineHeight = lineHeight;
    el.style.textTransform = transform;
  });
};

[textInput, sizeInput, weightInput, spacingInput, lineHeightInput, transformInput].forEach((input) => {
  input.addEventListener("input", updatePreview);
});

loadLayout();
updatePreview();
