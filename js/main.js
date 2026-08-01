import { buildIntroTokens, buildCompanyTokens } from "./wordList.js";
import { GridRenderer } from "./gridRenderer.js";
import { AnimationController } from "./animationController.js";
import { InteractionController } from "./interactionController.js";

// Shared by both modes so the grid box, cell size, and font size never
// change when the toggle is flipped — only the letters do. Wider-than-tall
// on desktop on purpose: the puzzle area's height budget is much tighter
// than its width budget there, so fewer rows (more columns) lets cells grow
// bigger within that fixed vertical space. Portrait phones/tablets flip
// that ratio (width is the tight budget), so they get taller/narrower grids
// — chosen once at load to match the CSS breakpoints in style.css. This is
// decided once, not live-updated on resize/rotation (see refit() below).
function getGridDims() {
  const w = window.innerWidth;
  // Both dimensions need to stay near-square and >=13 (the longest company
  // word, ANALOGDEVICES) at mobile widths — .puzzle-area's flex:1 box ends
  // up tall relative to its width there, so a wide-and-short grid (like the
  // desktop 10x20) would render tiny, cramped cells instead of using that
  // space.
  if (w <= 640) return { rows: 14, cols: 14 };
  if (w <= 1024) return { rows: 12, cols: 16 };
  return { rows: 10, cols: 20 };
}
const { rows: ROWS, cols: COLS } = getGridDims();

const NEXT_DIFFICULTY = { base: "intermediate", intermediate: "hard", hard: "hard" };
const MODAL_COPY = {
  base: { title: "Way to go", subtitle: "When was the last time you were in flow state?", cta: "Next level" },
  intermediate: { title: "You're pretty good", subtitle: "Flow state feels pretty good, doesn't it?", cta: "Next level" },
  hard: { title: "You're really good", subtitle: "But most importantly, I hope you're having a good time", cta: "Last level" },
};

const introTokens = buildIntroTokens();
const companyTokens = buildCompanyTokens();

const wrap = document.getElementById("gridWrap");
const letters = document.getElementById("letters");
const overlay = document.getElementById("overlay");
const checklistEl = document.getElementById("checklist");
const toggleButtons = document.querySelectorAll(".toggle__option");
const winModal = document.getElementById("winModal");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const modalCta = document.getElementById("modalCta");

const renderer = new GridRenderer(letters, overlay, wrap);

function renderChecklist(allTokens, foundSeqs) {
  checklistEl.innerHTML = "";
  allTokens.forEach((t) => {
    const span = document.createElement("span");
    span.className = "chip" + (foundSeqs.has(t.seq) ? " is-found" : "");
    span.textContent = t.display;
    checklistEl.appendChild(span);
  });
}

function showWinModal(difficulty) {
  const copy = MODAL_COPY[difficulty] || MODAL_COPY.base;
  modalTitle.textContent = copy.title;
  modalSubtitle.textContent = copy.subtitle;
  modalCta.textContent = copy.cta;
  modalCta.dataset.nextDifficulty = NEXT_DIFFICULTY[difficulty] || "base";
  winModal.hidden = false;
}

const anim = new AnimationController({ renderer, tokens: introTokens, rows: ROWS, cols: COLS });
const interaction = new InteractionController({
  renderer,
  wrapEl: wrap,
  tokens: companyTokens,
  rows: ROWS,
  cols: COLS,
  onFoundChange: renderChecklist,
  onWin: showWinModal,
});

let mode = "auto";

function setMode(next) {
  if (mode === next) return;
  mode = next;
  toggleButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.mode === next));

  if (next === "auto") {
    interaction.stop();
    wrap.classList.remove("is-interactive");
    checklistEl.style.visibility = "hidden";
    winModal.hidden = true;
    anim.start({ shuffle: true });
  } else {
    anim.stop();
    wrap.classList.add("is-interactive");
    checklistEl.style.visibility = "visible";
    interaction.start({ shuffle: true, difficulty: "base" });
  }
}

toggleButtons.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

modalCta.addEventListener("click", () => {
  winModal.hidden = true;
  interaction.start({ shuffle: true, difficulty: modalCta.dataset.nextDifficulty || "base" });
});

function refit() {
  if (mode === "auto" && anim.grid) {
    renderer.fitToContainer(anim.grid.rows, anim.grid.cols);
    renderer.renderLetters(anim.grid);
    renderer.clearCapsules();
    anim.placements.slice(0, anim.index).forEach((p) => renderer.drawCapsuleStatic(p));
  } else if (mode === "brain" && interaction.grid) {
    renderer.fitToContainer(interaction.grid.rows, interaction.grid.cols);
    renderer.renderLetters(interaction.grid);
    renderer.clearCapsules();
    interaction.placements
      .filter((p) => interaction.foundSeqs.has(p.seq))
      .forEach((p) => renderer.drawCapsuleStatic(p));
  }
}

let resizeTimeout = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(refit, 150);
});

// Populate the checklist with its real content immediately, before any mode
// switch, so it always occupies the same height — otherwise it starts at
// zero height (visibility:hidden preserves layout space, but an empty
// element still has none) and only grows once manual mode has been entered
// at least once, permanently shrinking the grid's available space from then on.
renderChecklist(companyTokens, new Set());
checklistEl.style.visibility = "hidden";
anim.start();

// The very first fitToContainer above can run before all subresources
// (e.g. the Google Fonts stylesheet) are applied, so it can measure a
// slightly-off .puzzle-area height that never gets corrected until a real
// resize fires. Refit once more once the page has fully settled so the
// initial auto-mode grid always lands on the same size a mode toggle would.
if (document.readyState === "complete") {
  refit();
} else {
  window.addEventListener("load", refit, { once: true });
}
