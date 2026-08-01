import { generateLayout } from "./gridGenerator.js";

export class InteractionController {
  constructor({ renderer, wrapEl, tokens, rows, cols, onFoundChange, onWin }) {
    this.renderer = renderer;
    this.wrapEl = wrapEl;
    this.tokens = tokens;
    this.rows = rows;
    this.cols = cols;
    this.onFoundChange = onFoundChange;
    this.onWin = onWin;

    this.active = false;
    this.foundSeqs = new Set();
    this.placements = [];
    this.grid = null;
    this.difficulty = "base";

    this.gesture = null;
    this.startCell = null;
    this.currentCell = null;
    this.pendingClickStart = null;
    this.isDragging = false;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  start({ shuffle = false, difficulty = "base" } = {}) {
    this.active = true;
    this.foundSeqs = new Set();
    this.pendingClickStart = null;
    this.difficulty = difficulty;

    const hadGrid = Boolean(this.grid);
    const { grid, placements } = generateLayout(this.tokens, this.rows, this.cols, difficulty);
    this.grid = grid;
    this.placements = placements;

    this.onFoundChange(this.tokens, this.foundSeqs);

    this.renderer.fitToContainer(grid.rows, grid.cols);
    this.renderer.clearCapsules();
    if (shuffle && hadGrid) {
      this.renderer.shuffleToLetters(grid);
    } else {
      this.renderer.renderLetters(grid);
    }

    this.wrapEl.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);

    return { grid, placements };
  }

  stop() {
    this.active = false;
    this.wrapEl.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    this._resetGesture();
  }

  _cellFromEvent(evt) {
    const target = evt.target.closest && evt.target.closest(".cell");
    if (!target) return null;
    return { r: parseInt(target.dataset.r, 10), c: parseInt(target.dataset.c, 10) };
  }

  _onPointerDown(evt) {
    if (!this.active) return;
    const cell = this._cellFromEvent(evt);
    if (!cell) return;
    if (this._isCellLocked(cell)) return;

    if (this.pendingClickStart) {
      const start = this.pendingClickStart;
      this.pendingClickStart = null;
      this._resolveLineSelection(start, cell);
      return;
    }

    this.gesture = "down";
    this.startCell = cell;
    this.currentCell = cell;
    this.isDragging = true;
  }

  // The straight line is the only selection indicator. Runs both mid-drag
  // (isDragging, startCell is the drag's press point) and while hovering
  // after a first click, before the second click lands (pendingClickStart)
  // — either way it previews the line from whichever start point is active.
  _onPointerMove(evt) {
    if (!this.active) return;
    const startCell = this.isDragging ? this.startCell : this.pendingClickStart;
    if (!startCell) return;

    const cell = this._cellFromEvent(evt);
    if (!cell) return;
    this.currentCell = cell;

    const dr = cell.r - startCell.r;
    const dc = cell.c - startCell.c;
    const isStraight = dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc);
    if (!isStraight) return;

    this.gesture = "line";
    const p1 = this.renderer.cellCenter(startCell.r, startCell.c);
    const p2 = this.renderer.cellCenter(cell.r, cell.c);
    this.renderer.showDragLine(p1, p2);
  }

  _onPointerUp(evt) {
    if (!this.active || !this.isDragging) return;
    this.isDragging = false;
    const cell = this._cellFromEvent(evt) || this.currentCell;
    const moved = cell && (cell.r !== this.startCell.r || cell.c !== this.startCell.c);

    if (moved) {
      this._resolveLineSelection(this.startCell, cell);
    } else {
      this.pendingClickStart = this.startCell;
      // A zero-length line still renders as a round dot (stroke-linecap:
      // round), so the first letter of a click-then-click stays marked
      // using the exact same line indicator, nothing extra needed.
      const p = this.renderer.cellCenter(this.startCell.r, this.startCell.c);
      this.renderer.showDragLine(p, p);
      this.gesture = null;
      this.startCell = null;
    }
  }

  _resolveLineSelection(startCell, endCell) {
    const dr = Math.sign(endCell.r - startCell.r);
    const dc = Math.sign(endCell.c - startCell.c);
    const length =
      Math.max(Math.abs(endCell.r - startCell.r), Math.abs(endCell.c - startCell.c)) + 1;
    const path = [];
    for (let i = 0; i < length; i++) {
      path.push({ r: startCell.r + dr * i, c: startCell.c + dc * i });
    }
    this._checkMatch(path);
  }

  _checkMatch(cells) {
    let match = null;
    for (const p of this.placements) {
      if (this.foundSeqs.has(p.seq)) continue;
      if (this._sameSequence(cells, p.cells) || this._sameSequence(cells, [...p.cells].reverse())) {
        match = p;
        break;
      }
    }

    if (match) {
      this.foundSeqs.add(match.seq);
      this.renderer.animateDraw(match, 350, () => {});
      this.onFoundChange(this.tokens, this.foundSeqs);
      if (this.foundSeqs.size === this.tokens.length) {
        this.onWin(this.difficulty);
      }
    } else {
      this._flashInvalid(cells);
    }
    this._resetGesture();
  }

  _sameSequence(a, b) {
    if (a.length !== b.length) return false;
    return a.every((cell, i) => cell.r === b[i].r && cell.c === b[i].c);
  }

  // A cell is locked once every word using it has already been found — this
  // stops users from re-selecting (or accidentally starting a new selection
  // on) letters that are already circled, while still allowing an unfound
  // word to be selected even if it happens to overlap a found one.
  _isCellLocked(cell) {
    let usedByFound = false;
    let usedByUnfound = false;
    for (const p of this.placements) {
      if (!p.cells.some((c) => c.r === cell.r && c.c === cell.c)) continue;
      if (this.foundSeqs.has(p.seq)) usedByFound = true;
      else usedByUnfound = true;
    }
    return usedByFound && !usedByUnfound;
  }

  _flashInvalid(cells) {
    cells.forEach(({ r, c }) => {
      const el = this.renderer.cellEl(r, c);
      if (el) {
        el.classList.add("is-shake");
        setTimeout(() => el.classList.remove("is-shake"), 300);
      }
    });
  }

  _resetGesture() {
    this.gesture = null;
    this.startCell = null;
    this.renderer.hideDragLine();
  }
}
