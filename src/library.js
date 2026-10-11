// Block library: the items (.item) of a CV — a job, a project, a degree… — can be reordered,
// moved between sections, removed and added back. Removed items are not deleted: they are kept
// in the CV itself, in <template id="cv-library"> (never rendered or printed), so every copy made
// from a CV carries all of its blocks.
//
// Each item gets a stable id (data-item) and the section it was first registered in (data-group),
// used to group the library.

const LIBRARY_ID = 'cv-library';

/**
 * @param {object} o
 * @param {() => Document} o.doc
 * @param {string} o.attr                 attribute marking what the editor injects
 * @param {{snapshot: () => void, committed: () => void}} o.history
 */
export function createLibrary({ doc, attr, history }) {
  const page = () => doc()?.querySelector('.page');

  function template() {
    const d = doc();
    let t = d.getElementById(LIBRARY_ID);
    if (!t) {
      t = d.createElement('template');
      t.id = LIBRARY_ID;
      d.body.append(t);
    }
    return t;
  }

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

  /** Gives every item on the page an id and a group (done once; ids are saved with the CV). */
  function register() {
    const seen = new Set();
    for (const f of sections()) {
      for (const item of f.querySelectorAll(':scope > .item')) {
        if (!item.dataset.item || seen.has(item.dataset.item)) {
          item.dataset.item = `b${Math.random().toString(36).slice(2, 8)}`;
        }
        seen.add(item.dataset.item);
        if (!item.dataset.group) item.dataset.group = sectionTitle(f);
      }
    }
  }

  /** Copy of an item without anything the editor injected. */
  function clean(item) {
    const c = item.cloneNode(true);
    c.querySelectorAll(`[${attr}]`).forEach((n) => n.remove());
    c.classList.remove(...[...c.classList].filter((k) => k.startsWith('cv-')));
    return c;
  }

  /** Where a new item goes in a frame: after its last item (or its title). */
  function insertAtEnd(frame, item) {
    const items = frame.querySelectorAll(':scope > .item');
    const after = items[items.length - 1] ?? frame.querySelector(':scope > h2');
    if (after) after.after(item);
    else frame.prepend(item);
  }

  const change = (fn) => {
    history.snapshot();
    fn();
    history.committed();
  };

  /** Removes an item from the page and keeps it in the library. */
  function remove(item) {
    change(() => {
      template().content.append(clean(item));
      item.remove();
    });
  }

  /** Adds a library item back, at the end of `frame`. */
  function add(id, frame) {
    const stored = template().content.querySelector(`[data-item="${id}"]`);
    if (!stored || !frame) return;
    change(() => {
      const item = doc().importNode(stored, true);
      stored.remove();
      insertAtEnd(frame, item);
    });
  }

  /** Deletes a library item for good. */
  function forget(id) {
    const stored = template().content.querySelector(`[data-item="${id}"]`);
    if (stored) change(() => stored.remove());
  }

  /** Moves an item one place up (-1) or down (+1) within its section. */
  function step(item, dir) {
    const siblings = [...item.parentElement.querySelectorAll(':scope > .item')];
    const other = siblings[siblings.indexOf(item) + dir];
    if (!other) return;
    change(() => (dir < 0 ? other.before(item) : other.after(item)));
  }

  /** Moves an item to the end of another section. */
  function moveTo(item, frame) {
    if (!frame || frame === item.parentElement) return;
    change(() => insertAtEnd(frame, item));
  }

  /** Everything the panel needs: sections with their items, and the library grouped by section. */
  function state() {
    const secs = sections().map((frame) => ({
      frame,
      title: sectionTitle(frame),
      items: [...frame.querySelectorAll(':scope > .item')].map((el) => ({ el, id: el.dataset.item, label: label(el) })),
    }));
    const groups = new Map();
    // (`:scope >` doesn't work on a template's fragment, so walk its children)
    for (const el of [...template().content.children].filter((c) => c.matches('.item'))) {
      const g = el.dataset.group || 'Other';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push({ id: el.dataset.item, label: label(el), group: g });
    }
    return { sections: secs, library: [...groups].map(([group, items]) => ({ group, items })) };
  }

  /** Scrolls an item into view and flashes it. */
  function reveal(item) {
    item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    item.classList.add('cv-flash');
    setTimeout(() => {
      item.classList.remove('cv-flash');
      if (!item.getAttribute('class')) item.removeAttribute('class');
    }, 1200);
  }

  return { register, state, remove, add, forget, step, moveTo, reveal, sectionTitle };
}

