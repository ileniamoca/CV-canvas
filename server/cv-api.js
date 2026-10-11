import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { htmlToPdf, findChrome } from './pdf.js';

const ROOT = path.resolve('documents');
// templates: the base CVs every new page starts from · pages: the CVs sent to each job · pdf: exports
const DIRS = {
  templates: path.join(ROOT, 'templates'),
  pages: path.join(ROOT, 'pages'),
  pdf: path.join(ROOT, 'pdf'),
};
const EXT = { templates: '.html', pages: '.html', pdf: '.pdf' };
const LEGACY = { originals: 'templates', copies: 'pages' }; // folder names before 10/2026

/** Moves documents from the old folder names into the new ones (once). */
function migrateLegacyDirs() {
  for (const [old, kind] of Object.entries(LEGACY)) {
    const from = path.join(ROOT, old);
    if (!fs.existsSync(from)) continue;
    for (const name of fs.readdirSync(from)) {
      const to = path.join(DIRS[kind], name);
      if (!fs.existsSync(to)) fs.renameSync(path.join(from, name), to);
    }
    if (!fs.readdirSync(from).length) fs.rmdirSync(from);
  }
}

/** Returns the absolute path of a document, or throws if the name is invalid. */
function resolveDoc(kind, name) {
  kind = LEGACY[kind] ?? kind; // an editor tab opened before the rename still says originals/copies
  if (!DIRS[kind]) throw httpError(400, `Unknown folder: ${kind}`);
  const base = path.basename(String(name || ''));
  if (!base || base.startsWith('.') || path.extname(base) !== EXT[kind]) {
    throw httpError(400, `Invalid name: ${name}`);
  }
  return path.join(DIRS[kind], base);
}

/** Sanitizes a user-chosen name so it can be used as a file name. */
function cleanName(name, ext) {
  const stem = String(name || '')
    .replace(new RegExp(`\\${ext}$`, 'i'), '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/^\.+/, '')
    .trim();
  if (!stem) throw httpError(400, 'The name is empty.');
  return stem + ext;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// A page records the template it was made from: <meta name="cv-template" content="Template name">
const TEMPLATE_META = /<meta name="cv-template" content="([^"]*)">/;
// …and, if made from a job ad, the ad's file in ../jobs: <meta name="cv-job" content="company-role.md">
const JOB_META = /<meta name="cv-job" content="([^"]*)">/;
// Job ads live next to the career docs, outside this repo (private): portfolio_web/jobs/
const JOBS_DIR = path.resolve('..', 'jobs');
const unescapeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** After a template is renamed, its pages point to the new name. */
async function retargetPages(oldStem, newStem) {
  for (const name of await fsp.readdir(DIRS.pages)) {
    if (!name.endsWith('.html')) continue;
    const file = path.join(DIRS.pages, name);
    const html = await fsp.readFile(file, 'utf8');
    const m = html.match(TEMPLATE_META);
    if (m && unescapeAttr(m[1]) === oldStem) {
      await fsp.writeFile(file, html.replace(TEMPLATE_META, `<meta name="cv-template" content="${escapeAttr(newStem)}">`), 'utf8');
    }
  }
}

