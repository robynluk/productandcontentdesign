export function computeCellLayout(containerWidth, containerHeight, rows, cols, opts = {}) {
  const minCell = opts.minCell ?? 14;
  const maxCell = opts.maxCell ?? 120;
  const raw = Math.min(containerWidth / cols, containerHeight / rows);
  const cellSize = Math.max(minCell, Math.min(maxCell, Math.floor(raw)));
  return {
    cellSize,
    gridWidth: cellSize * cols,
    gridHeight: cellSize * rows,
  };
}

export function cellCenter(r, c, cellSize) {
  return { x: c * cellSize + cellSize / 2, y: r * cellSize + cellSize / 2 };
}

// halfWidth: perpendicular offset AND cap radius (same for every direction —
// this is what makes every capsule visually the same "width").
// extend: how far past the first/last letter center the capsule stretches
// before the rounded cap begins (also the same for every direction, but
// intentionally smaller than halfWidth so caps sit close to the letters).
export function buildCapsulePath(x1, y1, x2, y2, halfWidth, extend = halfWidth) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (len < 0.001) {
    const r = halfWidth;
    return `M ${x1 - r} ${y1} A ${r} ${r} 0 1 0 ${x1 + r} ${y1} A ${r} ${r} 0 1 0 ${x1 - r} ${y1} Z`;
  }

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const ex1 = x1 - ux * extend;
  const ey1 = y1 - uy * extend;
  const ex2 = x2 + ux * extend;
  const ey2 = y2 + uy * extend;

  const r = halfWidth;
  const p1a = [ex1 + px * r, ey1 + py * r];
  const p1b = [ex1 - px * r, ey1 - py * r];
  const p2a = [ex2 + px * r, ey2 + py * r];
  const p2b = [ex2 - px * r, ey2 - py * r];

  return (
    `M ${p1a[0]} ${p1a[1]} ` +
    `L ${p2a[0]} ${p2a[1]} ` +
    `A ${r} ${r} 0 0 0 ${p2b[0]} ${p2b[1]} ` +
    `L ${p1b[0]} ${p1b[1]} ` +
    `A ${r} ${r} 0 0 0 ${p1a[0]} ${p1a[1]} Z`
  );
}
