// Page regions and their margins (like InDesign margin guides).
// The side stripe (.shape[data-role="sidebar"]) and the header rule (.shape[data-role="rule"])
// split the page into four regions: header left/right and main/side column. Each region has its
// own margins, stored on the page as
//   data-margins="header-left 28 19 40 28; header-right …; main …; side …"   (top bottom left right, px)
// Changing a margin moves the frames that sit on it (InDesign's "layout adjustment").

export const REGIONS = [
  { id: 'header-left', label: 'Header · left' },
  { id: 'header-right', label: 'Header · right' },
  { id: 'main', label: 'Main column' },
  { id: 'side', label: 'Side column' },
];
export const SIDES = ['top', 'bottom', 'left', 'right'];
const DEFAULT_MARGIN = 20; // for a region without frames
const SNAP = 1; // a frame edge within 1px of a margin counts as sitting on it

export const MARGINS_CSS = `
  .cv-margin {
    position: absolute; z-index: 4; pointer-events: none; box-sizing: border-box;
    border: 1px dashed rgba(150, 80, 220, .55);
  }
  .cv-margin.cv-hot { border: 1.5px solid rgba(150, 80, 220, .9); background: rgba(150, 80, 220, .05); }
  body.cv-hide-margins .cv-margin { display: none; }
  @media print { .cv-margin { display: none !important; } }
`;

/** The four regions as { id: {l, t, r, b} }, or null if the page has no side stripe and header rule. */
export function regionRects(page) {
  const stripe = page?.querySelector(':scope > .shape[data-role="sidebar"]');
  const rule = page?.querySelector(':scope > .shape[data-role="rule"]');
  if (!stripe || !rule) return null;
  const W = page.offsetWidth;
  const H = page.offsetHeight;
  const x = stripe.offsetLeft;
  const top = rule.offsetTop;
  const bottom = rule.offsetTop + rule.offsetHeight;
  return {
    'header-left': { l: 0, t: 0, r: x, b: top },
    'header-right': { l: x, t: 0, r: W, b: top },
    main: { l: 0, t: bottom, r: x, b: H },
    side: { l: x, t: bottom, r: W, b: H },
  };
}

const geom = (el) => ({ l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight });

/** Frames whose center lies in the region. */
function framesIn(page, R) {
  return [...page.querySelectorAll(':scope > .frame')].filter((f) => {
    const g = geom(f);
    const cx = (g.l + g.r) / 2;
    const cy = (g.t + g.b) / 2;
    return cx >= R.l && cx < R.r && cy >= R.t && cy < R.b;
  });
}

/** Margins that fit the frames already in the region, so nothing moves the first time. */
function deriveMargins(page, R) {
  const gs = framesIn(page, R).map(geom);
  if (!gs.length) return { top: DEFAULT_MARGIN, bottom: DEFAULT_MARGIN, left: DEFAULT_MARGIN, right: DEFAULT_MARGIN };
  const clamp = (v) => Math.max(0, Math.round(v));
  return {
    top: clamp(Math.min(...gs.map((g) => g.t)) - R.t),
    bottom: clamp(R.b - Math.max(...gs.map((g) => g.b))),
    left: clamp(Math.min(...gs.map((g) => g.l)) - R.l),
    right: clamp(R.r - Math.max(...gs.map((g) => g.r))),
  };
}

/** Reads { regionId: { top, bottom, left, right } } from the page. */
export function readMargins(page) {
  const out = {};
  for (const part of (page?.dataset.margins ?? '').split(';')) {
    const [id, ...nums] = part.trim().split(/\s+/);
    if (!REGIONS.some((r) => r.id === id) || nums.length !== 4) continue;
    out[id] = Object.fromEntries(SIDES.map((s, i) => [s, Number(nums[i]) || 0]));
  }
  return out;
}

function writeMargins(page, margins) {
  page.dataset.margins = REGIONS.filter((r) => margins[r.id])
    .map((r) => `${r.id} ${SIDES.map((s) => margins[r.id][s]).join(' ')}`).join('; ');
}

/** Makes sure every region has margins (derived from the current layout when missing). */
export function initMargins(page) {
  const rects = regionRects(page);
  if (!rects) return;
  const margins = readMargins(page);
  const missing = REGIONS.filter((r) => !margins[r.id]);
  if (!missing.length) return;
  for (const r of missing) margins[r.id] = deriveMargins(page, rects[r.id]);
  writeMargins(page, margins);
}

/** Inner boxes of the regions: [{ id, R, l, t, r, b }]. */
export function marginBoxes(page) {
  const rects = regionRects(page);
  if (!rects) return [];
  const margins = readMargins(page);
  return REGIONS.filter((r) => margins[r.id]).map(({ id }) => {
    const R = rects[id];
    const m = margins[id];
    return { id, R, l: R.l + m.left, t: R.t + m.top, r: R.r - m.right, b: R.b - m.bottom };
  });
}

/**
 * Changes one margin and adjusts the frames of that region:
 *  - left/right: frames on that margin follow it; frames on both side margins are resized instead.
 *  - top: every frame in the region moves with it (keeps the stack together).
 *  - bottom: only the guide moves.
 */
export function setMargin(page, id, side, value) {
  const rects = regionRects(page);
  if (!rects) return;
  const margins = readMargins(page);
  const R = rects[id];
  const m = margins[id] ?? deriveMargins(page, R);
  const v = Math.max(0, Math.round(value));
  const d = v - m[side];
  if (!d) return;
  const box = { l: R.l + m.left, r: R.r - m.right };
  const near = (a, b) => Math.abs(a - b) <= SNAP;
  for (const f of framesIn(page, R)) {
    const g = geom(f);
    const onLeft = near(g.l, box.l);
    const onRight = near(g.r, box.r);
    if (side === 'top') {
      f.style.top = `${g.t + d}px`;
    } else if (side === 'left' && onLeft) {
      f.style.left = `${g.l + d}px`;
      if (onRight) f.style.width = `${Math.max(40, g.r - g.l - d)}px`;
    } else if (side === 'right' && onRight) {
      if (onLeft) f.style.width = `${Math.max(40, g.r - g.l - d)}px`;
      else f.style.left = `${g.l - d}px`;
    }
  }
  margins[id] = { ...m, [side]: v };
  writeMargins(page, margins);
}

/** Draws the margin guides (editor only: they carry the editor attribute and are never saved). */
export function drawMarginGuides(page, attr, hot = null) {
  if (!page) return;
  page.querySelectorAll(':scope > .cv-margin').forEach((g) => g.remove());
  for (const b of marginBoxes(page)) {
    const g = page.ownerDocument.createElement('div');
    g.setAttribute(attr, '');
    g.setAttribute('contenteditable', 'false');
    g.className = `cv-margin${b.id === hot ? ' cv-hot' : ''}`;
    g.dataset.region = b.id;
    Object.assign(g.style, { left: `${b.l}px`, top: `${b.t}px`, width: `${b.r - b.l}px`, height: `${b.b - b.t}px` });
    page.append(g);
  }
}
