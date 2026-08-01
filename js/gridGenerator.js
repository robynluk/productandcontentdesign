const DIRS = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
  { dr: -1, dc: -1 },
  { dr: -1, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: 1, dc: 1 },
];

const MAX_OCCUPANTS_PER_CELL = 2;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const TIERS = [
  { maxOverlap: 1, maxCrossings: 1, attemptCap: 30 },
  { maxOverlap: 2, maxCrossings: 3, attemptCap: 60 },
  { maxOverlap: 3, maxCrossings: 6, attemptCap: 120 },
  { maxOverlap: Infinity, maxCrossings: Infinity, attemptCap: 250 },
];

// Difficulty reuses the strict->loose tier ladder as the lever: harder
// difficulties skip the strictest tier(s) entirely, and widen the band of
// "acceptable" candidates placeWord will randomly pick from (not just the
// single cleanest one), so puzzles get statistically messier even when
// clean placements exist.
const DIFFICULTY_SETTINGS = {
  base: { tiers: TIERS, band: 2 },
  intermediate: { tiers: TIERS.slice(1), band: 3 },
  hard: { tiers: TIERS.slice(2), band: 6 },
  // Used only by the passive "Hello" auto-reveal — purely decorative, so it
  // can afford a few more overlapping words than the interactive puzzle's
  // own easy level without affecting its difficulty progression.
  auto: { tiers: TIERS, band: 5 },
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function makeEmptyGrid(rows, cols) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ r, c, letter: null, occupants: [] });
    }
    cells.push(row);
  }
  return { rows, cols, cells };
}

// Standard segment-intersection test (orientation + on-segment fallback for collinear cases).
function orientation(ax, ay, bx, by, cx, cy) {
  const val = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(ax, ay, bx, by, cx, cy) {
  return (
    bx <= Math.max(ax, cx) + 1e-9 &&
    bx >= Math.min(ax, cx) - 1e-9 &&
    by <= Math.max(ay, cy) + 1e-9 &&
    by >= Math.min(ay, cy) - 1e-9
  );
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1.x, p1.y, q1.x, q1.y, p2.x, p2.y);
  const o2 = orientation(p1.x, p1.y, q1.x, q1.y, q2.x, q2.y);
  const o3 = orientation(p2.x, p2.y, q2.x, q2.y, p1.x, p1.y);
  const o4 = orientation(p2.x, p2.y, q2.x, q2.y, q1.x, q1.y);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1.x, p1.y, p2.x, p2.y, q1.x, q1.y)) return true;
  if (o2 === 0 && onSegment(p1.x, p1.y, q2.x, q2.y, q1.x, q1.y)) return true;
  if (o3 === 0 && onSegment(p2.x, p2.y, p1.x, p1.y, q2.x, q2.y)) return true;
  if (o4 === 0 && onSegment(p2.x, p2.y, q1.x, q1.y, q2.x, q2.y)) return true;
  return false;
}

// Counts how many already-placed words the candidate's capsule line would visually cross,
// ignoring pairs that legitimately share a letter cell (that's governed by overlap rules instead).
function countCrossings(candidateCells, placements) {
  const first = candidateCells[0];
  const last = candidateCells[candidateCells.length - 1];
  const p1 = { x: first.c, y: first.r };
  const q1 = { x: last.c, y: last.r };
  const candidateSet = new Set(candidateCells.map((cell) => `${cell.r},${cell.c}`));

  let crossings = 0;
  for (const placement of placements) {
    const sharesCell = placement.cells.some((cell) => candidateSet.has(`${cell.r},${cell.c}`));
    if (sharesCell) continue;
    const endCell = placement.cells[placement.cells.length - 1];
    const p2 = { x: placement.col, y: placement.row };
    const q2 = { x: endCell.c, y: endCell.r };
    if (segmentsIntersect(p1, q1, p2, q2)) crossings++;
  }
  return crossings;
}

function evaluatePlacement(word, r0, c0, dir, grid, placements, tier) {
  let overlapCount = 0;
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const r = r0 + dir.dr * i;
    const c = c0 + dir.dc * i;
    if (r < 0 || r >= grid.rows || c < 0 || c >= grid.cols) return null;
    const cell = grid.cells[r][c];
    if (cell.letter !== null) {
      if (cell.letter !== word[i]) return null;
      if (cell.occupants.length >= MAX_OCCUPANTS_PER_CELL) return null;
      overlapCount++;
    }
    cells.push({ r, c });
  }
  if (overlapCount > tier.maxOverlap) return null;

  const crossingCount = word.length > 1 ? countCrossings(cells, placements) : 0;
  if (crossingCount > tier.maxCrossings) return null;

  return { cells, overlapCount, crossingCount };
}

function placeWord(token, grid, placements, tier, band) {
  const word = token.text;
  if (!word.length) return null;
  const candidates = [];

  for (const dir of shuffle(token.allowedDirs || DIRS)) {
    const starts = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const rEnd = r + dir.dr * (word.length - 1);
        const cEnd = c + dir.dc * (word.length - 1);
        if (rEnd >= 0 && rEnd < grid.rows && cEnd >= 0 && cEnd < grid.cols) {
          starts.push({ r, c });
        }
      }
    }

    for (const start of shuffle(starts)) {
      const result = evaluatePlacement(word, start.r, start.c, dir, grid, placements, tier);
      if (result) {
        candidates.push({ dir, start, ...result });
        if (candidates.length >= tier.attemptCap) break;
      }
    }
    if (candidates.length >= tier.attemptCap) break;
  }

  if (!candidates.length) return null;
  const score = (c) => c.overlapCount * 3 + c.crossingCount;
  const minScore = Math.min(...candidates.map(score));
  const eligible = candidates.filter((c) => score(c) <= minScore + band);
  return eligible[randInt(eligible.length)];
}

function commitPlacement(token, placement, grid, placements) {
  const { cells, dir, start } = placement;
  const word = token.text;
  for (let i = 0; i < cells.length; i++) {
    const { r, c } = cells[i];
    const cell = grid.cells[r][c];
    cell.letter = word[i];
    cell.occupants.push(token.seq);
  }
  placements.push({
    seq: token.seq,
    word,
    row: start.r,
    col: start.c,
    dir,
    cells,
  });
}

function fillRemaining(grid) {
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.cells[r][c];
      if (cell.letter === null) {
        cell.letter = LETTERS[randInt(LETTERS.length)];
      }
    }
  }
}

function generateOnce(orderedTokens, rows, cols, tiers, band) {
  const grid = makeEmptyGrid(rows, cols);
  const placements = [];
  for (const token of orderedTokens) {
    let placed = null;
    for (const tier of tiers) {
      placed = placeWord(token, grid, placements, tier, band);
      if (placed) break;
    }
    if (!placed) return null;
    commitPlacement(token, placed, grid, placements);
  }
  return { grid, placements };
}

export function generateLayout(tokens, baseRows = 17, baseCols = 26, difficulty = "base") {
  const { tiers, band } = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.base;
  const order = shuffle(tokens).sort((a, b) => b.text.length - a.text.length);
  const sizeSteps = [
    { rows: baseRows, cols: baseCols },
    { rows: baseRows + 4, cols: baseCols + 4 },
    { rows: baseRows + 8, cols: baseCols + 8 },
    { rows: baseRows + 14, cols: baseCols + 14 },
  ];

  for (const size of sizeSteps) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = generateOnce(order, size.rows, size.cols, tiers, band);
      if (result) {
        fillRemaining(result.grid);
        result.placements.sort((a, b) => a.seq - b.seq);
        return result;
      }
    }
  }

  throw new Error("Failed to generate word search layout");
}
