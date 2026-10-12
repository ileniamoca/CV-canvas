import { createBlocks, BLOCKS_CSS } from './blocks.js';
import { createCanvas, CANVAS_CSS } from './canvas.js';
import { createLibrary } from './library.js';
import { createBoard, sheetCss } from './board.js';
import {
  TEXT_STYLES, FONTS, fontByStack, styleSheetEl, readStyles, writeStyles, detectStyle, applyStyle,
} from './styles.js';
import {
  REGIONS, SIDES, MARGINS_CSS, regionRects, readMargins, initMargins, setMargin, drawMarginGuides,
} from './margins.js';
import { THEMES, applyTheme, STYLES, applyStyle as applyUiStyle } from './themes.js';
import { initTooltips } from './tooltips.js';
import TEMPLATE from '../templates/blank.html?raw';

const $ = (sel) => document.querySelector(sel);
let iframe = null; // the active sheet's iframe (the document being edited), see board.js
const EDITOR_ATTR = 'data-cv-editor'; // marks what the editor injects; never saved

const state = {
  current: null, // { kind, name }
  savedHtml: '',
  dirty: false,
  zoom: 1,
  chrome: false,
  docs: { templates: [], pages: [] }, // last list received (for the "new page/template" dialog)
  ownWrites: new Map(), // "kind/name" → timestamp of our last save
  confirmedTemplates: new Set(), // templates she already agreed to overwrite this session
  mode: 'pages', // 'pages': the board shows every page · 'template': only the template being edited
  editing: null, // name of the template being edited (template mode)
  returnTo: null, // page to go back to when leaving template mode
  viewing: null, // { kind, name } of the one document shown in the middle (a page, or the template being edited)
};

// ---------- API ----------
async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
  return body;
}
const docUrl = (kind, name) => `/api/docs/${kind}/${encodeURIComponent(name)}`;
const stem = (name) => name.replace(/\.(html|pdf)$/i, '');

const board = createBoard({
  board: $('#board'),
  strip: $('#boardStrip'),
  zoom: () => state.zoom,
  kindLabel: (kind) => (kind === 'templates' ? 'Template' : 'Page'),
  load: (kind, name) => api(docUrl(kind, name)),
  onActivate: (kind, name) => openDoc(kind, name),
  onPinch: (deltaY) => setZoom(state.zoom * Math.exp(-deltaY * 0.01)),
  onCenter: (kind, name) => openDoc(kind, name, { glide: false, auto: true }),
});

// ---------- Sidebar list ----------
async function refreshList() {
  const data = await api('/api/docs');
  state.chrome = data.chrome;
  state.docs = data;
  $('#empty').textContent = !data.templates.length
    ? 'No CVs yet. Click “+” next to Templates to create your first template.'
    : !data.pages.length
      ? 'No pages yet. Click “New from job ad” to make a CV for a job.'
      : 'Pick a page on the left to open it.';
  // Templates and pages keep their place on the board and in the list: oldest first, new ones at the end.
  for (const kind of ['templates', 'pages']) data[kind].sort((a, b) => a.created - b.created || a.name.localeCompare(b.name));
  // One document at a time in the middle: the page picked in the sidebar (or the template being edited).
  const v = state.viewing;
  const sheets = v ? (data[v.kind] ?? []).filter((f) => f.name === v.name)
    .map((f) => ({ kind: v.kind, name: f.name, mtime: f.mtime, template: f.template })) : [];
  $('#empty').hidden = sheets.length > 0;
  $('#board').hidden = !sheets.length;
  board.sync(sheets);
  // Don't rebuild the list under a name being edited (it's rebuilt when the rename ends).
  if (document.querySelector('.sidebar input.rename')) return;
  for (const kind of ['templates', 'pages']) { // exported PDFs aren't listed: they're in documents/pdf
    const ul = $(`#list-${kind}`);
    ul.replaceChildren();
    if (!data[kind].length) {
      ul.append(Object.assign(document.createElement('li'), { className: 'none', textContent: 'Empty' }));
      continue;
    }
    for (const f of data[kind]) ul.append(renderItem(kind, f));
  }
}

function renderItem(kind, f) {
  const li = document.createElement('li');
  li.title = f.name;
  if (state.current?.kind === kind && state.current?.name === f.name) li.classList.add('current');
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = stem(f.name);
  const date = document.createElement('span');
  date.className = 'date';
  date.textContent = new Date(f.mtime).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  label.append(date);
  if (kind === 'pages' && (f.template || f.job)) {
    const tpl = document.createElement('span');
    tpl.className = 'tpl';
    tpl.textContent = [f.template && `Template: ${f.template}`, f.job && 'job ad ✓'].filter(Boolean).join(' · ');
    label.append(tpl);
  }
  li.append(label);

  if (kind === 'pdf') {
    li.addEventListener('click', () => window.open(`/files/pdf/${encodeURIComponent(f.name)}`, '_blank'));
  } else {
    // A second click renames. (The first one may re-render the list, so a native dblclick wouldn't fire:
    // the click count still reaches the new element.)
    li.addEventListener('click', (e) => (e.detail >= 2 ? startRename(li, kind, f) : openDoc(kind, f.name)));
  }
  const more = document.createElement('button');
  more.className = 'mini more';
  more.textContent = '⋯';
  more.title = { templates: 'Edit, rename, duplicate or export', pages: 'Rename, duplicate, export or delete', pdf: 'Rename or delete' }[kind];
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    openItemMenu(more, [
      ...(kind === 'templates' ? [['Edit template', () => openDoc(kind, f.name)]] : []),
      ...(f.job ? [['View job ad', () => viewJob(f.job)]] : []),
      ['Rename', () => startRename(li, kind, f)],
      ...(kind !== 'pdf' ? [['Duplicate', () => duplicateDoc(kind, f.name)], ['Export PDF', () => exportPdf(kind, f.name)]] : []),
      ...(kind !== 'templates' ? [['Delete', () => deleteDoc(kind, f.name), 'danger']] : []),
    ]);
  });
  li.append(more);
  return li;
}

// ---------- Sidebar: rename, duplicate, delete ----------
function closeItemMenu() {
  document.querySelector('.item-menu')?.remove();
}

