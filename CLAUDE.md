# CV Designer

A local tool I built (with Vite) to design and edit my CVs the way I would in Word or Canva: templates, one page per
job application, and PDF export.

## Language

- **Everything in this repository is in English**: code, comments, UI text, documentation and commit messages.
  I keep it that way when adding or changing anything, even when the conversation around the work is in Spanish.

## Where my documents live

- `documents/templates/` — **templates**: my base CVs (self-contained HTML, styles inside `<style>`). Every new page
  starts from one. Changing a template doesn't change the pages already made from it.
- `documents/pages/` — **pages**: one CV per job application ("+ Add page", or "Save as page…"). Each page records
  its template in `<meta name="cv-template" content="Template name">` (shown in the sidebar and on the board;
  renaming a template updates its pages). A page created by hand needs that meta too.
- `documents/.history/<kind>/<name>/` — every version of every template and page. The server copies a document
  whenever it changes on disk, whoever writes it, and before each save (200 versions kept per document). To bring
  back an older version, I copy it over the page.
- `documents/pdf/` — exported PDFs (A4, generated with Chrome via puppeteer-core).
- `templates/blank.html` (in the repo, not in `documents/`) — the **blank layout**: two columns, generic sample text,
  no personal data, so it *is* pushed. The "+" next to Templates can start a new template from it.

## CV structure: free-form layout (frames, shapes and styles)

My CVs use an InDesign/Canva-style free-form layout on a fixed A4 page (`.page`, 210 × 297 mm = 794 × 1123 px):

- **Frame** = `.page > .frame` (usually `<section class="frame">`) with an inline absolute position:
  `style="left: 40px; top: 129px; width: 516px;"`. Its height comes from its content (plus an optional
  `min-height` when its bottom edge has been dragged down). Main column: x 40, width 516;
  side column: x 606, width 166; standard spacing between frames: 16 px.
- **Shape** = `.page > .shape` with `left/top/width/height/background` (grey side stripe, header rule…).
  Shapes come before the frames in the HTML, so they sit behind them.
- **Regions & margins** = the side stripe (`.shape[data-role="sidebar"]`) and the header rule (`.shape[data-role="rule"]`)
  split the page into four regions: `header-left`, `header-right`, `main`, `side`. Each has its own margins, stored on
  the page as `data-margins="header-left 28 19 40 28; …"` (top bottom left right, px). The editor shows them as
  violet guides and frames snap to them; changing a margin in the inspector moves the frames sitting on it.
  Frames added or moved by hand stay inside their region's margins.
- **Item** = `<div class="item">` inside a frame: a job (`.job-head` + `ul`/`p`), a project (`h3` + `ul`), a
  degree… Items are the blocks of the Blocks panel (reorder, hide, move between sections); new entries go in one.
  **Skills and Languages are plain text, not items**, because they change with every job ad: Skills is `h3` + `p`
  pairs straight in the frame, Languages is `p` lines. They stay that way.
- **Text styles** = variables in `<style id="cv-text-styles">` (`--<style>-font|size|weight|style|case|spacing|leading|color|before|after`).
  Styles: `name` (h1), `role` (.role), `section` (h2), `subheading` (h3, .job-head), `body` (p, li),
  `detail` (.detail, .where, .meta) and `note` (.note). To change the typography of a whole document, I change
  these variables, not the rules. `spacing` (letter spacing) is stored in `em` and shown in the editor in Canva
  units (thousandths of an em: `0.05em` = 50); `leading` (line spacing) is a unitless multiplier, as in Canva.
  Fonts are loaded with `<link id="cv-fonts">` (the editor regenerates it). Fonts marked `system: true` in
  `src/styles.js` (e.g. Georgia Pro → Georgia) aren't on Google Fonts and come from the computer, so they are left
  out of that link.
- To convert an old flow CV (`main`/`aside`) to this format: `node backups/convert-free.mjs <input> <output>`.

## A4 format

