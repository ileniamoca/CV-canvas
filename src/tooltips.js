// Quick tooltips for anything with a `title`. The browser's own tooltip waits about a second and
// can't be sped up, so while the mouse is over an element its title is lifted off (no native
// tooltip) and shown in our own bubble after a short delay; it's put back when the mouse leaves.

const DELAY = 250; // ms before the first tooltip
const WARM = 600; // ms after hiding one during which the next one shows instantly

let tip = null;
let timer = null;
let current = null; // { el, text }
let lastHidden = 0;

function bubble() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
  }
  return tip;
}

function place(rect) {
  const t = bubble();
  const gap = 8;
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  let top = rect.bottom + gap;
  if (top + h > window.innerHeight - 4) top = rect.top - h - gap; // no room below: show above
  const left = Math.min(Math.max(4, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 4);
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}

function show(rect, text) {
  const t = bubble();
  t.textContent = text;
  t.classList.add('show');
  place(rect);
}

/** Hides the bubble (the element keeps its title lifted while the mouse is still over it). */
function hide() {
  clearTimeout(timer);
  if (tip?.classList.contains('show')) {
    tip.classList.remove('show');
    lastHidden = Date.now();
  }
}

/** The mouse left the element: hide and give the element its title back. */
function release() {
  hide();
  if (current?.el.isConnected && !current.el.hasAttribute('title')) current.el.setAttribute('title', current.text);
  current = null;
}

/**
 * Enables quick tooltips in a document. For an iframe's document, pass `frameRect` (the iframe's
 * position) so the bubble, which lives in the main document, lines up with the element, and
 * `only` (a selector) to limit tooltips to some elements, e.g. the editor's own controls.
 */
export function initTooltips(doc, { frameRect = null, only = null } = {}) {
  doc.addEventListener('mouseover', (e) => {
    if (current?.el.contains(e.target)) return;
    const el = e.target.closest?.('[title]');
    if (!el || (only && !el.matches(only))) return;
    release();
    const text = el.getAttribute('title');
    if (!text) return;
    el.removeAttribute('title');
    current = { el, text };
    const rectOf = () => {
      const r = el.getBoundingClientRect();
      if (!frameRect) return r;
      const f = frameRect();
      return { left: r.left + f.left, top: r.top + f.top, bottom: r.bottom + f.top, width: r.width };
    };
    const warm = Date.now() - lastHidden < WARM;
    timer = setTimeout(() => current?.el === el && show(rectOf(), text), warm ? 0 : DELAY);
  });
  doc.addEventListener('mouseout', (e) => {
    if (current && !current.el.contains(e.relatedTarget)) release();
  });
  for (const type of ['mousedown', 'keydown', 'wheel']) doc.addEventListener(type, hide, true);
  doc.defaultView.addEventListener('blur', hide); // e.g. a toolbar click focuses the CV frame
}