/** A small menu under `anchor`: [label, action, className?][] */
function openItemMenu(anchor, entries) {
  closeItemMenu();
  const menu = document.createElement('div');
  menu.className = 'item-menu';
  for (const [label, action, cls] of entries) {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      closeItemMenu();
      action();
    });
    menu.append(b);
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)}px`;
  menu.style.top = `${r.bottom + 4}px`;
  setTimeout(() => document.addEventListener('pointerdown', (e) => {
    if (!menu.contains(e.target)) closeItemMenu();
  }, { once: true }));
}

/** Turns a sidebar entry's name into a text field: Enter (or clicking away) renames, Esc cancels. */
function startRename(li, kind, f) {
  const label = li.querySelector('.label');
  if (!label) return;
  const input = document.createElement('input');
  input.className = 'rename';
  input.value = stem(f.name);
  label.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    const value = input.value;
    input.replaceWith(label); // the list can be rebuilt again
    if (ok) renameDoc(kind, f.name, value);
    else refreshList();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
}

async function renameDoc(kind, name, newName) {
  newName = newName.trim();
  if (!newName || newName === stem(name)) return refreshList();
  try {
    markOwnWrite(kind, name);
    const res = await api(docUrl(kind, name), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    markOwnWrite(kind, res.name);
    board.rename(kind, name, res.name);
    if (state.current?.kind === kind && state.current?.name === name) {
      state.current = { kind, name: res.name };
      try { localStorage.setItem('cv-editor:last', JSON.stringify(state.current)); } catch {}
      updateChrome();
    }
    toast(`Renamed to “${stem(res.name)}”`);
  } catch (err) {
    toast(err.message, true);
  }
  refreshList();
}

async function duplicateDoc(kind, name) {
  try {
    const html = await api(docUrl(kind, name));
    const res = await api(`/api/docs/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${stem(name)} copy`, html }),
    });
    await refreshList();
    toast(`Duplicated as “${stem(res.name)}”`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function deleteDoc(kind, name) {
  if (!confirm(`Delete "${stem(name)}"? This cannot be undone.`)) return;
  try {
    await api(docUrl(kind, name), { method: 'DELETE' });
    if (state.current?.kind === kind && state.current?.name === name) closeDoc();
    refreshList();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- Document ----------
function doc() {
  return iframe?.contentDocument ?? null;
}

function afterChange() {
  blocks.ensureControls();
  canvas.ensureControls();
  canvas.checkLayout();
  library.register();
  renderLibrary();
  drawMargins();
  setDirty(serialize() !== state.savedHtml);
  updateWordCount();
  updateMarginInputs();
}

const blocks = createBlocks({
  doc,
  attr: EDITOR_ATTR,
  getState: () => {
    const d = doc();
    return {
      body: d.body.innerHTML,
      styles: styleSheetEl(d)?.textContent,
      fonts: d.getElementById('cv-fonts')?.getAttribute('href'),
    };
  },
  setState: (st) => {
    const d = doc();
    canvas.select(null);
    d.body.innerHTML = st.body;
    d.querySelectorAll('.page > .frame[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    const css = styleSheetEl(d);
    if (css && st.styles != null) css.textContent = st.styles;
    if (st.fonts) d.getElementById('cv-fonts')?.setAttribute('href', st.fonts);
    renderStyles();
  },
  onChange: afterChange,
  toast: (msg) => toast(msg),
  removeItem: (el) => library.setVisible(el, false),
});

const library = createLibrary({ doc, history: blocks });

const canvas = createCanvas({
  doc,
  attr: EDITOR_ATTR,
  history: blocks,
  snapEnabled: () => $('#snapToggle').checked,
  pushEnabled: () => $('#pushToggle').checked,
  onLayout: (r) => updateLayoutStatus(r),
  onSelect: (objects) => updateShapePanel(objects),
  items: {
    drag: (e, el) => blocks.drag(e, el),
    remove: (el) => blocks.remove(el), // hides it (see removeItem above)
    duplicate: (el) => blocks.duplicate(el),
    step: (el, dir) => library.step(el, dir),
  },
  toast: (msg) => toast(msg),
});

function serialize() {
  const clone = doc().documentElement.cloneNode(true);
  clone.querySelectorAll(`[${EDITOR_ATTR}]`).forEach((n) => n.remove());
  clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
  clone.querySelectorAll('[class*="cv-"]').forEach((n) => {
    [...n.classList].forEach((c) => c.startsWith('cv-') && n.classList.remove(c));
  });
  clone.querySelectorAll('[class=""]').forEach((n) => n.removeAttribute('class'));
  return '<!DOCTYPE html>\n' + clone.outerHTML + '\n';
}

/**
 * Makes a document the active sheet (the one being edited) and glides the board to it.
 * Leaving a sheet with unsaved changes saves them first. `force` reloads the active one from disk;
 * `auto` means it was triggered by scrolling (no dialogs: a template with unsaved changes stays active).
 */
let switching = false;
async function openDoc(kind, name, { force = false, glide = true, auto = false } = {}) {
  if (kind === 'templates') return editTemplate(name, { force });
  if (state.mode === 'template') {
    if (auto) return;
    return leaveTemplate({ next: { kind, name } });
  }
  const same = state.current?.kind === kind && state.current?.name === name;
  if (same && !force) return glide ? board.glideTo(kind, name) : undefined;
  if (auto && switching) return;
  if (auto && state.dirty && state.current?.kind === 'templates' && !state.confirmedTemplates.has(state.current.name)) {
    toast('The template has unsaved changes: save it (⌘S) before moving to another page.');
    return;
  }
  switching = true;
  try {
    if (!same && state.dirty && !(await save())) return;
    await activate(kind, name, glide);
  } finally {
    switching = false;
  }
}

async function activate(kind, name) {
  try {
    const html = await api(docUrl(kind, name));
    // Swap the document shown in the middle (marked active first, so it isn't loaded as a preview).
    state.viewing = { kind, name };
    board.setActive(kind, name);
    await refreshList();
    state.current = { kind, name };
    try { localStorage.setItem('cv-editor:last', JSON.stringify(state.current)); } catch {}
    iframe = board.setActive(kind, name);
    await loadIntoIframe(html);
    state.savedHtml = serialize();
    setDirty(false);
    $('#banner').hidden = true;
    updateChrome();
    board.glideTo(kind, name, { instant: true }); // centered
    refreshList(); // highlight it in the sidebar
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- Template mode ----------
/** Opens a template on its own (no pages around it) until it's saved or discarded. */
async function editTemplate(name, { force = false } = {}) {
  if (state.mode === 'template' && state.editing === name && !force) return;
  if (state.mode === 'template' && state.editing !== name && !(await leaveTemplate({ reopen: false }))) return;
  if (state.mode === 'pages' && state.dirty && !(await save())) return; // the page we leave keeps its changes
  if (state.mode === 'pages' && state.current?.kind === 'pages') state.returnTo = state.current;
  state.mode = 'template';
  state.editing = name;
  state.confirmedTemplates.add(name); // edited on purpose: no "you're changing the template" warning
  document.body.classList.add('template-mode');
  $('#templateBar').hidden = false;
  $('#templateBarName').textContent = stem(name);
  await activate('templates', name);
}

/**
 * Back to all the pages. Unsaved template changes are saved or discarded (`saveFirst`; asked if
 * undefined). Then opens `next`, or the page she was on before. Returns false if cancelled.
 */
async function leaveTemplate({ saveFirst, next, reopen = true } = {}) {
  if (state.mode !== 'template') return true;
  if (state.dirty) {
    if (saveFirst === undefined) saveFirst = confirm('Save your changes to the template?\n\nOK: save · Cancel: discard them');
    if (saveFirst && !(await save())) return false;
  }
  state.mode = 'pages';
  state.editing = null;
  document.body.classList.remove('template-mode');
  $('#templateBar').hidden = true;
  state.current = null;
  state.viewing = null;
  state.dirty = false;
  iframe = null;
  board.setActive(null);
  await refreshList();
  if (!reopen) return true;
  const pages = state.docs.pages ?? [];
  const target = next ?? (pages.some((f) => f.name === state.returnTo?.name) ? state.returnTo : null)
    ?? (pages[0] && { kind: 'pages', name: pages[0].name });
  if (target) await activate(target.kind, target.name, true);
  else updateChrome();
  return true;
}

$('#btnTemplateSave').addEventListener('click', () => leaveTemplate({ saveFirst: true }));
$('#btnTemplateDiscard').addEventListener('click', () => {
  if (state.dirty && !confirm('Discard your changes to the template?')) return;
  leaveTemplate({ saveFirst: false });
});

// ---------- Pages from job ads ----------
/** Paste a job ad → saved in ../jobs → a page "Company – Role" from a template, linked to the ad. */
async function newFromJob() {
  const templates = state.docs.templates ?? [];
  if (!templates.length) return toast('Create a template first (the “+” next to Templates).');
  const dlg = $('#jobDialog');
  $('#jobTemplate').innerHTML = templates.map((f) => `<option value="${escapeHtml(f.name)}">${escapeHtml(stem(f.name))}</option>`).join('');
  for (const id of ['#jobCompany', '#jobRole', '#jobUrl', '#jobText']) $(id).value = '';
  dlg.returnValue = '';
  dlg.showModal();
  $('#jobCompany').focus();
  const ok = await new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true }));
  if (!ok) return;
  const company = $('#jobCompany').value.trim();
  const role = $('#jobRole').value.trim();
  const template = $('#jobTemplate').value;
  const name = `${company} – ${role}`;
  try {
    const job = await api('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, role, url: $('#jobUrl').value, text: $('#jobText').value, page: `${name}.html` }),
    });
    let html = withTemplate(await api(docUrl('templates', template)), template);
    html = html.replace(/<meta name="cv-template"[^>]*>/, (m) => `${m}\n<meta name="cv-job" content="${escapeHtml(job.file)}">`);
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(name)}</title>`);
    const res = await api('/api/docs/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, html }),
    });
    markOwnWrite('pages', res.name);
    await openDoc('pages', res.name, { force: true });
    toast(`Page “${stem(res.name)}” created. Now ask Claude Code: “tailor the page ${stem(res.name)}”.`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function viewJob(file) {
  try {
    const md = await api(`/api/jobs/${encodeURIComponent(file)}`);
    $('#jobViewTitle').textContent = md.match(/^# (.+)$/m)?.[1] ?? 'Job ad';
    $('#jobViewText').textContent = md.replace(/^# .+\n+/, '');
    $('#jobView').showModal();
  } catch (err) {
    toast(err.message, true);
  }
}

/** Records in a page which template it was made from. */
function withTemplate(html, templateName) {
  const meta = `<meta name="cv-template" content="${escapeHtml(stem(templateName))}">`;
  return /<meta name="cv-template"[^>]*>/.test(html)
    ? html.replace(/<meta name="cv-template"[^>]*>/, meta)
    : html.replace(/<head>/i, `<head>\n${meta}`);
}
const withoutTemplate = (html) => html.replace(/\s*<meta name="cv-template"[^>]*>/, '');

function closeDoc() {
  state.current = null;
  state.viewing = null;
  state.dirty = false;
  iframe = null;
  board.setActive(null);
  updateChrome();
  refreshList();
}

function loadIntoIframe(html) {
  return new Promise((resolve) => {
    iframe.onload = () => {
      setupEditing();
      resolve();
    };
    iframe.srcdoc = html;
  });
}

function setupEditing() {
  const d = doc();
  const style = d.createElement('style');
  style.setAttribute(EDITOR_ATTR, '');
  d.head.append(style);
  applyZoom();
  // Free-form CVs: only the frame being edited becomes contentEditable (see canvas.js).
  // Older flow CVs without frames: the whole body is editable.
  if (!d.querySelector('.page > .frame')) d.body.contentEditable = 'true';
  try { d.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
  blocks.attach();
  canvas.attach();
  const frameEl = iframe;
  initTooltips(d, { frameRect: () => frameEl.getBoundingClientRect(), only: `[${EDITOR_ATTR}] *, [${EDITOR_ATTR}]` });
  board.forwardPinch(d);
  initMargins(d.querySelector('.page')); // before the saved state is taken, so the doc doesn't look edited
  library.register(); // block ids, saved with the CV
  renderLibrary();
  d.body.classList.toggle('cv-hide-margins', !$('#marginsToggle').checked);
  drawMargins();
  renderMargins();
  renderStyles();
  // Recompute pages/warnings when the height changes (text, moved blocks, loaded fonts…).
  new d.defaultView.ResizeObserver(() => updatePages()).observe(d.querySelector('.page') ?? d.body);
  d.fonts?.ready.then(() => {
    canvas.enablePush();
    canvas.checkLayout();
  });

  let t;
  d.addEventListener('input', (e) => {
    if (e.isTrusted) blocks.textEdited();
    clearTimeout(t);
    t = setTimeout(() => {
      blocks.ensureControls();
      canvas.ensureControls();
      setDirty(serialize() !== state.savedHtml);
    }, 150);
    updateWordCount();
  });
  d.addEventListener('keydown', handleShortcuts);
  d.addEventListener('selectionchange', () => {
    updateToolbarState();
    markActiveStyle();
  });
  // Triple click: like Word, select only the paragraph (the browser extends into the next
  // block and typing over it merges both, breaking the layout).
  d.addEventListener('click', (e) => {
    if (e.detail !== 3) return;
    const block = e.target.closest?.('p, li, h1, h2, h3, h4, h5, h6, td, th, div, span.meta');
    if (!block) return;
    const range = d.createRange();
    range.selectNodeContents(block);
    const sel = d.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  // In edit mode links don't navigate; ⌘+click opens them.
  d.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a && (e.metaKey || e.ctrlKey)) window.open(a.href, '_blank');
  });
  updateWordCount();
}

function applyZoom() {
  const style = doc()?.querySelector(`style[${EDITOR_ATTR}]`);
  if (style) {
    style.textContent = BLOCKS_CSS + CANVAS_CSS + MARGINS_CSS + sheetCss(state.zoom) + `
      .item.cv-flash { outline: 2px solid ${accent()} !important; outline-offset: 3px; }
      a { cursor: text; }
      .page { position: relative; }
      .cv-pagebreak {
        position: absolute; left: -12px; right: -12px; height: 0; z-index: 6; pointer-events: none;
        border-top: 2px dashed #d93025;
      }
      .cv-pagebreak::after {
        content: attr(data-label); position: absolute; right: 12px; top: 2px;
        font: 600 10px/1.6 -apple-system, sans-serif; color: #fff; background: #d93025;
        padding: 0 6px; border-radius: 0 0 4px 4px;
      }
      @media print { .cv-pagebreak { display: none !important; } }`;
  }
  $('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
  board.resize();
}

function setDirty(dirty) {
  state.dirty = dirty;
  updateChrome();
}

function updateChrome() {
  const has = Boolean(state.current);
  $('#btnSave').disabled = !has || !state.dirty;
  $('#btnSaveCopy').disabled = !has;
  $('#btnPdf').disabled = !has;
  $('#btnPrint').disabled = !has;
  const label = has
    ? `${stem(state.current.name)} — ${state.current.kind === 'templates' ? 'Template' : 'Page'}`
    : 'No document open';
  $('#docName').textContent = label + (state.dirty ? ' •' : '');
  $('#inspectorHead').hidden = !has;
  if (has) {
    const template = state.current.kind === 'templates';
    $('#inspectorKind').textContent = template ? 'Template' : 'Page';
    $('#inspectorName').textContent = stem(state.current.name) + (state.dirty ? ' •' : '');
    $('#inspectorHead small').textContent = template
      ? 'Changes here apply to this template only'
      : 'Changes here apply to this page only';
  }
  $('#status').textContent = has ? (state.dirty ? 'Unsaved changes' : 'Saved') : '';
  $('#pathInfo').textContent = has ? `CVs/documents/${state.current.kind}/${state.current.name}` : '';
  document.title = has ? `${state.dirty ? '• ' : ''}${stem(state.current.name)} · CV Designer` : 'CV Designer';
}

function updateWordCount() {
  const text = doc()?.body?.innerText ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  $('#wordCount').textContent = `${words} words`;
  updatePages();
}

// ---------- A4 pages ----------
const A4_HEIGHT_PX = (297 / 25.4) * 96;

/** Counts the A4 pages the CV takes up and draws a mark where each one ends. */
function updatePages() {
  const d = doc();
  const page = d?.querySelector('.page') ?? d?.body;
  if (!page) return;
  if (page.querySelector(':scope > .frame')) return canvas.checkLayout(); // free-form layout: fixed page
  const pages = Math.max(1, Math.ceil(page.offsetHeight / A4_HEIGHT_PX - 0.01));
  const marks = [...page.querySelectorAll(':scope > .cv-pagebreak')];
  for (let i = marks.length; i < pages - 1; i++) {
    const m = d.createElement('div');
    m.setAttribute(EDITOR_ATTR, '');
    m.setAttribute('contenteditable', 'false');
    m.className = 'cv-pagebreak';
    page.append(m);
    marks.push(m);
  }
  marks.forEach((m, i) => {
    if (i >= pages - 1) return m.remove();
    m.style.top = `${(i + 1) * 297}mm`;
    m.dataset.label = `End of page ${i + 1} · page ${i + 2} starts`;
  });
  const el = $('#pageCount');
  el.textContent = pages === 1 ? '1 A4 page' : `⚠ ${pages} A4 pages: the content does not fit on one page`;
  el.classList.toggle('warn', pages > 1);
}

// ---------- Save ----------
function markOwnWrite(kind, name) {
  state.ownWrites.set(`${kind}/${name}`, Date.now());
}

/** Saves the active document. Returns false if it wasn't saved (cancelled or failed). */
async function save() {
  if (!state.current || !state.dirty) return true;
  const { kind, name } = state.current;
  if (kind === 'templates' && !state.confirmedTemplates.has(name)) {
    const ok = confirm(
      'You are about to change the TEMPLATE: new pages will start from this version.\n\nAre you sure? (To keep the template as it is, use "Save as page…")',
    );
    if (!ok) return false;
    state.confirmedTemplates.add(name);
  }
  const html = serialize();
  try {
    markOwnWrite(kind, name);
    await api(docUrl(kind, name), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html,
    });
    state.savedHtml = html;
    setDirty(false);
    toast('Saved');
    refreshList();
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

/** Saves what's on screen as a new page (the current template or page stays as it was saved). */
async function saveCopy() {
  if (!state.current) return;
  const today = new Date().toISOString().slice(0, 10);
  const base = stem(state.current.name).replace(/ - \d{4}-\d{2}-\d{2}( \(\d+\))?$/, '');
  const name = await askName('Save as page', `${base} - ${today}`);
  if (!name) return;
  const html = state.current.kind === 'templates' ? withTemplate(serialize(), state.current.name) : serialize();
  try {
    const res = await api('/api/docs/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, html }),
    });
    markOwnWrite('pages', res.name);
    // What was on screen now lives in the new page; the document we were on stays as it was saved.
    state.dirty = false;
    const next = { kind: 'pages', name: res.name };
    if (state.mode === 'template') await leaveTemplate({ saveFirst: false, next });
    else {
      await refreshList();
      await activate(next.kind, next.name, true);
    }
    toast(`Page saved: ${res.name}`);
  } catch (err) {
    toast(err.message, true);
  }
}

/**
 * Exports a document to PDF: the active one as it is on screen (unsaved changes included), or any
 * other template/page (from the sidebar ⋯ menu) as it was last saved.
 */
async function exportPdf(kind = state.current?.kind, docName = state.current?.name) {
  if (!kind || !docName) return;
  const isActive = state.current?.kind === kind && state.current?.name === docName;
  if (!state.chrome) {
    if (!isActive) return toast('Chrome not found, so the PDF cannot be generated. Open the page and use Print → "Save as PDF".', true);
    toast('Chrome not found, so the PDF cannot be generated; use "Save as PDF" in the print dialog.');
    return printDoc();
  }
  const name = await askName('Export PDF', stem(docName), 'Export');
  if (!name) return;
  const btn = $('#btnPdf');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const html = isActive ? serialize() : await api(docUrl(kind, docName));
    const res = await api('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, html }),
    });
    toast(`PDF created: <a href="${res.url}" target="_blank">${res.name}</a>`, false, true);
    refreshList();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.textContent = 'Export PDF';
    updateChrome();
  }
}

function printDoc() {
  iframe?.contentWindow?.focus();
  iframe?.contentWindow?.print();
}

// ---------- New page / new template ----------
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KIND_LABEL = { templates: 'Templates', pages: 'Pages' };

/**
 * Creates a document and opens it:
 *  - kind 'pages': a CV for a job, started from a template (or by duplicating another page);
 *  - kind 'templates': a base CV, from the blank layout or from an existing template or page.
 */
async function newDoc(kind) {
  const choice = await askNew(kind);
  if (!choice) return;
  const { name, source } = choice;
  try {
    let html = source
      ? await api(docUrl(source.kind, source.name))
      : TEMPLATE.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(stem(name))}</title>`);
    // A page remembers its template (a page copied from another page keeps that page's template).
    if (kind === 'pages' && source?.kind === 'templates') html = withTemplate(html, source.name);
    if (kind === 'templates') html = withoutTemplate(html);
    const res = await api(`/api/docs/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, html }),
    });
    markOwnWrite(res.kind, res.name);
    if (res.kind === 'templates') state.confirmedTemplates.add(res.name); // brand new: save without asking
    await openDoc(res.kind, res.name, { force: true });
    toast(kind === 'pages' ? `Page added: ${res.name}` : `Template created: ${res.name}`);
  } catch (err) {
    toast(err.message, true);
  }
}

