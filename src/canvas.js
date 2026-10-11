// Free-form layout on the A4 page (InDesign/Canva style).
//  - Frame (.frame): text box with left/top/width; its height comes from its content.
//  - Shape (.shape): colored rectangle with left/top/width/height (backgrounds, lines).
// Like Canva: a click selects a frame or shape as an object (drag or arrow keys to move it);
// dragging on an empty area draws a selection box, ⇧+click adds/removes, ⌘A selects all, and
// several objects move together. Double-click or Enter edits a frame's text (the only way to
// select text), Esc goes back. Resize with the handles,
// soft snap to the edges/centers of the page and of other elements (⌥ disables it).

const GAP = 16; // standard spacing between sections
const SNAP_PX = 6; // snap distance, in screen pixels

export const CANVAS_CSS = `
  .page > .frame:hover, .page > .shape:hover { outline: 1px dashed rgba(43,87,151,.45); outline-offset: 2px; }
  .page > .shape { cursor: move; }
  .page > .cv-selected { outline: 1.5px solid #2b5797 !important; outline-offset: 2px; }
  .cv-ctl-frame { top: -32px; left: -3px; padding-bottom: 8px; }
  .page > .frame:hover > .cv-ctl-frame, .page > .shape:hover > .cv-ctl-frame,
  .page > .cv-selected > .cv-ctl-frame { display: flex; }
  .cv-h {
    position: absolute; z-index: 21; width: 10px; height: 10px; display: none;
    background: #fff; border: 1.5px solid #2b5797; border-radius: 2px; box-sizing: border-box;
  }
  .page > .cv-selected > .cv-h { display: block; }
  .cv-h[data-dir="e"] { right: -8px; top: calc(50% - 5px); cursor: ew-resize; }
  .cv-h[data-dir="w"] { left: -8px; top: calc(50% - 5px); cursor: ew-resize; }
  .cv-h[data-dir="n"] { top: -8px; left: calc(50% - 5px); cursor: ns-resize; }
  .cv-h[data-dir="s"] { bottom: -8px; left: calc(50% - 5px); cursor: ns-resize; }
  .cv-h[data-dir="ne"] { top: -8px; right: -8px; cursor: nesw-resize; }
  .cv-h[data-dir="nw"] { top: -8px; left: -8px; cursor: nwse-resize; }
  .cv-h[data-dir="se"] { bottom: -8px; right: -8px; cursor: nwse-resize; }
  .cv-h[data-dir="sw"] { bottom: -8px; left: -8px; cursor: nesw-resize; }
  .cv-guide { position: absolute; z-index: 40; pointer-events: none; background: #e8178a; }
  .cv-guide.v { width: 1px; margin-left: -0.5px; }
  .cv-guide.h { height: 1px; margin-top: -0.5px; }
  .cv-guide.gap { background: none; border-left: 1px dashed #e8178a; width: 0; }
  .cv-guide.gap::after {
    content: attr(data-label); position: absolute; left: 4px; top: 50%; transform: translateY(-50%);
    font: 600 10px/1.5 -apple-system, sans-serif; color: #fff; background: #e8178a; padding: 0 4px; border-radius: 3px;
  }
  .cv-badge {
    position: absolute; z-index: 41; pointer-events: none; white-space: nowrap;
    font: 600 10px/1.6 -apple-system, sans-serif; color: #fff; background: #2b5797; padding: 0 6px; border-radius: 3px;
  }
  .page > .cv-overlap { outline: 2px solid #f29900 !important; outline-offset: 2px; }
  .page > .cv-outside { outline: 2px solid #d93025 !important; outline-offset: 2px; }
  body.cv-multi .page > .cv-selected > .cv-h, body.cv-multi .page > .cv-selected > .cv-ctl-frame { display: none; }
  .cv-marquee {
    position: absolute; z-index: 45; pointer-events: none;
    border: 1px solid #2b5797; background: rgba(43,87,151,.08);
  }
  body.cv-moving, body.cv-moving * { user-select: none !important; }
  body.cv-moving .cv-ctl { display: none !important; }
  @media print { .cv-h, .cv-guide, .cv-badge, .cv-marquee { display: none !important; } .page > * { outline: none !important; } }
`;

