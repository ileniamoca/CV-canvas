// The board: every template and page side by side on one big pasteboard (like InDesign or Figma).
// Pan with the trackpad (two fingers), pinch to zoom. One sheet is active: it is the document being
// edited (main.js attaches the editor to its iframe); the others are live previews that become
// active when clicked, or when scrolling stops with them in the middle of the view. Clicking a page in
// the sidebar glides the view to it.

const PAGE_W = 794; // A4 at 96 dpi
const PAGE_H = 1123;

/** CSS that turns a CV document into a bare sheet: just the page, no desk around it. */
export function sheetCss(zoom) {
  return `
    html { zoom: ${zoom}; }
    @media screen {
      html, body { margin: 0 !important; background: transparent !important; overflow: hidden !important; }
      .page { margin: 0 !important; box-shadow: none !important; }
    }
    @media print { html { zoom: 1 !important; } }`;
}

const keyOf = (kind, name) => `${kind}/${name}`;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * @param {object} o
 * @param {HTMLElement} o.board                     the scrolling pasteboard
 * @param {HTMLElement} o.strip                     row that holds the sheets
 * @param {() => number} o.zoom
 * @param {(kind: string) => string} o.kindLabel
 * @param {(kind: string, name: string) => Promise<string>} o.load   fetches a document's HTML
 * @param {(kind: string, name: string) => void} o.onActivate        a preview was clicked
 * @param {(deltaY: number, e: WheelEvent) => void} o.onPinch        trackpad pinch (ctrl + wheel)
 * @param {(kind: string, name: string) => void} [o.onCenter]       scrolling stopped with this sheet centered
 */