function askNew(kind) {
  const dlg = $('#newDialog');
  const input = $('#newName');
  const select = $('#newFrom');
  const forPage = kind === 'pages';
  $('#newTitle').textContent = forPage ? 'Add page' : 'New template';
  // Sources: templates first (the usual start for a page), then pages; a template can also start blank.
  const sources = [
    ...(forPage ? [] : [null]),
    ...['templates', 'pages'].flatMap((k) => (state.docs[k] ?? []).map((f) => ({ kind: k, name: f.name }))),
  ];
  if (!sources.length) {
    toast('Create a template first (the “+” next to Templates).');
    return Promise.resolve(null);
  }
  select.innerHTML = (forPage ? '' : '<option value="0">Blank layout</option>') +
    ['templates', 'pages'].map((k) => {
      const opts = sources
        .map((src, i) => (src?.kind === k ? `<option value="${i}">${escapeHtml(stem(src.name))}</option>` : ''))
        .join('');
      return opts && `<optgroup label="${KIND_LABEL[k]}">${opts}</optgroup>`;
    }).join('');
  select.value = String(forPage ? 0 : sources.findIndex((s) => s?.kind === 'templates') + 1 || 0);
  input.value = forPage ? '' : 'New template';
  input.placeholder = forPage ? 'e.g. Sinch – Data Analyst II' : '';
  const update = () => {
    const src = sources[select.value];
    $('#newHint').textContent = forPage
      ? `A new page (a CV for one job) starting as a copy of “${stem(src.name)}”. Then tailor it to the job.`
      : src
        ? `A new template starting as a copy of “${stem(src.name)}”.`
        : 'A new template: a two-column A4 page with sample text to replace.';
  };
  select.onchange = update;
  update();
  dlg.returnValue = '';
  dlg.showModal();
  input.select();
  return new Promise((resolve) => {
    dlg.addEventListener(
      'close',
      () => resolve(dlg.returnValue === 'ok' && input.value.trim()
        ? { name: input.value.trim(), source: sources[select.value] }
        : null),
      { once: true },
    );
  });
}

