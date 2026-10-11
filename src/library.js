// Blocks: the items (.item) of a CV — a job, a project, a degree… — can be reordered, moved
// between sections and switched off. A switched-off item keeps its exact place in the CV but
// carries the `hidden` attribute, so it isn't shown or printed; switching it on brings it back
// where it was. Each item gets a stable id (data-item), saved with the CV.

/**
 * @param {object} o
 * @param {() => Document} o.doc
 * @param {{snapshot: () => void, committed: () => void}} o.history
 */
export function createLibrary({ doc, history }) {
  const page = () => doc()?.querySelector('.page');

  /** Section title of a frame: its h2 without the right-hand detail (h2 .meta). */
  function sectionTitle(frame) {
    const h2 = frame?.querySelector(':scope > h2');
    if (!h2) return '';
    const c = h2.cloneNode(true);
    c.querySelectorAll('.meta').forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }

  /** Frames with a section title, in reading order (column by column, top to bottom). */
  function sections() {
    return [...(page()?.querySelectorAll(':scope > .frame') ?? [])]
      .filter((f) => sectionTitle(f))
      .sort((a, b) => (Math.abs(a.offsetLeft - b.offsetLeft) > 40 ? a.offsetLeft - b.offsetLeft : a.offsetTop - b.offsetTop));
  }

  /** A short, human name for an item. */
  function label(item) {
    // The most specific title first: job title, project/degree title, then any text.
    const head = ['.job-head strong', 'h3', '.job-head', 'p', 'li'].map((sel) => item.querySelector(sel)).find(Boolean);
    const text = (head ?? item).textContent.replace(/\s+/g, ' ').trim();
    return text.length > 48 ? `${text.slice(0, 46)}…` : text || 'Untitled block';
  }

  const itemsOf = (frame) => [...frame.querySelectorAll(':scope > .item')];

  function insertAtEnd(frame, item) {
    const items = itemsOf(frame);
    const after = items[items.length - 1] ?? frame.querySelector(':scope > h2');
    if (after) after.after(item);
    else frame.prepend(item);
  }

  /** Gives every item an id (once; ids are saved with the CV). */
  function register() {
    const d = doc();
    // Blocks removed with an earlier version of the editor were kept in <template id="cv-library">:
    // put them back in their section, switched off.
    const legacy = d?.getElementById('cv-library');
    if (legacy) {
      for (const item of [...legacy.content.children].filter((c) => c.matches('.item'))) {
        const home = sections().find((f) => sectionTitle(f) === item.dataset.group) ?? sections()[0];
        const node = d.importNode(item, true);
        node.hidden = true;
        if (home) insertAtEnd(home, node);
      }
      legacy.remove();
    }
    const seen = new Set();
    for (const f of sections()) {
      for (const item of itemsOf(f)) {
        if (!item.dataset.item || seen.has(item.dataset.item)) {
          item.dataset.item = `b${Math.random().toString(36).slice(2, 8)}`;
        }
        seen.add(item.dataset.item);
      }
    }
  }

  const change = (fn) => {
    history.snapshot();
    fn();
    history.committed();
  };

  /** Shows or hides an item, in place. */
  function setVisible(item, visible) {
    if (item.hidden === !visible) return;
    change(() => {
      item.hidden = !visible;
    });
  }

  /** Moves an item one place up (-1) or down (+1) within its section. */
  function step(item, dir) {
    const siblings = itemsOf(item.parentElement);
    const other = siblings[siblings.indexOf(item) + dir];
    if (!other) return;
    change(() => (dir < 0 ? other.before(item) : other.after(item)));
  }

  /** Puts an item in `frame`, before `before` (another item of that frame) or at the end. */
  function place(item, frame, before = null) {
    if (!frame || before === item) return;
    const siblings = itemsOf(frame);
    if (before ? siblings[siblings.indexOf(before) - 1] === item : siblings.at(-1) === item) return; // already there
    change(() => (before ? before.before(item) : insertAtEnd(frame, item)));
  }

  /** Moves an item to the end of another section. */
  function moveTo(item, frame) {
    if (!frame || frame === item.parentElement) return;
    change(() => insertAtEnd(frame, item));
  }

  /** Deletes an item for good. */
  function forget(item) {
    change(() => item.remove());
  }

  /** Sections with their items (shown and hidden), for the Blocks panel. */
  function state() {
    return sections().map((frame) => ({
      frame,
      title: sectionTitle(frame),
      items: itemsOf(frame).map((el) => ({ el, label: label(el), visible: !el.hidden })),
    }));
  }

  /** Scrolls an item into view and flashes it. */
  function reveal(item) {
    if (item.hidden) return;
    item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    item.classList.add('cv-flash');
    setTimeout(() => {
      item.classList.remove('cv-flash');
      if (!item.getAttribute('class')) item.removeAttribute('class');
    }, 1200);
  }

  return { register, state, setVisible, step, place, moveTo, forget, reveal };
}