- Every CV fits on **a single A4 page**: no frame goes past `top + height > 1123 px` or overlaps another.
  After editing text, the frames below get repositioned (or I export the PDF and check it). The editor's status bar
  warns about frames outside the page or overlapping.

## Working on my CVs

- **My manual edits come first.** I often fine-tune a page in the editor. When I ask for a change to one section,
  only that section changes: everything else on the page stays exactly as I left it, and a page is never
  regenerated from an earlier draft. Improvements outside what I asked for are proposed, not applied.
- Before a page is edited on disk, I save it in the editor, and the file is re-read right before the edit. If the
  editor has unsaved changes when the file changes on disk, it shows a banner ("Reload" / "Ignore") instead of
  reloading; with no unsaved changes, it reloads the document by itself.
- Changing the app's code (`src/`, `server/`) makes Vite reload the editor, so I save my work first.
- Pages are edited directly in their `.html`, keeping the existing structure and classes (`.frame`, `.item`,
  `.job-head`, `.where`, `.note`, `h2 .meta`…) so the design and the A4 print layout don't break.
- A new version of a CV (e.g. for a job offer) is a new page in `documents/pages/`, made from the template; the
  template itself stays untouched.
- A new template from scratch starts from `templates/blank.html` and is saved in `documents/templates/`.
- PDF from the terminal: `npm run pdf -- documents/pages/<file>.html` (output goes to `documents/pdf/`).
- **Source of truth for content:** `../ilenia/` (outside this repo, private). It starts with `../ilenia/README.md`,
  which indexes the chapters and sets my rules: honesty about personal vs team work, confidence markers, and
  `timeline.md` wins on dates. `../ilenia/_archive/` holds older documents that are no longer used.
- **Job ads:** saved as `../jobs/<company-role>.md` (outside this repo, private). A page is linked to its ad with
  `<meta name="cv-job" content="<file>.md">` (added by hand when creating the page); the app then shows
  "View job ad".
- **Job brief:** above a page linked to an ad, the board shows a screen-only card (never printed or exported),
  rendered from the ad's Markdown by `src/jobbrief.js`: the `# title`, the `- **Key:** value` meta lines, then each
  `## ` section. It is two A4-wide cards side by side above the page (which sits centered below), at the CV's type
  sizes and zooming with it: the ad on the left, `## Fit` on the right (`### Have` / `### Partly` / `### Missing` as
  coloured blocks with a count bar). A line `a · b · c` becomes chips; `## Job ad (as pasted)` and
  `## Tailoring notes` are folded away.

## Tailoring a page to a job ad ("tailor the page X")

1. Open `documents/pages/X.html`. Its `cv-job` meta points to the ad in `../jobs/`; `cv-template` to its template.
2. Read `../ilenia/README.md` and the chapters that matter for the ad, respecting each project file's
   "safe / not safe to claim" sections. For wording, check the CVs I've already sent for the same track in
   `../ilenia/_sources/cvs-sent/` (its README first: the early ones overstate the Snowflake project).
3. From the ad, list the must-haves, nice-to-haves, keywords, seniority and domain.
4. Edit only the content of the page, keeping its structure and classes:
   - subtitle (`.role`) and **Professional Summary**: rewritten for this role;
   - **Experience**: bullets reordered and reworded toward the ad's keywords, only where true;
   - **Selected Projects**: ordered by relevance; the least relevant hidden with the `hidden` attribute (never deleted);
   - **Skills** (plain text): regrouped and reordered to mirror the ad, only with skills the chapters support.
5. Nothing goes on a CV that isn't in `../ilenia/`: no invented skills, tools or results. The distinction between
   built / contributed / participated stays, and internal notes (names, mentors, personal life) never appear.
6. Keep **one A4 page**: no frame past its region's bottom margin, no overlaps (each column restacked with 16 px
   gaps if heights changed). Checked with headless Chrome or `npm run pdf -- documents/pages/X.html`.