// ---------- Name dialog ----------
function askName(title, value, okLabel = 'Save') {
  const dlg = $('#nameDialog');
  $('#nameDialogTitle').textContent = title;
  dlg.querySelector('button.primary').textContent = okLabel;
  const input = $('#nameInput');
  input.value = value;
  dlg.returnValue = ''; // so closing with Esc doesn't reuse the previous “ok”
  dlg.showModal();
  input.select();
  return new Promise((resolve) => {
    dlg.addEventListener(
      'close',
      () => resolve(dlg.returnValue === 'ok' ? input.value.trim() : null),
      { once: true },
    );
  });
}

// ---------- Formatting ----------
function exec(cmd, value = null) {
  const d = doc();
  if (!d) return;
  iframe?.contentWindow.focus();
  if (cmd === 'undo' && blocks.undo()) return;
  if (cmd === 'redo' && blocks.redo()) return;
  blocks.textEdited();
  d.execCommand('styleWithCSS', false, !['bold', 'italic', 'underline'].includes(cmd));
  d.execCommand(cmd, false, value);
  d.dispatchEvent(new Event('input'));
  updateToolbarState();
}

function updateToolbarState() {
  const d = doc();
  if (!d) return;
  document.querySelectorAll('#toolbar [data-cmd]').forEach((b) => {
    try { b.classList.toggle('active', d.queryCommandState(b.dataset.cmd)); } catch {}
  });
}