/**
 * @param {object} o
 * @param {() => Document} o.doc
 * @param {string} o.attr
 * @param {{snapshot: () => void, committed: () => void}} o.history
 * @param {() => boolean} o.snapEnabled
 * @param {() => boolean} o.pushEnabled          when a frame grows, shift the ones below
 * @param {(el: Element|null, count: number) => void} o.onSelect   selection or geometry changed (el: main object)
 * @param {(r: {outside: number, overlaps: number}) => void} o.onLayout
 * @param {(msg: string) => void} o.toast
 */
export function createCanvas({ doc, attr, history, snapEnabled, pushEnabled, onSelect, onLayout, toast }) {
  let selection = []; // selected objects (frames/shapes)
  let selected = null; // main selected object (the last one clicked)
  let frameMode = false; // true: selected as object(s); false: editing the selected frame's text
  let resizeObserver = null;
  let heights = new WeakMap(); // last known height of each frame
  let pushReady = false; // don't push until fonts have loaded (they change every height)

  const page = () => doc()?.querySelector('.page');
  const objects = () => [...(page()?.querySelectorAll(':scope > .frame, :scope > .shape') ?? [])];
  const frames = () => objects().filter((el) => el.classList.contains('frame'));
  const scale = () => {
    const p = page();
    return p ? p.getBoundingClientRect().width / p.offsetWidth || 1 : 1;
  };
  const geom = (el) => ({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

  function editorEl(tag, cls) {
    const el = doc().createElement(tag);
    el.setAttribute(attr, '');
    el.setAttribute('contenteditable', 'false');
    el.className = cls;
    return el;
  }

  // ---------- Controls ----------
  function controls(isShape) {
    const box = editorEl('div', 'cv-ctl cv-ctl-frame');
    for (const [act, icon, title] of [
      ['move', '✥', isShape ? 'Move shape' : 'Move frame (⌥ to move without snapping)'],
      ['dup', '⧉', 'Duplicate (⌘D)'],
      ['del', '✕', 'Delete (⌫ with the frame selected)'],
    ]) {
      const b = doc().createElement('button');
      b.type = 'button';
      b.dataset.act = act;
      b.title = title;
      b.textContent = icon;
      box.append(b);
    }
    return box;
  }

  function ensureControls() {
    const p = page();
    if (!p) return;
    p.querySelectorAll('.cv-ctl-frame, .cv-h').forEach((c) => {
      if (!c.parentElement?.matches('.page > .frame, .page > .shape')) c.remove();
    });
    for (const el of objects()) {
      if (!el.querySelector(':scope > .cv-ctl-frame')) {
        const isShape = el.classList.contains('shape');
        el.append(controls(isShape));
        for (const dir of isShape ? ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] : ['e', 'w']) {
          const h = editorEl('div', 'cv-h');
          h.dataset.dir = dir;
          el.append(h);
        }
      }
    }
    // Watch frame heights (they grow while typing): push the ones below and flag overlaps.
    resizeObserver?.disconnect();
    resizeObserver = new (doc().defaultView.ResizeObserver)(onFramesResized);
    // Only new frames: pending height changes are handled by onFramesResized.
    for (const f of frames()) if (!heights.has(f)) heights.set(f, f.offsetHeight);
    frames().forEach((f) => resizeObserver.observe(f));
  }

  function rememberHeights() {
    heights = new WeakMap(frames().map((f) => [f, f.offsetHeight]));
  }

  /** If a frame changes height, shift the frames right below it by the same amount. */
  function onFramesResized() {
    if (pushReady && pushEnabled()) {
      const list = frames().sort((a, b) => a.offsetTop - b.offsetTop);
      for (const f of list) {
        const old = heights.get(f);
        const delta = old == null ? 0 : f.offsetHeight - old;
        if (!delta) continue;
        const l = f.offsetLeft;
        const r = l + f.offsetWidth;
        const oldBottom = f.offsetTop + old;
        for (const o of list) {
          if (o === f || o.offsetTop < oldBottom - 1) continue;
          if (o.offsetLeft < r && o.offsetLeft + o.offsetWidth > l) o.style.top = `${o.offsetTop + delta}px`;
        }
      }
    }
    rememberHeights();
    checkLayout();
  }

  /** Start pushing (after fonts load) using the current heights as reference. */
  function enablePush() {
    rememberHeights();
    pushReady = true;
  }

  // ---------- Selection ----------
  function select(el, asObject = false) {
    setSelection(el ? [el] : [], asObject);
  }

  /** Selects several objects at once (always as objects, unless editing a single frame). */
  function setSelection(list, asObject = true) {
    selection = list.filter((el) => el?.isConnected);
    selected = selection.at(-1) ?? null;
    frameMode = Boolean(selected) && (asObject || selection.length > 1);
    const d = doc();
    for (const el of objects()) el.classList.toggle('cv-selected', selection.includes(el));
    d.body.classList.toggle('cv-multi', selection.length > 1);
    setEditable(selected && !frameMode ? selected : null);
    if (frameMode || !selected) d.getSelection()?.removeAllRanges();
    for (const n of d.querySelectorAll('[class=""]')) n.removeAttribute('class');
    onSelect(selected, selection.length);
  }

  /** ⇧+click: adds an object to the selection, or removes it. */
  function toggle(el) {
    setSelection(selection.includes(el) ? selection.filter((o) => o !== el) : [...selection, el]);
  }

  /** Only the frame being edited is contentEditable, so text can't be selected elsewhere. */
  function setEditable(frame) {
    for (const f of page()?.querySelectorAll(':scope > .frame[contenteditable]') ?? []) {
      if (f !== frame) f.removeAttribute('contenteditable');
    }
    if (frame && !frame.isContentEditable) frame.contentEditable = 'true';
  }

  /** Enters text editing in a frame, with the caret at the clicked point (or at the end). */
  function editText(frame, x, y) {
    select(frame, false);
    const d = doc();
    frame.focus();
    let range = x == null ? null : d.caretRangeFromPoint?.(x, y);
    if (!range || !frame.contains(range.startContainer) || range.startContainer.parentElement?.closest(`[${attr}]`)) {
      range = d.createRange();
      range.selectNodeContents([...frame.querySelectorAll(`:scope > :not([${attr}])`)].at(-1) ?? frame);
      range.collapse(false);
    }
    const sel = d.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ---------- Snap ----------
  function targets(exclude = []) {
    const p = page();
    const W = p.offsetWidth;
    const H = p.offsetHeight;
    const xs = [0, W / 2, W];
    const ys = [0, H / 2, H];
    const gapTop = []; // where a frame can start: below another + GAP
    const gapBottom = []; // where a frame can end: above another − GAP
    for (const el of objects()) {
      if (exclude.includes(el)) continue;
      const g = geom(el);
      xs.push(g.l, g.l + g.w / 2, g.l + g.w);
      ys.push(g.t, g.t + g.h / 2, g.t + g.h);
      if (el.classList.contains('frame')) {
        gapTop.push({ v: g.t + g.h + GAP, from: g.t + g.h, l: g.l, w: g.w });
        gapBottom.push({ v: g.t - GAP, from: g.t, l: g.l, w: g.w });
      }
    }
    return { xs, ys, gapTop, gapBottom };
  }

  /** Finds the closest snap of any of the `edges` against `values`. */
  function nearest(edges, values, th) {
    let best = null;
    for (const e of edges) {
      for (const v of values) {
        const val = typeof v === 'number' ? v : v.v;
        const d = val - e.pos;
        if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: val, edge: e, target: v };
      }
    }
    return best;
  }

  function clearGuides() {
    page()?.querySelectorAll('.cv-guide, .cv-badge').forEach((g) => g.remove());
  }

  /**
   * Smart guides (like Canva/InDesign): every edge or center of `box` that lines up with an edge or
   * center of another object or of the page. Each guide spans from the box to what it lines up with.
   */
  function alignmentGuides(box, exclude) {
    const p = page();
    const xsOf = (g) => [g.l, g.l + g.w / 2, g.l + g.w];
    const ysOf = (g) => [g.t, g.t + g.h / 2, g.t + g.h];
    const near = (vals, v) => vals.some((m) => Math.abs(m - v) <= 0.5);
    const mx = xsOf(box);
    const my = ysOf(box);
    const guides = new Map(); // "v:x" / "h:y" → { v, at, from, to }
    const add = (v, at, from, to) => {
      const key = `${v ? 'v' : 'h'}:${Math.round(at * 2) / 2}`;
      const g = guides.get(key);
      if (g) Object.assign(g, { from: Math.min(g.from, from), to: Math.max(g.to, to) });
      else guides.set(key, { v, at, from, to });
    };
    const pageBox = { l: 0, t: 0, w: p.offsetWidth, h: p.offsetHeight };
    for (const x of xsOf(pageBox)) if (near(mx, x)) add(true, x, 0, pageBox.h);
    for (const y of ysOf(pageBox)) if (near(my, y)) add(false, y, 0, pageBox.w);
    for (const o of objects()) {
      if (exclude.includes(o)) continue;
      const g = geom(o);
      for (const x of xsOf(g)) {
        if (near(mx, x)) add(true, x, Math.min(box.t, g.t), Math.max(box.t + box.h, g.t + g.h));
      }
      for (const y of ysOf(g)) {
        if (near(my, y)) add(false, y, Math.min(box.l, g.l), Math.max(box.l + box.w, g.l + g.w));
      }
    }
    return [...guides.values()];
  }

  let guideTimer;
  function drawGuides(box, exclude, snapY) {
    clearTimeout(guideTimer);
    clearGuides();
    const p = page();
    for (const { v, at, from, to } of alignmentGuides(box, exclude)) {
      const g = editorEl('div', `cv-guide ${v ? 'v' : 'h'}`);
      Object.assign(g.style, v
        ? { left: `${at}px`, top: `${from}px`, height: `${to - from}px` }
        : { top: `${at}px`, left: `${from}px`, width: `${to - from}px` });
      p.append(g);
    }
    if (snapY) {
      if (typeof snapY.target === 'object') {
        // Standard spacing between frames
        const g = editorEl('div', 'cv-guide gap');
        const top = Math.min(snapY.target.from, snapY.at);
        g.style.top = `${top}px`;
        g.style.height = `${GAP}px`;
        g.style.left = `${box.l + Math.min(box.w, snapY.target.w) / 2}px`;
        g.dataset.label = `${GAP}`;
        p.append(g);
      }
    }
  }

  /** Shows the guides for a moment (after moving with the arrow keys). */
  function flashGuides(box, exclude) {
    drawGuides(box, exclude);
    guideTimer = setTimeout(clearGuides, 900);
  }

  function badge(text, box) {
    const b = editorEl('div', 'cv-badge');
    b.textContent = text;
    b.style.left = `${box.l}px`;
    b.style.top = `${box.t + box.h + 8}px`;
    page().append(b);
  }

  // ---------- Move and resize ----------
  /** Bounding box of several objects. */
  function bbox(list) {
    const gs = list.map(geom);
    const l = Math.min(...gs.map((g) => g.l));
    const t = Math.min(...gs.map((g) => g.t));
    return { l, t, w: Math.max(...gs.map((g) => g.l + g.w)) - l, h: Math.max(...gs.map((g) => g.t + g.h)) - t };
  }

  function startMove(e, el) {
    e.preventDefault();
    const handle = e.target;
    handle.setPointerCapture?.(e.pointerId);
    // Dragging an object that is part of a multiple selection moves the whole group.
    const group = selection.length > 1 && selection.includes(el) && frameMode;
    if (!group) select(el, true);
    const items = group ? [...selection] : [el];
    const starts = items.map(geom);
    const d = doc();
    d.defaultView.focus(); // so arrow keys reach the editor
    const s = scale();
    const start = bbox(items);
    const sx = e.clientX;
    const sy = e.clientY;
    const t = targets(items);
    let moved = false;
    d.body.classList.add('cv-moving');

    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      if (!moved && Math.hypot(dx, dy) < 2) return;
      if (!moved) {
        history.snapshot();
        moved = true;
      }
      let l = start.l + dx;
      let tp = start.t + dy;
      let snapX = null;
      let snapY = null;
      if (snapEnabled() && !ev.altKey) {
        const th = SNAP_PX / s;
        snapX = nearest([{ pos: l, k: 0 }, { pos: l + start.w / 2, k: 0.5 }, { pos: l + start.w, k: 1 }], t.xs, th);
        if (snapX) l += snapX.d;
        snapY = nearest([{ pos: tp }, { pos: tp + start.h / 2 }, { pos: tp + start.h }], t.ys, th);
        const overlapsX = (g) => l < g.l + g.w && l + start.w > g.l;
        const gT = nearest([{ pos: tp }], t.gapTop.filter(overlapsX), th);
        const gB = nearest([{ pos: tp + start.h }], t.gapBottom.filter(overlapsX), th);
        for (const g of [gT, gB]) if (g && (!snapY || Math.abs(g.d) <= Math.abs(snapY.d))) snapY = g;
        if (snapY) tp += snapY.d;
      }
      const dl = Math.round(l) - start.l;
      const dt = Math.round(tp) - start.t;
      items.forEach((o, i) => {
        o.style.left = `${starts[i].l + dl}px`;
        o.style.top = `${starts[i].t + dt}px`;
      });
      const box = { l: Math.round(l), t: Math.round(tp), w: start.w, h: start.h };
      drawGuides(box, items, snapY);
      badge(`x ${box.l} · y ${box.t}`, box);
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      d.body.classList.remove('cv-moving');
      clearGuides();
      if (moved) history.committed();
      // A plain click on a member of the group selects just that object, like Canva.
      setSelection(group && moved ? items : [el]);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  /** Drag on an empty area: draws a selection box and selects the objects it touches. */
  function startMarquee(e, additive) {
    e.preventDefault();
    const d = doc();
    const p = page();
    d.defaultView.focus();
    const handle = e.target;
    handle.setPointerCapture?.(e.pointerId);
    const s = scale();
    const origin = p.getBoundingClientRect();
    const toPage = (ev) => ({ x: (ev.clientX - origin.left) / s, y: (ev.clientY - origin.top) / s });
    const a = toPage(e);
    const before = additive ? [...selection] : [];
    const box = editorEl('div', 'cv-marquee');
    let started = false;
    if (!additive) setSelection([]);

    const onMove = (ev) => {
      const b = toPage(ev);
      if (!started && Math.hypot(b.x - a.x, b.y - a.y) * s < 3) return;
      if (!started) {
        started = true;
        p.append(box);
        d.body.classList.add('cv-moving');
      }
      const r = { l: Math.min(a.x, b.x), t: Math.min(a.y, b.y), r: Math.max(a.x, b.x), b: Math.max(a.y, b.y) };
      Object.assign(box.style, { left: `${r.l}px`, top: `${r.t}px`, width: `${r.r - r.l}px`, height: `${r.b - r.t}px` });
      // Frames are selected when the box touches them; shapes (often big backgrounds) only when fully inside.
      const hit = objects().filter((o) => {
        const g = geom(o);
        return o.classList.contains('shape')
          ? g.l >= r.l && g.t >= r.t && g.l + g.w <= r.r && g.t + g.h <= r.b
          : g.l < r.r && g.l + g.w > r.l && g.t < r.b && g.t + g.h > r.t;
      });
      setSelection([...before, ...hit.filter((o) => !before.includes(o))]);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      box.remove();
      d.body.classList.remove('cv-moving');
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  function startResize(e, el, dir) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.target;
    handle.setPointerCapture?.(e.pointerId);
    const d = doc();
    const s = scale();
    const start = geom(el);
    const sx = e.clientX;
    const sy = e.clientY;
    const t = targets([el]);
    const isShape = el.classList.contains('shape');
    const min = isShape ? 1 : 40;
    history.snapshot();
    d.body.classList.add('cv-moving');

    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      let { l, t: tp, w, h } = start;
      const snap = snapEnabled() && !ev.altKey;
      const th = SNAP_PX / s;
      let snapX = null;
      let snapY = null;
      if (dir.includes('e')) {
        let r = l + w + dx;
        if (snap && (snapX = nearest([{ pos: r }], t.xs, th))) r += snapX.d;
        w = Math.max(min, r - l);
      }
      if (dir.includes('w')) {
        let nl = l + dx;
        if (snap && (snapX = nearest([{ pos: nl }], t.xs, th))) nl += snapX.d;
        nl = Math.min(nl, l + w - min);
        w = l + w - nl;
        l = nl;
      }
      if (dir.includes('s')) {
        let b = tp + h + dy;
        if (snap && (snapY = nearest([{ pos: b }], t.ys, th))) b += snapY.d;
        h = Math.max(min, b - tp);
      }
      if (dir.includes('n')) {
        let nt = tp + dy;
        if (snap && (snapY = nearest([{ pos: nt }], t.ys, th))) nt += snapY.d;
        nt = Math.min(nt, tp + h - min);
        h = tp + h - nt;
        tp = nt;
      }
      el.style.left = `${Math.round(l)}px`;
      el.style.width = `${Math.round(w)}px`;
      if (isShape) {
        el.style.top = `${Math.round(tp)}px`;
        el.style.height = `${Math.round(h)}px`;
      }
      const box = geom(el);
      drawGuides(box, [el], snapY);
      badge(isShape ? `${box.w} × ${box.h}` : `width ${box.w}`, box);
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      d.body.classList.remove('cv-moving');
      clearGuides();
      history.committed();
      select(el, true);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  // ---------- Actions ----------
  function duplicate(el) {
    const items = el ? [el] : selection;
    if (!items.length) return;
    history.snapshot();
    const clones = items.map((o) => {
      const clone = o.cloneNode(true);
      clone.querySelectorAll(`[${attr}]`).forEach((n) => n.remove());
      clone.classList.remove('cv-selected', 'cv-overlap', 'cv-outside');
      clone.style.left = `${o.offsetLeft + GAP}px`;
      clone.style.top = `${o.offsetTop + GAP}px`;
      o.after(clone);
      return clone;
    });
    ensureControls();
    history.committed();
    setSelection(clones);
  }

  function remove(el) {
    const items = el ? [el] : selection;
    if (!items.length) return;
    history.snapshot();
    setSelection(selection.filter((o) => !items.includes(o)));
    items.forEach((o) => o.remove());
    history.committed();
    toast(`${items.length > 1 ? `${items.length} elements` : 'Element'} deleted · ⌘Z to undo`);
  }

  /** Moves every selected object by (dx, dy). */
  function nudge(dx, dy) {
    if (!selection.length) return;
    history.snapshot();
    for (const o of selection) {
      o.style.left = `${o.offsetLeft + dx}px`;
      o.style.top = `${o.offsetTop + dy}px`;
    }
    history.committed();
    flashGuides(bbox(selection), selection);
    onSelect(selected, selection.length);
  }

  /** Changes position/size of the selection (from the inspector). */
  function setGeometry(patch) {
    if (!selected || selection.length > 1) return;
    history.snapshot();
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'height' && !selected.classList.contains('shape')) continue;
      if (Number.isFinite(v)) selected.style[k] = `${Math.round(v)}px`;
    }
    history.committed();
    onSelect(selected, selection.length);
  }

  function setColor(color) {
    const shapes = selection.filter((o) => o.classList.contains('shape'));
    if (!shapes.length) return;
    history.snapshot();
    for (const o of shapes) o.style.background = color;
    history.committed();
  }

  /** One object: aligns it to the page. Several: aligns them to each other (their bounding box). */
  function align(where) {
    if (!selection.length) return;
    const p = page();
    const area = selection.length > 1 ? bbox(selection) : { l: 0, t: 0, w: p.offsetWidth, h: p.offsetHeight };
    history.snapshot();
    for (const o of selection) {
      const g = geom(o);
      const pos = {
        left: { left: area.l },
        hcenter: { left: area.l + (area.w - g.w) / 2 },
        right: { left: area.l + area.w - g.w },
        top: { top: area.t },
        vcenter: { top: area.t + (area.h - g.h) / 2 },
        bottom: { top: area.t + area.h - g.h },
      }[where];
      for (const [k, v] of Object.entries(pos)) o.style[k] = `${Math.round(v)}px`;
    }
    history.committed();
    onSelect(selected, selection.length);
  }

  function arrange(where) {
    if (!selection.length) return;
    const p = page();
    history.snapshot();
    const ordered = objects().filter((o) => selection.includes(o)); // keep their relative order
    if (where === 'back') p.prepend(...ordered);
    else p.append(...ordered);
    history.committed();
  }

  function add(type) {
    const p = page();
    const win = doc().defaultView;
    const s = scale();
    const r = p.getBoundingClientRect();
    const y = Math.max(20, Math.min(p.offsetHeight - 80, Math.round((win.innerHeight / 2 - r.top) / s)));
    history.snapshot();
    let el;
    if (type === 'text') {
      el = doc().createElement('section');
      el.className = 'frame';
      el.innerHTML = '<h2>New section</h2><p>Type here…</p>';
      Object.assign(el.style, { left: '40px', top: `${y}px`, width: '300px' });
      p.append(el);
    } else {
      el = doc().createElement('div');
      el.className = 'shape';
      const line = type === 'line';
      Object.assign(el.style, {
        left: '40px', top: `${y}px`, width: line ? '300px' : '200px', height: line ? '2px' : '120px',
        background: line ? '#555555' : '#efefef',
      });
      // Shapes go behind the text.
      const firstFrame = p.querySelector(':scope > .frame');
      p.insertBefore(el, firstFrame);
    }
    ensureControls();
    history.committed();
    select(el, true);
  }

  /** Pushes down frames that overlap another frame above them. */
  function resolveOverlaps() {
    const list = frames().sort((a, b) => a.offsetTop - b.offsetTop);
    history.snapshot();
    let changed = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      for (let j = 0; j < i; j++) {
        const a = list[j];
        const ga = geom(a);
        const gb = geom(b);
        const overlapX = ga.l < gb.l + gb.w && ga.l + ga.w > gb.l;
        if (overlapX && ga.t <= gb.t && ga.t + ga.h > gb.t) {
          b.style.top = `${ga.t + ga.h + GAP}px`;
          changed++;
        }
      }
    }
    history.committed();
    toast(changed ? `${changed} frame${changed > 1 ? 's' : ''} moved` : 'No overlaps found');
  }

  function checkLayout() {
    const p = page();
    if (!p) return;
    const list = frames().map((el) => ({ el, g: geom(el) }));
    let outside = 0;
    let overlaps = 0;
    for (const { el, g } of list) {
      const out = g.l < -1 || g.t < -1 || g.l + g.w > p.offsetWidth + 1 || g.t + g.h > p.offsetHeight + 1;
      const over = list.some(({ el: o, g: h }) => o !== el &&
        g.l < h.l + h.w - 1 && g.l + g.w > h.l + 1 && g.t < h.t + h.h - 1 && g.t + g.h > h.t + 1);
      el.classList.toggle('cv-outside', out);
      el.classList.toggle('cv-overlap', over && !out);
      if (!el.getAttribute('class')) el.removeAttribute('class');
      outside += out;
      overlaps += over;
    }
    onLayout({ outside, overlaps });
  }

  // ---------- Events ----------
  function onKeyDown(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'a' && (frameMode || !selected) && page()) {
      setSelection(objects());
      return true;
    }
    if (!selected) return false;
    if (e.key === 'Escape') {
      if (frameMode) select(null);
      else select(selected, true);
      return true;
    }
    if (!frameMode) return false;
    if (e.key === 'Enter' && !mod && selection.length === 1 && selected.classList.contains('frame')) {
      editText(selected);
      return true;
    }
    const step = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && !mod) {
      nudge(...moves[e.key]);
      return true;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && !mod) {
      remove();
      return true;
    }
    if (mod && e.key.toLowerCase() === 'd') {
      duplicate();
      return true;
    }
    return false;
  }

  function attach() {
    const d = doc();
    selection = [];
    selected = null;
    frameMode = false;
    pushReady = false;
    ensureControls();
    d.addEventListener('pointerdown', (e) => {
      const target = e.target;
      const h = target.closest?.('.cv-h');
      if (h) return startResize(e, h.parentElement, h.dataset.dir);
      const btn = target.closest?.('.cv-ctl-frame button');
      if (btn) {
        const el = btn.parentElement.parentElement;
        if (btn.dataset.act === 'move') return startMove(e, el);
        e.preventDefault();
        if (btn.dataset.act === 'dup') duplicate(el);
        if (btn.dataset.act === 'del') remove(el);
        return;
      }
      if (target.closest?.('.cv-ctl')) return; // block controls
      if (e.button !== 0) return;
      // ⌥+click: select the shape behind the text (e.g. the side stripe).
      const behind = e.altKey && d.elementsFromPoint(e.clientX, e.clientY).find((n) => n.matches('.page > .shape'));
      const obj = behind || target.closest?.('.page > .shape, .page > .frame');
      if (obj && obj === selected && !frameMode) return; // editing its text: normal text selection
      if (obj && e.shiftKey) {
        e.preventDefault();
        return toggle(obj);
      }
      if (obj) return startMove(e, obj); // click selects, drag moves (the whole group if it's selected)
      if (page()) return startMarquee(e, e.shiftKey); // empty area: selection box
      select(null);
    }, true);
    d.addEventListener('dblclick', (e) => {
      const frame = e.target.closest?.('.page > .frame');
      if (!frame || e.target.closest(`[${attr}]`) || (frame === selected && !frameMode)) return;
      editText(frame, e.clientX, e.clientY);
    });
  }

  return {
    attach, ensureControls, checkLayout, onKeyDown, enablePush,
    select, getSelected: () => selected, getCount: () => selection.length, isFrameMode: () => frameMode,
    setGeometry, setColor, align, arrange, add, duplicate, remove, resolveOverlaps,
  };
}