7. In the job file, set `Status: tailored (YYYY-MM-DD)` and, before `## Job ad (as pasted)`, write the brief:
   `## At a glance` (a short plain-language synthesis + key bullets), `## What they ask for` (`### Must-haves`,
   `### What the days look like`, `### Keywords` as one `a · b · c` line) and `## Fit` (`### Have` / `### Partly` /
   `### Missing`, each bullet `**requirement:** evidence from ../ilenia/`). After the ad, a short "Tailoring notes"
   section: what was emphasised, what was hidden, and the honest gaps, which I want to hear about directly.

## Personal data

- My personal data (email, phone, etc.) is in `ilenia.md`, which is in `.gitignore`.
  **This repository is public:** that data never goes into `CLAUDE.md` or any other file that gets pushed.

## Git

- Repository: https://github.com/ileniamoca/CV-designer.git (branch `main`).
- **Every substantial change is committed and pushed to `main`** (`git add … && git commit && git push origin main`)
  with a descriptive message. Trivial tweaks can be grouped into the next commit.

## Code

- `server/cv-api.js` — Vite plugin with the local API (`/api/docs` list, `/api/docs/:kind/:name` read/save/delete,
  `POST /api/docs/:kind` create a page or template, `/api/pdf`, `/api/events` SSE). It keeps the version history in
  `documents/.history/`, watches `../jobs/`, and moves the old `documents/originals` and `documents/copies` folders
  into `templates` and `pages` on startup.
- `server/pdf.js` — HTML → PDF with the installed Chrome/Brave.
- `src/main.js` — the editor: the CV is loaded in an iframe with `body.contentEditable`; whatever the editor injects
  carries `data-cv-editor` (and `cv-*` classes) and is removed on save.
- `src/board.js` — the board: the document being edited, alone and centered on a pasteboard (trackpad pan, pinch
  zoom). Clicking a page in the sidebar loads just that page; clicking a template opens template mode (main.js),
  where it's edited until "Save & close" or "Discard". Leaving a page with unsaved changes saves it. A sheet is only
  moved in the DOM when it's out of place, since moving an iframe reloads it.
- `src/canvas.js` — free-form layout, Canva-style: a click selects a frame/shape as an object (drag or arrow keys
  to move); drag on an empty area = selection box, ⇧+click adds/removes, ⌘A selects all, and several objects
  move/align/delete together; double-click or Enter edits a frame's text (only that frame is `contentEditable`,
  so text is never selected otherwise), Esc goes back; resize by dragging any edge or corner (invisible strips,
  no buttons), ⌘C/⌘X/⌘V copy objects; snapping and smart guides (Canva/InDesign-style alignment lines), keyboard,
  pushing frames down as text grows, overlap warnings, alignment, adding elements.
- `src/blocks.js` — items (.item), the sub-blocks of a frame: selected with a second click inside a selected frame
  (canvas.js), dragged within or between frames or into a new frame, duplicated, hidden; plus the
  shared undo history (body + styles).
- `src/jobbrief.js` — the job brief above a page linked to a job ad (Markdown of `../jobs/<file>.md` → HTML cards).
- `src/library.js` — blocks: every `.item` gets a stable `data-item` id; the Blocks panel shows each section's
  items with a checkbox (unticked = `hidden` attribute: kept in place, not shown or printed), reorders them and
  moves them between sections.
- `src/margins.js` — regions and margins: read/write `data-margins`, guides, adjusting frames when a margin changes.
- `src/themes.js` + `src/ui-styles.css` — editor UI looks (never the CV): 31 styles (Cute, Claymorphism, Cybercore,
  Neo-Brutalism…, plus Swiss & Editorial variations, set as `<html data-style>`), and for "Cute" the colour palettes
  (CSS variables of `src/style.css`, which exposes hooks such as `--btn-*`, `--panel-*`, `--desk-image`,
  `--font-display`). Picked in the 🎨 bubble.
- `src/styles.js` — text styles: read/write the variables, apply a style to a paragraph, font catalogue.
- Start: `npm run dev` → http://localhost:5180