function insertLink() {
  const sel = doc()?.getSelection();
  const current = sel?.anchorNode?.parentElement?.closest('a')?.getAttribute('href') ?? 'https://';
  const url = prompt('Link address (https://…, mailto:…, tel:…)', current);
  if (url) exec('createLink', url);
}

function handleShortcuts(e) {
  const inField = e.target?.matches?.('input, select, textarea');
  if (!inField && canvas.onKeyDown(e)) {
    e.preventDefault();
    return;
  }
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && (e.shiftKey ? blocks.redo() : blocks.undo())) {
    e.preventDefault();
  } else if (k === 'y' && blocks.redo()) {
    e.preventDefault();
  } else if (k === 's') {
    e.preventDefault();
    e.shiftKey ? saveCopy() : save();
  } else if (e.key === '\\' || e.code === 'Backslash') {
    e.preventDefault();
    togglePanel(e.altKey ? 'right' : 'left');
  } else if (k === 'p') {
    e.preventDefault();
    printDoc();
  } else if (k === 'k') {
    e.preventDefault();
    insertLink();
  } else if (k === '=' || k === '+') {
    e.preventDefault();
    setZoom(state.zoom + 0.1);
  } else if (k === '-') {
    e.preventDefault();
    setZoom(state.zoom - 0.1);
  }
}

function setZoom(z) {
  // Keep the point at the center of the view where it is while the board grows or shrinks.
  const b = $('#board');
  const cx = (b.scrollLeft + b.clientWidth / 2) / (b.scrollWidth || 1);
  const cy = (b.scrollTop + b.clientHeight / 2) / (b.scrollHeight || 1);
  state.zoom = Math.min(2, Math.max(0.3, Math.round(z * 100) / 100));
  applyZoom();
  b.scrollLeft = cx * b.scrollWidth - b.clientWidth / 2;
  b.scrollTop = cy * b.scrollHeight - b.clientHeight / 2;
}

// ---------- Inspector: shape properties ----------
let selectedShapes = [];
// A line is a shape much longer than it is thick (stays a line while its thickness grows).
const isLine = (el) => {
  const thin = Math.min(el.offsetWidth, el.offsetHeight);
  return thin <= 20 && Math.max(el.offsetWidth, el.offsetHeight) >= 5 * thin;
};
const shapeColor = (el) => toHex(doc().defaultView.getComputedStyle(el).backgroundColor);

function updateShapePanel(objects = selectedShapes) {
  selectedShapes = objects.filter((o) => o.isConnected && o.classList.contains('shape'));
  const panel = $('#shapePanel');
  panel.hidden = !selectedShapes.length;
  if (!selectedShapes.length) return;
  const first = selectedShapes[0];
  const lines = selectedShapes.filter(isLine);
  const single = selectedShapes.length === 1;
  $('#shapeTitle').textContent = single ? (isLine(first) ? 'Line' : 'Shape') : `${selectedShapes.length} shapes`;
  const color = shapeColor(first);
  if (document.activeElement !== $('#shapeHex')) $('#shapeHex').value = color;
  $('#shapeColor').value = color;
  // Thickness for lines (their thin side); width/height for a single rectangle.
  $('#thicknessRow').hidden = !lines.length;
  if (lines.length) {
    const t = Math.min(lines[0].offsetWidth, lines[0].offsetHeight);
    $('#shapeThickness').value = t;
    $('#shapeThicknessRange').value = t;
  }
  $('#sizeRow').hidden = !(single && !isLine(first));
  if (single) {
    $('#shapeW').value = first.offsetWidth;
    $('#shapeH').value = first.offsetHeight;
  }
}

const setColor = (hex, commit) => canvas.setShape((o) => { o.style.background = hex; }, commit);
$('#shapeColor').addEventListener('input', (e) => {
  $('#shapeHex').value = e.target.value;
  setColor(e.target.value, false);
});
$('#shapeColor').addEventListener('change', (e) => setColor(e.target.value, true));
$('#shapeHex').addEventListener('change', (e) => {
  const v = e.target.value.trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{6}$/i.test(v)) setColor(v, true);
  else updateShapePanel();
});

/** A line's thickness is its thin side: height for horizontal lines, width for vertical ones. */
const setThickness = (t, commit) => {
  const px = `${Math.max(1, Math.round(t))}px`;
  canvas.setShape((o) => {
    if (!isLine(o)) return;
    if (o.offsetWidth >= o.offsetHeight) o.style.height = px;
    else o.style.width = px;
  }, commit);
  $('#shapeThickness').value = parseInt(px, 10);
  $('#shapeThicknessRange').value = parseInt(px, 10);
};
$('#shapeThicknessRange').addEventListener('input', (e) => setThickness(+e.target.value, false));
$('#shapeThicknessRange').addEventListener('change', (e) => setThickness(+e.target.value, true));
$('#shapeThickness').addEventListener('change', (e) => setThickness(+e.target.value || 1, true));
for (const [id, prop] of [['#shapeW', 'width'], ['#shapeH', 'height']]) {
  $(id).addEventListener('change', (e) => {
    const v = Math.max(1, Math.round(+e.target.value || 1));
    canvas.setShape((o) => { o.style[prop] = `${v}px`; });
  });
}

