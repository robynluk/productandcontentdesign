import { computeCellLayout, cellCenter as cellCenterAt, buildCapsulePath } from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const SHUFFLE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class GridRenderer {
  constructor(letterContainer, svg, wrap) {
    this.letterContainer = letterContainer;
    this.svg = svg;
    this.wrap = wrap;
    this.cellSize = 32;
    this.cellEls = [];

    this.capsuleGroup = document.createElementNS(SVG_NS, "g");
    this.svg.appendChild(this.capsuleGroup);

    this.dragLine = document.createElementNS(SVG_NS, "line");
    this.dragLine.setAttribute("class", "drag-line");
    this.svg.appendChild(this.dragLine);

    // On mobile/tablet (touch) the drag-line's zero-length "dot" (a round
    // line-cap only a few px across) is hard to see, so the first selected
    // letter gets an actual circle there instead — see showDragLine below.
    this.startCircle = document.createElementNS(SVG_NS, "circle");
    this.startCircle.setAttribute("class", "start-circle");
    this.svg.appendChild(this.startCircle);
  }

  fitToContainer(rows, cols) {
    const parent = this.wrap.parentElement;
    const style = getComputedStyle(parent);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availW = parent.clientWidth - padX;
    // On mobile the page scrolls rather than being locked to one viewport
    // height, so let available width alone drive cell size there instead
    // of it being capped by whatever height happens to be left over —
    // bigger, more legible cells are worth a bit of extra scrolling.
    const availH = window.innerWidth <= 640 ? Infinity : parent.clientHeight - padY;

    const { cellSize, gridWidth, gridHeight } = computeCellLayout(availW, availH, rows, cols);
    this.cellSize = cellSize;

    this.wrap.style.width = gridWidth + "px";
    this.wrap.style.height = gridHeight + "px";
    this.svg.setAttribute("width", gridWidth);
    this.svg.setAttribute("height", gridHeight);
    this.svg.setAttribute("viewBox", `0 0 ${gridWidth} ${gridHeight}`);

    this.letterContainer.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
    this.letterContainer.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
    this.letterContainer.style.width = gridWidth + "px";
    this.letterContainer.style.height = gridHeight + "px";
  }

  renderLetters(grid) {
    this.letterContainer.innerHTML = "";
    this.cellEls = [];
    const fontSize = Math.max(10, Math.round(this.cellSize * 0.46));

    for (let r = 0; r < grid.rows; r++) {
      const rowEls = [];
      for (let c = 0; c < grid.cols; c++) {
        const div = document.createElement("div");
        div.className = "cell";
        div.style.fontSize = fontSize + "px";
        div.dataset.r = r;
        div.dataset.c = c;
        div.textContent = grid.cells[r][c].letter;
        this.letterContainer.appendChild(div);
        rowEls.push(div);
      }
      this.cellEls.push(rowEls);
    }
  }

  // Animates every existing cell through a couple of random letters before
  // settling on newGrid's real letters — used when switching modes so the
  // letters visibly "shuffle" instead of instantly swapping.
  shuffleToLetters(newGrid, onDone) {
    const rows = this.cellEls.length;
    const cols = rows ? this.cellEls[0].length : 0;
    if (rows !== newGrid.rows || cols !== newGrid.cols) {
      this.renderLetters(newGrid);
      if (onDone) onDone();
      return;
    }

    const flickers = 3;
    const stepMs = 55;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const el = this.cellEls[r][c];
          if (tick >= flickers) {
            el.textContent = newGrid.cells[r][c].letter;
          } else {
            el.textContent = SHUFFLE_LETTERS[Math.floor(Math.random() * SHUFFLE_LETTERS.length)];
          }
        }
      }
      if (tick >= flickers) {
        clearInterval(timer);
        if (onDone) onDone();
      }
    }, stepMs);
  }

  cellCenter(r, c) {
    return cellCenterAt(r, c, this.cellSize);
  }

  cellEl(r, c) {
    return this.cellEls[r]?.[c];
  }

  clearCapsules() {
    this.capsuleGroup.innerHTML = "";
  }

  _pathFor(placement) {
    const start = this.cellCenter(placement.row, placement.col);
    const endCell = placement.cells[placement.cells.length - 1];
    const end = this.cellCenter(endCell.r, endCell.c);
    // Slightly wider on mobile/tablet (touch, fingers are less precise than
    // a mouse cursor) — at that size the capsule otherwise hugs the letters
    // closely enough to look cramped against them.
    const isTouch = window.innerWidth <= 1024;
    const halfWidth = this.cellSize * (isTouch ? 0.36 : 0.3);
    const extend = this.cellSize * 0.22;
    return buildCapsulePath(start.x, start.y, end.x, end.y, halfWidth, extend);
  }

  drawCapsuleStatic(placement) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "capsule is-filled");
    path.setAttribute("d", this._pathFor(placement));
    this.capsuleGroup.appendChild(path);
    return path;
  }

  // Draws the capsule stroke with a dash-offset reveal over drawMs; calls
  // onDone once it finishes.
  animateDraw(placement, drawMs, onDone) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "capsule");
    path.setAttribute("d", this._pathFor(placement));
    this.capsuleGroup.appendChild(path);

    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset ${drawMs}ms cubic-bezier(0.34, 1.05, 0.64, 1)`;
    requestAnimationFrame(() => {
      path.style.strokeDashoffset = "0";
      path.classList.add("is-filled");
    });

    setTimeout(() => {
      if (onDone) onDone();
    }, drawMs);
    return path;
  }

  showDragLine(p1, p2) {
    const isDot = p1.x === p2.x && p1.y === p2.y;
    if (isDot && window.innerWidth <= 1024) {
      this.dragLine.style.opacity = "0";
      this.startCircle.setAttribute("cx", p1.x);
      this.startCircle.setAttribute("cy", p1.y);
      this.startCircle.setAttribute("r", this.cellSize * 0.4);
      this.startCircle.style.opacity = "1";
      return;
    }

    this.startCircle.style.opacity = "0";
    this.dragLine.setAttribute("x1", p1.x);
    this.dragLine.setAttribute("y1", p1.y);
    this.dragLine.setAttribute("x2", p2.x);
    this.dragLine.setAttribute("y2", p2.y);
    this.dragLine.style.opacity = "0.6";
  }

  hideDragLine() {
    this.dragLine.style.opacity = "0";
    this.startCircle.style.opacity = "0";
  }
}