async function listDir(kind) {
  const entries = await fsp.readdir(DIRS[kind], { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.endsWith(EXT[kind]))
      .map(async (e) => {
        const file = path.join(DIRS[kind], e.name);
        const st = await fsp.stat(file);
        const doc = { name: e.name, mtime: st.mtimeMs, created: st.birthtimeMs || st.ctimeMs, size: st.size };
        if (kind === 'pages') {
          const m = (await fsp.readFile(file, 'utf8')).match(TEMPLATE_META);
          doc.template = m ? unescapeAttr(m[1]) : null;
          const j = (await fsp.readFile(file, 'utf8')).match(JOB_META);
          doc.job = j ? unescapeAttr(j[1]) : null;
        }
        return doc;
      }),
  );
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return req.headers['content-type']?.includes('json') ? JSON.parse(raw || '{}') : raw;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

export function cvApi() {
  return {
    name: 'cv-api',
    configureServer(server) {
      for (const dir of Object.values(DIRS)) fs.mkdirSync(dir, { recursive: true });
      migrateLegacyDirs();

      // Live notifications (SSE) when a file changes on disk, e.g. edited by Claude.
      const clients = new Set();
      const timers = new Map();
      // Only notify if the mtime really changed: on macOS fs.watch re-emits old events on startup.
      const mtimes = new Map();
      const mtimeOf = (rel) => {
        try { return fs.statSync(path.join(ROOT, rel)).mtimeMs; } catch { return null; }
      };
      for (const kind of Object.keys(DIRS)) {
        for (const name of fs.readdirSync(DIRS[kind])) mtimes.set(path.join(kind, name), mtimeOf(path.join(kind, name)));
      }
      const watcher = fs.watch(ROOT, { recursive: true }, (_evt, rel) => {
        if (!rel) return;
        const [kind, name] = rel.split(path.sep);
        if (!DIRS[kind] || !name || name.startsWith('.')) return;
        clearTimeout(timers.get(rel));
        timers.set(rel, setTimeout(() => {
          timers.delete(rel);
          const mtime = mtimeOf(rel);
          if (mtimes.get(rel) === mtime) return;
          mtimes.set(rel, mtime);
          const msg = `data: ${JSON.stringify({ kind, name })}\n\n`;
          for (const c of clients) c.write(msg);
        }, 150));
      });
      server.httpServer?.on('close', () => watcher.close());

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/files/')) return next();
        const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

        try {
          // GET /api/events
          if (parts[1] === 'events') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-store',
              Connection: 'keep-alive',
            });
            res.write(': ok\n\n');
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return;
          }

          // GET /api/docs
          if (parts[1] === 'docs' && parts.length === 2 && req.method === 'GET') {
            const [templates, pages, pdf] = await Promise.all(
              ['templates', 'pages', 'pdf'].map(listDir),
            );
            return send(res, 200, { templates, pages, pdf, chrome: Boolean(findChrome()) });
          }

          // /api/docs/:kind/:name  (GET read, PUT save, DELETE delete)
          if (parts[1] === 'docs' && parts.length === 4) {
            const [, , kind, name] = parts;
            const file = resolveDoc(kind, name);
            if (req.method === 'GET') {
              return send(res, 200, await fsp.readFile(file, 'utf8'), 'text/html; charset=utf-8');
            }
            if (req.method === 'PUT' && kind !== 'pdf') {
              const html = await readBody(req);
              if (!html.trim()) throw httpError(400, 'Empty document.');
              await fsp.writeFile(file, html, 'utf8');
              return send(res, 200, { ok: true, kind, name: path.basename(file) });
            }
            // PATCH { name: newName } → renames the document (never overwrites another one)
            if (req.method === 'PATCH') {
              const { name: newName } = await readBody(req);
              const dirKind = path.basename(path.dirname(file));
              const target = path.join(path.dirname(file), cleanName(newName, EXT[dirKind]));
              if (target === file) return send(res, 200, { ok: true, kind: dirKind, name: path.basename(file) });
              if (fs.existsSync(target)) throw httpError(409, `There is already a document called "${path.basename(target)}".`);
              await fsp.rename(file, target);
              if (dirKind === 'templates') {
                await retargetPages(path.basename(file, '.html'), path.basename(target, '.html'));
              }
              return send(res, 200, { ok: true, kind: dirKind, name: path.basename(target) });
            }
            if (req.method === 'DELETE' && kind !== 'templates') {
              await fsp.unlink(file);
              return send(res, 200, { ok: true });
            }
          }

          // POST /api/docs/:kind  { name, html }  → creates a new page or template (never overwrites)
          if (parts[1] === 'docs' && parts.length === 3 && req.method === 'POST') {
            const kind = parts[2];
            const { name, html } = await readBody(req);
            if (kind !== 'pages' && kind !== 'templates') throw httpError(400, `Invalid folder: ${kind}`);
            if (!String(html || '').trim()) throw httpError(400, 'Empty document.');
            let fileName = cleanName(name, '.html');
            const stem = fileName.slice(0, -5);
            for (let i = 2; fs.existsSync(path.join(DIRS[kind], fileName)); i++) {
              fileName = `${stem} (${i}).html`;
            }
            await fsp.writeFile(path.join(DIRS[kind], fileName), html, 'utf8');
            return send(res, 200, { ok: true, kind, name: fileName });
          }

          // POST /api/jobs  { company, role, url?, text, page }  → saves a pasted job ad as ../jobs/<company-role>.md
          if (parts[1] === 'jobs' && parts.length === 2 && req.method === 'POST') {
            const { company = '', role = '', url = '', text = '', page = '' } = await readBody(req);
            if (!String(text).trim()) throw httpError(400, 'Paste the job ad first.');
            if (!String(company).trim() || !String(role).trim()) throw httpError(400, 'Company and role are needed.');
            const slug = `${company}-${role}`.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
              .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'job';
            await fsp.mkdir(JOBS_DIR, { recursive: true });
            let fileName = `${slug}.md`;
            for (let i = 2; fs.existsSync(path.join(JOBS_DIR, fileName)); i++) fileName = `${slug}-${i}.md`;
            const md = [
              `# ${company.trim()} — ${role.trim()}`,
              '',
              `- **Company:** ${company.trim()}`,
              `- **Role:** ${role.trim()}`,
              ...(url.trim() ? [`- **Link:** ${url.trim()}`] : []),
              `- **Saved:** ${new Date().toLocaleDateString('sv-SE')}`, // local date, YYYY-MM-DD
              ...(page ? [`- **CV page:** \`CVs/documents/pages/${page}\``] : []),
              '- **Status:** to tailor',
              '',
              '## Job ad (as pasted)',
              '',
              String(text).trim(),
              '',
            ].join('\n');
            await fsp.writeFile(path.join(JOBS_DIR, fileName), md, 'utf8');
            return send(res, 200, { ok: true, file: fileName });
          }

          // GET /api/jobs/:file  → a saved job ad (Markdown)
          if (parts[1] === 'jobs' && parts.length === 3 && req.method === 'GET') {
            const base = path.basename(parts[2]);
            if (!base.endsWith('.md')) throw httpError(400, `Invalid name: ${parts[2]}`);
            return send(res, 200, await fsp.readFile(path.join(JOBS_DIR, base), 'utf8'), 'text/markdown; charset=utf-8');
          }

          // POST /api/pdf  { name, html }  → generates documents/pdf/<name>.pdf
          if (parts[1] === 'pdf' && req.method === 'POST') {
            const { name, html } = await readBody(req);
            const fileName = cleanName(name, '.pdf');
            await htmlToPdf(html, path.join(DIRS.pdf, fileName));
            return send(res, 200, { ok: true, name: fileName, url: `/files/pdf/${encodeURIComponent(fileName)}` });
          }

          // GET /files/:kind/:name  → serves the file as is (to open PDFs / preview)
          if (parts[0] === 'files' && parts.length === 3 && req.method === 'GET') {
            const file = resolveDoc(parts[1], parts[2]);
            const type = file.endsWith('.pdf') ? 'application/pdf' : 'text/html; charset=utf-8';
            return send(res, 200, await fsp.readFile(file), type);
          }

          throw httpError(404, 'Route not found');
        } catch (err) {
          const status = err.status ?? (err.code === 'ENOENT' ? 404 : 500);
          if (status === 500) console.error('[cv-api]', err);
          return send(res, status, { error: err.message });
        }
      });
    },
  };
}