// ---------- Inspector: blocks & library ----------
const ICON = {
  grip: '<path class="dot" d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
  move: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  forget: '<path d="m7 7 10 10M17 7 7 17"/>',
};
const icon = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const escapeText = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function renderLibrary() {
  const box = $('#libraryList');
  if (!doc()?.querySelector('.page')) return box.replaceChildren();
  const sections = library.state();
  // Sections that hold blocks, or are still empty, can receive blocks; text-only sections
  // (a summary paragraph, the languages lines…) can't.
  const takesBlocks = (s) => s.items.length > 0 || !s.frame.querySelector(':scope > :not(h2, [data-cv-editor])');
  // A <select> laid over an icon: picking a section moves the block there.
  const sectionPicker = (exclude) => `
    <label class="lib-ico lib-pick" title="Move to another section">${icon('move')}
      <select><option value="" selected disabled>Move to section…</option>${sections.map((s, i) =>
        s.frame === exclude || !takesBlocks(s) ? '' : `<option value="${i}">${escapeText(s.title)}</option>`).join('')}</select>
    </label>`;

  // Sections without blocks (e.g. a summary paragraph) aren't listed, but can still receive blocks.
  box.innerHTML = sections.map((s, si) => !s.items.length ? '' : `
    <div class="lib-section" data-section="${si}">
      <div class="lib-title">${escapeText(s.title)}</div>
      ${s.items.map((it, ii) => `
        <div class="lib-row${it.visible ? '' : ' off'}" data-section="${si}" data-index="${ii}" draggable="true">
          <span class="lib-grip" title="Drag to reorder, or to another section">${icon('grip')}</span>
          <input type="checkbox" class="lib-check" ${it.visible ? 'checked' : ''} title="${it.visible ? 'Shown in the CV: untick to hide it' : 'Hidden: tick to show it again'}">
          <button class="lib-label" title="${it.visible ? 'Show in the CV' : 'Hidden from the CV'}">${escapeText(it.label)}</button>
          ${sectionPicker(s.frame)}
          ${it.visible ? '' : `<button class="lib-ico" data-act="forget" title="Delete for good">${icon('forget')}</button>`}
        </div>`).join('')}
    </div>`).join('');

  const itemOf = (row) => sections[row.dataset.section].items[row.dataset.index].el;
  box.onclick = (e) => {
    const row = e.target.closest('.lib-row');
    const btn = e.target.closest('button');
    if (!row || !btn) return;
    if (btn.classList.contains('lib-label')) return library.reveal(itemOf(row));
    const act = btn.dataset.act;
    if (act === 'forget' && confirm('Delete this block for good?')) library.forget(itemOf(row));
  };
  box.onchange = (e) => {
    const row = e.target.closest('.lib-row');
    if (!row) return;
    if (e.target.matches('.lib-check')) return library.setVisible(itemOf(row), e.target.checked);
    const target = sections[e.target.value]?.frame;
    if (target) library.moveTo(itemOf(row), target);
  };

  // Drag and drop rows: within a section to reorder, or onto another section to move the block there.
  let dragged = null;
  const clearMarks = () => box.querySelectorAll('.drop-before, .drop-after, .drop-end, .dragging')
    .forEach((n) => n.classList.remove('drop-before', 'drop-after', 'drop-end', 'dragging'));
  /** Where a drop at this event would land: { section, before (item element or null = end), mark } */
  const dropAt = (e) => {
    const row = e.target.closest('.lib-row');
    if (row) {
      const s = sections[row.dataset.section];
      const r = row.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      const i = Number(row.dataset.index) + (after ? 1 : 0);
      return { section: s, before: s.items[i]?.el ?? null, mark: [row, after ? 'drop-after' : 'drop-before'] };
    }
    const sec = e.target.closest('.lib-section');
    if (!sec) return null;
    const s = sections[sec.dataset.section];
    return { section: s, before: null, mark: [sec.querySelector('.lib-row:last-of-type') ?? sec, 'drop-after'] };
  };
  box.ondragstart = (e) => {
    const row = e.target.closest?.('.lib-row');
    if (!row) return;
    dragged = itemOf(row);
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };
  box.ondragover = (e) => {
    if (!dragged) return;
    const at = dropAt(e);
    if (!at) return;
    e.preventDefault();
    box.querySelectorAll('.drop-before, .drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
    at.mark[0].classList.add(at.mark[1]);
  };
  box.ondrop = (e) => {
    const at = dragged && dropAt(e);
    const item = dragged;
    dragged = null;
    clearMarks();
    if (!at) return;
    e.preventDefault();
    library.place(item, at.section.frame, at.before);
  };
  box.ondragend = () => {
    dragged = null;
    clearMarks();
  };
}

// ---------- Inspector: margins ----------
let hotRegion = null; // region whose controls are under the mouse: its guide is highlighted

function drawMargins() {
  drawMarginGuides(doc()?.querySelector('.page'), EDITOR_ATTR, hotRegion);
}

function renderMargins() {
  const list = $('#marginsList');
  const page = doc()?.querySelector('.page');
  if (!regionRects(page)) {
    list.innerHTML = '<p class="hint">Margins need the side stripe and the header rule of the CV layout.</p>';
    return;
  }
  list.replaceChildren(...REGIONS.map(({ id, label }) => {
    const box = document.createElement('div');
    box.className = 'margin-region';
    box.dataset.region = id;
    box.innerHTML = `<div class="margin-title">${label}</div><div class="geo margins">${SIDES.map((s) =>
      `<label>${s[0].toUpperCase() + s.slice(1)} <input type="number" min="0" step="1" data-side="${s}"></label>`).join('')}</div>`;
    box.addEventListener('change', (e) => {
      const side = e.target.dataset.side;
      if (!side) return;
      blocks.snapshot();
      setMargin(doc().querySelector('.page'), id, side, parseFloat(e.target.value) || 0);
      blocks.committed();
    });
    const hot = (on) => {
      hotRegion = on ? id : null;
      drawMargins();
    };
    box.addEventListener('mouseenter', () => hot(true));
    box.addEventListener('mouseleave', () => hot(box.contains(document.activeElement)));
    box.addEventListener('focusin', () => hot(true));
    box.addEventListener('focusout', () => hot(false));
    return box;
  }));
  updateMarginInputs();
}

function updateMarginInputs() {
  const margins = readMargins(doc()?.querySelector('.page'));
  for (const input of document.querySelectorAll('#marginsList input[data-side]')) {
    const v = margins[input.closest('.margin-region').dataset.region]?.[input.dataset.side];
    if (v != null && document.activeElement !== input) input.value = v;
  }
}

initTooltips(document);

// ---------- Editor theme (temporary picker) ----------
const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const accent = () => cssVar('--accent', '#2b5797');

let currentStyle = 'cute';
function setTheme(id) {
  const theme = currentStyle === 'cute' ? applyTheme(id) : THEMES.find((t) => t.id === id) ?? THEMES[0];
  try { localStorage.setItem('cv-editor:theme', theme.id); } catch {}
  $('#themeSelect').value = theme.id;
  $('#themeNote').textContent = theme.note;
  document.querySelectorAll('#themeSwatches button').forEach((b) => b.classList.toggle('current', b.dataset.theme === theme.id));
  applyZoom(); // the desk color inside the editor follows the theme
}

const themeGroups = [...new Set(THEMES.map((t) => t.group))];
$('#themeSelect').innerHTML = themeGroups.map((g) => `<optgroup label="${g}">${THEMES.filter((t) => t.group === g)
  .map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</optgroup>`).join('');
$('#themeSwatches').replaceChildren(...themeGroups.flatMap((g) => [
  Object.assign(document.createElement('div'), { className: 'swatch-group', textContent: g }),
  ...THEMES.filter((t) => t.group === g).map((t) => {
    const b = document.createElement('button');
    b.dataset.theme = t.id;
    b.title = t.name;
    b.style.background = `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`;
    b.addEventListener('click', () => setTheme(t.id));
    return b;
  }),
]));
const stepTheme = (d) => {
  const i = THEMES.findIndex((t) => t.id === $('#themeSelect').value);
  setTheme(THEMES[(i + d + THEMES.length) % THEMES.length].id);
};
$('#themeSelect').addEventListener('change', (e) => setTheme(e.target.value));
$('#themePrev').addEventListener('click', () => stepTheme(-1));
$('#themeNext').addEventListener('click', () => stepTheme(1));
$('#themeFab').addEventListener('click', () => ($('#themePop').hidden = !$('#themePop').hidden));
$('#themeClose').addEventListener('click', () => ($('#themePop').hidden = true));
let savedTheme = null;
try { savedTheme = localStorage.getItem('cv-editor:theme'); } catch {}
setTheme(savedTheme ?? THEMES[0].id);
$('#themePop').hidden = Boolean(savedTheme); // first visit: open, so the picker is noticed

// UI styles: a whole look (fonts, shapes, textures, colors); "cute" uses the palettes.
function setStyle(id) {
  const style = applyUiStyle(id, $('#themeSelect').value);
  currentStyle = style.id;
  try { localStorage.setItem('cv-editor:style', style.id); } catch {}
  $('#styleSelect').value = style.id;
  $('#styleNote').textContent = style.note;
  $('#paletteBox').hidden = style.id !== 'cute';
  applyZoom(); // the accent used inside the page follows the style
}
$('#styleSelect').innerHTML = STYLES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
const stepStyle = (d) => {
  const i = STYLES.findIndex((s) => s.id === $('#styleSelect').value);
  setStyle(STYLES[(i + d + STYLES.length) % STYLES.length].id);
};
$('#styleSelect').addEventListener('change', (e) => setStyle(e.target.value));
$('#stylePrev').addEventListener('click', () => stepStyle(-1));
$('#styleNext').addEventListener('click', () => stepStyle(1));
let savedStyle = null;
try { savedStyle = localStorage.getItem('cv-editor:style'); } catch {}
setStyle(savedStyle ?? 'cute');

// ---------- Side panels: show / hide ----------
function setPanel(side, visible) {
  document.body.classList.toggle(`hide-${side}`, !visible);
  $(side === 'left' ? '#toggleLeft' : '#toggleRight').classList.toggle('on', visible);
  try { localStorage.setItem(`cv-editor:panel-${side}`, visible ? 'shown' : 'hidden'); } catch {}
  // The board got wider or narrower: keep the active page in the middle.
  if (state.current) {
    requestAnimationFrame(() => {
      board.resize(); // end margins for the new width, before centering
      board.glideTo(state.current.kind, state.current.name, { instant: true });
    });
  }
}
const togglePanel = (side) => setPanel(side, document.body.classList.contains(`hide-${side}`));
for (const side of ['left', 'right']) {
  let shown = true;
  try { shown = localStorage.getItem(`cv-editor:panel-${side}`) !== 'hidden'; } catch {}
  document.body.classList.toggle(`hide-${side}`, !shown);
  $(side === 'left' ? '#toggleLeft' : '#toggleRight').classList.toggle('on', shown);
}
$('#toggleLeft').addEventListener('click', () => togglePanel('left'));
$('#toggleRight').addEventListener('click', () => togglePanel('right'));

// Collapsible inspector panels: remember which ones are open.
for (const panel of document.querySelectorAll('.inspector .panel')) {
  try {
    const saved = JSON.parse(localStorage.getItem('cv-editor:panels') || '{}');
    if (panel.dataset.panel in saved) panel.open = saved[panel.dataset.panel];
  } catch {}
  panel.addEventListener('toggle', () => {
    try {
      const saved = JSON.parse(localStorage.getItem('cv-editor:panels') || '{}');
      saved[panel.dataset.panel] = panel.open;
      localStorage.setItem('cv-editor:panels', JSON.stringify(saved));
    } catch {}
  });
}

try { $('#marginsToggle').checked = localStorage.getItem('cv-editor:margins') === 'shown'; } catch {}
$('#marginsToggle').addEventListener('change', (e) => {
  doc()?.body.classList.toggle('cv-hide-margins', !e.target.checked);
  try { localStorage.setItem('cv-editor:margins', e.target.checked ? 'shown' : 'hidden'); } catch {}
});

// ---------- Inspector: layout ----------
function updateLayoutStatus({ outside, overlaps }) {
  const el = $('#pageCount');
  const msgs = [];
  if (outside) msgs.push(`${outside} frame${outside > 1 ? 's' : ''} outside the page`);
  if (overlaps) msgs.push(`${overlaps} frames overlap`);
  el.textContent = msgs.length ? `⚠ ${msgs.join(' · ')}` : '1 A4 page · no overlaps';
  el.classList.toggle('warn', msgs.length > 0);
  $('#btnResolve').classList.toggle('attention', overlaps > 0);
}

const toHex = (c) => {
  const m = String(c).match(/\d+(\.\d+)?/g);
  if (!m || c.startsWith('#')) return c?.startsWith('#') ? c : '#000000';
  return '#' + m.slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('');
};

$('#btnResolve').addEventListener('click', () => doc() && canvas.resolveOverlaps());

// ---------- Inspector: text styles ----------
const WEIGHT_NAMES = { 400: 'Regular', 500: 'Medium', 700: 'Bold' };
const num = (v) => parseFloat(v) || 0;
/** Letter spacing in Canva units (thousandths of an em); older CVs may still store it in px. */
const canvaSpacing = (v) => {
  const n = num(v.spacing);
  return Math.round(String(v.spacing).trim().endsWith('px') ? (n / (num(v.size) * 4 / 3)) * 1000 : n * 1000);
};
let styleValues = null;
let styleEditing = false;

function previewCss(v) {
  const size = Math.min(17, Math.max(11, num(v.size) * 1.45));
  return `font-family:${v.font};font-weight:${v.weight};font-style:${v.style};` +
    `text-transform:${v.case};color:${v.color};font-size:${size}px;letter-spacing:${v.spacing}`;
}

function ensureFontsLoaded() {
  // Load every font in the catalog into the editor for the previews.
  if (document.getElementById('ui-fonts')) return;
  const link = document.createElement('link');
  link.id = 'ui-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?' +
    FONTS.filter((f) => !f.system).map((f) => `family=${f.name.replace(/ /g, '+')}:wght@${f.weights.join(';')}`).join('&') + '&display=swap';
  document.head.append(link);
}

function renderStyles() {
  const list = $('#stylesList');
  styleValues = readStyles(doc());
  list.replaceChildren();
  if (!styleValues) {
    list.innerHTML = '<p class="hint">This document has no text styles defined.</p>';
    return;
  }
  ensureFontsLoaded();
  for (const s of TEXT_STYLES) list.append(styleRow(s));
  markActiveStyle();
}

function styleRow(s) {
  const v = styleValues[s.id];
  const row = document.createElement('div');
  row.className = 'style-row';
  row.dataset.id = s.id;

  const apply = document.createElement('button');
  apply.className = 'style-apply';
  apply.title = s.inline ? 'Apply to the selection (or remove)' : 'Apply to the paragraph';
  apply.innerHTML = `<span class="preview"></span><span class="meta"></span>`;
  apply.addEventListener('mousedown', (e) => e.preventDefault()); // keep the CV selection
  apply.addEventListener('click', () => {
    blocks.snapshot();
    const msg = applyStyle(doc(), s.id);
    blocks.committed();
    if (msg) toast(msg);
    markActiveStyle();
  });

  const edit = document.createElement('button');
  edit.className = 'style-edit';
  edit.title = 'Edit the style across the document';
  edit.textContent = '✎';
  edit.addEventListener('click', () => {
    form.hidden = !form.hidden;
    edit.classList.toggle('active', !form.hidden);
  });

  const form = document.createElement('div');
  form.className = 'style-form';
  form.hidden = true;
  const font = fontByStack(v.font);
  const fontOptions = FONTS.map((f) => `<option value='${f.stack}'>${f.name}</option>`).join('') +
    (font ? '' : `<option value='${v.font}'>${v.font}</option>`);
  const weights = (font?.weights ?? [400, 700]).map((w) => `<option value="${w}">${WEIGHT_NAMES[w] ?? w}</option>`).join('');
  form.innerHTML = `
    <label class="wide">Font <select data-p="font">${fontOptions}</select></label>
    <label>Size <span class="unit"><input type="number" data-p="size" step="0.25" min="4"> pt</span></label>
    <label>Weight <select data-p="weight">${weights}</select></label>
    <label class="wide">Letter spacing <span class="slider"><input type="range" data-r="spacing" min="-200" max="800" step="1"
      ><input type="number" data-p="spacing" step="1"></span></label>
    <label class="wide">Line spacing <span class="slider"><input type="range" data-r="leading" min="0.5" max="2.5" step="0.01"
      ><input type="number" data-p="leading" step="0.01" min="0.5"></span></label>
    <label>Before <span class="unit"><input type="number" data-p="before" step="0.25" min="0"> pt</span></label>
    <label>After <span class="unit"><input type="number" data-p="after" step="0.25" min="0"> pt</span></label>
    <label>Color <input type="color" data-p="color"></label>
    <label class="check"><input type="checkbox" data-p="style"> Italic</label>
    <label class="check"><input type="checkbox" data-p="case"> UPPERCASE</label>`;
  const fields = Object.fromEntries([...form.querySelectorAll('[data-p]')].map((f) => [f.dataset.p, f]));
  const ranges = Object.fromEntries([...form.querySelectorAll('[data-r]')].map((f) => [f.dataset.r, f]));
  fields.font.value = v.font;
  fields.size.value = num(v.size);
  fields.weight.value = v.weight;
  fields.leading.value = ranges.leading.value = num(v.leading);
  fields.spacing.value = ranges.spacing.value = canvaSpacing(v);
  fields.before.value = num(v.before);
  fields.after.value = num(v.after);
  fields.color.value = toHex(v.color);
  fields.style.checked = v.style === 'italic';
  fields.case.checked = v.case === 'uppercase';

  const read = {
    font: (f) => f.value,
    size: (f) => `${num(f.value)}pt`,
    weight: (f) => f.value,
    leading: (f) => `${num(f.value)}`,
    spacing: (f) => `${num(f.value) / 1000}em`,
    before: (f) => `${num(f.value)}pt`,
    after: (f) => `${num(f.value)}pt`,
    color: (f) => f.value,
    style: (f) => (f.checked ? 'italic' : 'normal'),
    case: (f) => (f.checked ? 'uppercase' : 'none'),
  };
  form.addEventListener('input', (e) => {
    // Each slider and its number box mirror each other; the number box holds the value.
    let field = e.target;
    if (field.dataset.r) {
      fields[field.dataset.r].value = field.value;
      field = fields[field.dataset.r];
    } else if (ranges[field.dataset.p]) {
      ranges[field.dataset.p].value = field.value;
    }
    const p = field.dataset.p;
    if (!p) return;
    if (!styleEditing) {
      blocks.snapshot();
      styleEditing = true;
    }
    styleValues[s.id][p] = read[p](field);
    if (p === 'font') {
      // Match the available weights to the new font.
      const f = fontByStack(e.target.value);
      const ws = f?.weights ?? [400, 700];
      fields.weight.innerHTML = ws.map((w) => `<option value="${w}">${WEIGHT_NAMES[w] ?? w}</option>`).join('');
      const cur = Number(styleValues[s.id].weight);
      const best = ws.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
      fields.weight.value = best;
      styleValues[s.id].weight = String(best);
    }
    writeStyles(doc(), styleValues);
    paintRow(row, s);
    setDirty(serialize() !== state.savedHtml);
  });
  form.addEventListener('change', () => {
    if (!styleEditing) return;
    styleEditing = false;
    blocks.committed();
  });

  row.append(apply, edit, form);
  paintRow(row, s);
  return row;
}

function paintRow(row, s) {
  const v = styleValues[s.id];
  const preview = row.querySelector('.preview');
  preview.textContent = s.label;
  preview.style.cssText = previewCss(v);
  const font = fontByStack(v.font)?.name ?? v.font;
  row.querySelector('.meta').textContent = `${font} · ${num(v.size)} pt`;
}

function markActiveStyle() {
  const sel = doc()?.getSelection();
  const id = sel?.rangeCount ? detectStyle(sel.anchorNode) : null;
  document.querySelectorAll('.style-row').forEach((r) => r.classList.toggle('active', r.dataset.id === id));
}

// ---------- Toasts ----------
let toastTimer;
function toast(msg, error = false, html = false) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el[html ? 'innerHTML' : 'textContent'] = msg;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), html ? 8000 : 3000);
}

