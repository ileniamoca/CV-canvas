// The job brief: a screen-only card shown above a page that is linked to a job ad (<meta name="cv-job">).
// It renders the ad's Markdown file from ../jobs: the title and its meta lines, then each "## " section.
// Two sections get a special look:
//   ## Fit            → its "### " groups become columns (have / partly / missing, guessed from the heading)
//                       with a bar that counts the items of each group
//   ## Job ad (as pasted), ## Tailoring notes → folded away (<details>)
// Never printed or exported: it lives in the editor, not in the CV document.

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Bold, italics, code and links inside one line (already escaped). */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

/** A small Markdown subset: paragraphs, nested bullet lists, "### " / "#### " headings, "a · b · c" chip lines. */
function blocks(lines) {
  let html = '';
  let para = [];
  const flush = () => {
    if (para.length) html += `<p>${inline(para.join(' '))}</p>`;
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{3,4})\s+(.*)$/);
    if (h) {
      flush();
      html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      // Consume the whole list, nesting by indentation.
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(/^(\s*)[-*]\s+(.*)$/);
        if (m) items.push({ depth: Math.floor(m[1].length / 2), text: m[2] });
        else items[items.length - 1].text += ` ${lines[i].trim()}`;
        i++;
      }
      i--;
      html += list(items);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // A line like "SQL · dashboards · QA" reads best as chips.
    if (line.split(' · ').length >= 3 && !para.length) {
      html += `<p class="chips">${line.split(' · ').map((c) => `<span>${inline(c.trim())}</span>`).join('')}</p>`;
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return html;
}

/** Items [{depth, text}] → nested <ul>: an item's children are the deeper items right after it. */
function list(items, depth = items[0]?.depth ?? 0) {
  let html = '<ul>';
  for (let i = 0; i < items.length;) {
    const it = items[i++];
    const kids = [];
    while (i < items.length && items[i].depth > depth) kids.push(items[i++]);
    html += `<li>${inline(it.text)}${kids.length ? list(kids, depth + 1) : ''}</li>`;
  }
  return `${html}</ul>`;
}

/** "### Have" → have, "### Partly" → partly, "### Missing" → missing (else neutral). */
function fitKind(heading) {
  const h = heading.toLowerCase();
  if (/miss|lack|gap|don.t|no\b|✗|❌/.test(h)) return 'missing';
  if (/part|some|close|◐|≈/.test(h)) return 'partly';
  if (/have|match|strong|yes|✓|✅/.test(h)) return 'have';
  return 'neutral';
}

function fitSection(lines) {
  const groups = [];
  const intro = [];
  for (const line of lines) {
    const h = line.match(/^###\s+(.*)$/);
    if (h) groups.push({ title: h[1], lines: [] });
    else if (groups.length) groups.at(-1).lines.push(line);
    else intro.push(line);
  }
  const count = (g) => g.lines.filter((l) => /^[-*]\s+/.test(l)).length;
  const bar = groups.map((g) => `<span class="jb-${fitKind(g.title)}" style="flex: ${count(g)}" title="${esc(g.title)}: ${count(g)}"></span>`).join('');
  const legend = groups.map((g) => `<span class="jb-key jb-${fitKind(g.title)}"><i></i>${inline(g.title)} <b>${count(g)}</b></span>`).join('');
  return `${blocks(intro)}
    <div class="jb-bar" aria-hidden="true">${bar}</div>
    <div class="jb-legend">${legend}</div>
    <div class="jb-fit">${groups.map((g) => `
      <div class="jb-col jb-${fitKind(g.title)}"><h4>${inline(g.title)}</h4>${blocks(g.lines)}</div>`).join('')}
    </div>`;
}

/** Markdown of a job file → HTML of the brief. */
export function renderJobBrief(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let title = 'Job ad';
  const meta = [];
  const sections = [];
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    if (h1 && !sections.length) title = h1[1];
    else if (h2) sections.push({ title: h2[1], lines: [] });
    else if (sections.length) sections.at(-1).lines.push(line);
    else {
      const m = line.match(/^[-*]\s+\*\*([^*]+?):?\*\*:?\s*(.*)$/);
      if (m && !/cv page/i.test(m[1])) meta.push([m[1].replace(/:$/, ''), m[2]]);
    }
  }
  const body = sections.map((s) => {
    const folded = /as pasted|tailoring notes/i.test(s.title);
    const inner = /^fit\b|my fit|how i fit/i.test(s.title) ? fitSection(s.lines) : blocks(s.lines);
    return folded
      ? `<details class="jb-section jb-folded"><summary>${inline(s.title)}</summary>${inner}</details>`
      : `<section class="jb-section"><h3>${inline(s.title)}</h3>${inner}</section>`;
  }).join('');
  return `
    <header class="jb-head"><h2>${inline(title)}</h2>
      <dl class="jb-meta">${meta.map(([k, v]) => `<div><dt>${inline(k)}</dt><dd>${inline(v)}</dd></div>`).join('')}</dl>
    </header>${body}`;
}