export function createBoard({ board, strip, zoom, kindLabel, load, onActivate, onPinch, onCenter = () => {} }) {
  const sheets = new Map(); // key → { el, iframe, kind, name, mtime }
  let active = null;
  let anim = null;

  function sheetEl(kind, name) {
    const el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML = `
      <div class="sheet-label"><span class="kind"></span><span class="name"></span></div>
      <div class="sheet-frame"><iframe tabindex="-1" aria-label="CV page"></iframe><div class="sheet-cover" title="Click to edit"></div></div>`;
    el.querySelector('.kind').textContent = kindLabel(kind);
    el.querySelector('.name').textContent = name.replace(/\.html$/i, '');
    el.dataset.name = name;
    const activate = () => onActivate(kind, el.dataset.name); // read at click time: the sheet may be renamed
    el.querySelector('.sheet-cover').addEventListener('click', activate);
    el.querySelector('.sheet-label').addEventListener('click', activate);
    return el;
  }

  /** Pinch-to-zoom inside an iframe document reaches the board too. */
  function forwardPinch(d) {
    d.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onPinch(e.deltaY, e);
    }, { passive: false });
  }

  /** Loads a sheet as a read-only preview. */
  async function preview(key) {
    const s = sheets.get(key);
    if (!s || key === active) return;
    let html;
    try {
      html = await load(s.kind, s.name);
    } catch {
      return; // e.g. deleted or renamed meanwhile; the next sync takes care of it
    }
    if (key === active || sheets.get(key) !== s) return;
    s.iframe.onload = () => {
      const d = s.iframe.contentDocument;
      const style = d.createElement('style');
      style.dataset.cvPreview = '';
      style.textContent = sheetCss(zoom());
      d.head.append(style);
      forwardPinch(d);
    };
    s.iframe.srcdoc = html;
  }

  /** Makes the board match the list of documents (in order); reloads previews that changed. */
  function sync(docs) {
    const keys = docs.map((d) => keyOf(d.kind, d.name));
    for (const [key, s] of sheets) {
      if (!keys.includes(key)) {
        s.el.remove();
        sheets.delete(key);
      }
    }
    for (const d of docs) {
      const key = keyOf(d.kind, d.name);
      let s = sheets.get(key);
      if (!s) {
        const el = sheetEl(d.kind, d.name);
        s = { el, iframe: el.querySelector('iframe'), kind: d.kind, name: d.name, mtime: null };
        sheets.set(key, s);
      }
      strip.append(s.el); // keeps the order of `docs`
      if (s.mtime !== d.mtime) {
        s.mtime = d.mtime;
        if (key !== active) preview(key);
      }
    }
    resize();
  }

  function resize() {
    const z = zoom();
    for (const [key, s] of sheets) {
      const f = s.el.querySelector('.sheet-frame');
      f.style.width = `${Math.round(PAGE_W * z)}px`;
      f.style.height = `${Math.round(PAGE_H * z)}px`;
      if (key !== active) {
        const style = s.iframe.contentDocument?.querySelector('style[data-cv-preview]');
        if (style) style.textContent = sheetCss(z);
      }
    }
  }

  /** Marks a sheet as the one being edited and returns its iframe (null if it isn't on the board). */
  function setActive(kind, name) {
    const key = kind ? keyOf(kind, name) : null;
    const prev = active;
    active = key;
    for (const [k, s] of sheets) s.el.classList.toggle('active', k === key);
    if (prev && prev !== key) preview(prev); // the sheet we left becomes a clean preview again
    return sheets.get(key)?.iframe ?? null;
  }

  /** Where the view should be to show a sheet: centered horizontally, near the top. */
  function targetOf(key) {
    const s = sheets.get(key);
    if (!s) return null;
    const f = s.el;
    return {
      left: Math.max(0, f.offsetLeft + f.offsetWidth / 2 - board.clientWidth / 2),
      top: Math.max(0, f.offsetTop - 24),
    };
  }

  /** Glides the view to a sheet (eased), or jumps there with `instant`. */
  function glideTo(kind, name, { instant = false } = {}) {
    const to = targetOf(keyOf(kind, name));
    if (!to) return;
    cancelAnimationFrame(anim);
    const from = { left: board.scrollLeft, top: board.scrollTop };
    const dist = Math.hypot(to.left - from.left, to.top - from.top);
    if (instant || dist < 2) {
      board.scrollTo(to.left, to.top);
      return;
    }
    const duration = Math.min(900, Math.max(350, dist * 0.5));
    const t0 = performance.now();
    gliding = true;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const k = easeInOut(t);
      board.scrollTo(from.left + (to.left - from.left) * k, from.top + (to.top - from.top) * k);
      if (t < 1) anim = requestAnimationFrame(step);
      else gliding = false;
    };
    anim = requestAnimationFrame(step);
  }

  /** The sheet whose center is closest to the center of the view. */
  function centered() {
    const view = board.getBoundingClientRect();
    const cx = view.left + view.width / 2;
    let best = null;
    for (const s of sheets.values()) {
      const r = s.el.querySelector('.sheet-frame').getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - cx);
      if (r.right > view.left && r.left < view.right && (!best || d < best.d)) best = { d, s };
    }
    return best?.s ?? null;
  }

  // When scrolling stops (and it isn't a glide on its way to a sheet), the centered sheet takes over.
  let gliding = false;
  let settle;
  board.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      if (gliding) return;
      const s = centered();
      if (s) onCenter(s.kind, s.name);
    }, 250);
  });

  // The user scrolling or pinching takes over from an ongoing glide.
  board.addEventListener('wheel', (e) => {
    cancelAnimationFrame(anim);
    gliding = false;
    if (!e.ctrlKey) return;
    e.preventDefault();
    onPinch(e.deltaY, e);
  }, { passive: false });

  /** A document was renamed: the sheet keeps its iframe (and the editing in progress, if active). */
  function rename(kind, oldName, newName) {
    const oldKey = keyOf(kind, oldName);
    const s = sheets.get(oldKey);
    if (!s) return;
    const newKey = keyOf(kind, newName);
    sheets.delete(oldKey);
    sheets.set(newKey, s);
    s.name = newName;
    s.el.dataset.name = newName;
    s.el.querySelector('.name').textContent = newName.replace(/\.html$/i, '');
    if (active === oldKey) active = newKey;
  }

  return { sync, setActive, glideTo, resize, forwardPinch, rename, has: (kind, name) => sheets.has(keyOf(kind, name)) };
}