// ---------- Changes on disk (e.g. edits made by Claude) ----------
function listenForChanges() {
  const es = new EventSource('/api/events');
  let listTimer;
  es.onmessage = (e) => {
    const { kind, name } = JSON.parse(e.data);
    clearTimeout(listTimer);
    listTimer = setTimeout(refreshList, 200);
    if (state.current?.kind !== kind || state.current?.name !== name) return;
    if (Date.now() - (state.ownWrites.get(`${kind}/${name}`) ?? 0) < 2000) return;
    if (state.dirty) {
      $('#banner').hidden = false;
    } else {
      openDoc(kind, name, { force: true }).then(() => toast('Document reloaded from disk'));
    }
  };
}

// ---------- Startup ----------
document.querySelectorAll('#toolbar [data-cmd]').forEach((b) => {
  b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
  b.addEventListener('click', () => exec(b.dataset.cmd));
});
$('#foreColor').addEventListener('input', (e) => exec('foreColor', e.target.value));
$('#hiliteColor').addEventListener('input', (e) => exec('hiliteColor', e.target.value));
$('#btnLink').addEventListener('mousedown', (e) => e.preventDefault());
$('#btnLink').addEventListener('click', insertLink);
$('#zoomIn').addEventListener('click', () => setZoom(state.zoom + 0.1));
$('#zoomOut').addEventListener('click', () => setZoom(state.zoom - 0.1));

$('#btnAddPage').addEventListener('click', () => newDoc('pages'));
$('#btnFromJob').addEventListener('click', newFromJob);
$('#btnNewTemplate').addEventListener('click', () => newDoc('templates'));
$('#btnSave').addEventListener('click', save);
$('#btnSaveCopy').addEventListener('click', saveCopy);
$('#btnPdf').addEventListener('click', () => exportPdf());
$('#btnPrint').addEventListener('click', printDoc);
$('#bannerReload').addEventListener('click', () => openDoc(state.current.kind, state.current.name, { force: true }));
$('#bannerDismiss').addEventListener('click', () => ($('#banner').hidden = true));

document.addEventListener('keydown', handleShortcuts);
window.addEventListener('beforeunload', (e) => {
  if (state.dirty) e.preventDefault();
});

updateChrome();
listenForChanges();
refreshList().then(() => {
  let last = null;
  try { last = JSON.parse(localStorage.getItem('cv-editor:last')); } catch {}
  // Start on the pages (the last one used, or the first); templates open only on purpose.
  const lastItem = last?.kind === 'pages' && [...document.querySelectorAll('#list-pages li')].find((li) => li.title === last.name);
  (lastItem || document.querySelector('#list-pages li:not(.none)'))?.click();
});
