# CV Designer

Local tool (Vite) to edit Ilenia's CVs as if in Word/Canva: templates, one page per job application, PDF export.

## Language

- **Everything in this repository is written in English**: code, comments, UI text, documentation and commit
  messages. Keep it that way when adding or changing anything (talking to Ilenia in Spanish is fine).

## Where the documents live

- `documents/templates/` — **templates**: the base CVs (self-contained HTML, styles inside `<style>`) every new page
  starts from. Changing a template doesn't change pages already made from it.
- `documents/pages/` — **pages**: one CV per job application ("+ Add page", or "Save as page…"). Each page records
  its template in `<meta name="cv-template" content="Template name">` (shown in the sidebar and on the board;
  renaming a template updates its pages). When creating a page by hand, add that meta.
- `documents/pdf/` — exported PDFs (A4, generated with Chrome via puppeteer-core).
- `templates/blank.html` (in the repo, not in `documents/`) — the **blank layout** (two columns, generic sample
  text, no personal data; it *is* pushed). "+" next to Templates can start a new template from it.

## CV structure: free-form layout (frames, shapes and styles)

CVs use an InDesign/Canva-style free-form layout on a fixed A4 page (`.page`, 210 × 297 mm = 794 × 1123 px):

- **Frame** = `.page > .frame` (usually `<section class="frame">`) with an inline absolute position:
  `style="left: 40px; top: 129px; width: 516px;"`. Its height comes from its content (plus an optional
  `min-height` when its bottom edge has been dragged down). Main column: x 40, width 516;
  side column: x 606, width 166; standard spacing between frames: 16 px.
- **Shape** = `.page > .shape` with `left/top/width/height/background` (grey side stripe, header rule…).
  Shapes come before the frames in the HTML (so they sit behind them).
- **Regions & margins** = the side stripe (`.shape[data-role="sidebar"]`) and the header rule (`.shape[data-role="rule"]`)
  split the page into four regions: `header-left`, `header-right`, `main`, `side`. Each has its own margins, stored on
  the page as `data-margins="header-left 28 19 40 28; …"` (top bottom left right, px). The editor shows them as
  violet guides and frames snap to them; changing a margin in the inspector moves the frames sitting on it.
  When adding or moving frames by hand, keep them inside their region's margins.
- **Item** = `<div class="item">` inside a frame: a job (`.job-head` + `ul`/`p`), a project (`h3` + `ul`), a
  degree… Items are the blocks of the Blocks panel (reorder, hide, move between sections); wrap new entries in one.
  **Skills and Languages are plain text, not items** (they change with every job ad): Skills is `h3` + `p` pairs
  straight in the frame, Languages is `p` lines. Keep them that way.
- **Text styles** = variables in `<style id="cv-text-styles">` (`--<style>-font|size|weight|style|case|spacing|leading|color|before|after`).
  Styles: `name` (h1), `role` (.role), `section` (h2), `subheading` (h3, .job-head), `body` (p, li),
  `detail` (.detail, .where, .meta) and `note` (.note). To change the typography of the whole document, change
  these variables, not the rules. `spacing` (letter spacing) is stored in `em` and shown in the editor in Canva
  units (thousandths of an em: `0.05em` = 50); `leading` (line spacing) is a unitless multiplier, as in Canva. Fonts are loaded with `<link id="cv-fonts">` (the editor regenerates it).
  Fonts marked `system: true` in `src/styles.js` (e.g. Georgia Pro → Georgia) are not on Google Fonts and come
  from the computer, so they are left out of that link.
- To convert an old flow CV (`main`/`aside`) to this format: `node backups/convert-free.mjs <input> <output>`.

## A4 format

- Every CV must fit on **a single A4 page**: no frame may go past `top + height > 1123 px` or overlap another.
  After editing text, reposition the frames below (or export the PDF and check it). The editor's status bar
  warns about frames outside the page or overlapping.

## When Ilenia asks for changes to a CV

- Edit the corresponding `.html` directly with Edit. Keep the existing structure and classes
  (`.frame`, `.item`, `.job-head`, `.where`, `.note`, `h2 .meta`…) so the design and A4 print layout don't break.
- If she asks for a new version (e.g. tailored to a job offer), create a new page in `documents/pages/`
  from the template, instead of touching the template.
- If she asks for a new template from scratch, start from `templates/blank.html` and save it in `documents/templates/`.
- If the editor is open, it reloads the document by itself when it detects the change on disk (no need to say so).
- To generate the PDF from the terminal: `npm run pdf -- documents/pages/<file>.html`
  (output goes to `documents/pdf/`).
- **Source of truth for content:** `../ilenia/` (outside this repo, private). Start with `../ilenia/README.md`: it
  indexes the chapters and sets the rules (honesty about personal vs team work, confidence markers, `timeline.md`
  wins on dates). `../ilenia/_archive/` holds older documents; don't use them.
- **Job ads:** "+ From job ad" in the app saves the pasted ad as `../jobs/<company-role>.md` (outside this repo,
  private) and creates the page "Company – Role", linked to it with `<meta name="cv-job" content="<file>.md">`.

## When Ilenia asks to tailor a page ("tailor the page X")

1. Open `documents/pages/X.html`. Its `cv-job` meta points to the ad in `../jobs/`; `cv-template` to its template.
2. Read `../ilenia/README.md` and the chapters that matter for the ad (respect each project file's
   "safe / not safe to claim" sections).
3. From the ad, list must-haves, nice-to-haves, keywords, seniority and domain.
4. Edit only the content of the page, keeping its structure and classes:
   - subtitle (`.role`) and **Professional Summary**: rewrite for this role;
   - **Experience**: reorder and reword bullets toward the ad's keywords, only where true;
   - **Selected Projects**: order by relevance; hide the least relevant with the `hidden` attribute (don't delete);
   - **Skills** (plain text): regroup and reorder to mirror the ad, only skills the chapters support.
5. Never add skills, tools or results that aren't in `../ilenia/`; keep built / contributed / participated;
   no internal notes (names, mentors, personal life).
6. Keep **one A4 page**: no frame past its region's bottom margin, no overlaps (restack each column with 16 px
   gaps if heights changed). Check with headless Chrome or `npm run pdf -- documents/pages/X.html`.
7. In the job file set `Status: tailored (YYYY-MM-DD)` and add a short "Tailoring notes" section: what was
   emphasised, what was hidden, and honest gaps vs the requirements. Tell Ilenia the gaps.

## Personal data

- Ilenia's personal data (email, phone, etc.) is in `ilenia.md`, which is in `.gitignore`.
  **The repo is public:** never copy that data into `CLAUDE.md` or any other file that gets pushed.

## Git

- Repository: https://github.com/ileniamoca/CV-designer.git (branch `main`).
- **After every substantial change, commit and push to `main`** (`git add … && git commit && git push origin main`)
  with a descriptive message. Trivial tweaks can be grouped into the next commit.

## Code

- `server/cv-api.js` — Vite plugin with the local API (`/api/docs` list, `/api/docs/:kind/:name` read/save/delete,
  `POST /api/docs/:kind` create a page or template, `/api/pdf`, `/api/events` SSE). Moves the old
  `documents/originals` and `documents/copies` folders into `templates` and `pages` on startup.
- `server/pdf.js` — HTML → PDF with the installed Chrome/Brave.
- `src/main.js` — editor: the CV is loaded in an iframe with `body.contentEditable`; whatever the editor injects
  carries `data-cv-editor` (and `cv-*` classes) and is removed on save.
- `src/board.js` — the board: all pages side by side on a pasteboard (trackpad pan, pinch zoom). Templates aren't
  on it: clicking one opens template mode (main.js), where it's edited alone until "Save & close" or "Discard";
  the active sheet's iframe is the document being edited, the others are live previews; clicking a page
  glides the view to it. Leaving a sheet with unsaved changes saves it.
- `src/canvas.js` — free-form layout, Canva-style: a click selects a frame/shape as an object (drag or arrow keys
  to move); drag on an empty area = selection box, ⇧+click adds/removes, ⌘A selects all, and several objects
  move/align/delete together; double-click or Enter edits a frame's text (only that frame is `contentEditable`,
  so text is never selected otherwise), Esc goes back;
  resize by dragging any edge or corner (invisible strips, no buttons), ⌘C/⌘X/⌘V copy objects;
  move/resize frames and shapes, snapping and smart guides (Canva/InDesign-style alignment lines), keyboard,
  pushing frames down as text grows, overlap warnings, alignment, adding elements.
- `src/blocks.js` — items (.item), the sub-blocks of a frame: selected with a second click inside a selected frame
  (canvas.js), dragged within or between frames or into a new frame, duplicated, hidden; plus the
  shared undo history (body + styles).
- `src/library.js` — blocks: every `.item` gets a stable `data-item` id; the Blocks panel shows each section's
  items with a checkbox (unticked = `hidden` attribute: kept in place, not shown or printed), reorders them and
  moves them between sections.
- `src/margins.js` — regions and margins: read/write `data-margins`, guides, adjusting frames when a margin changes.
- `src/themes.js` — editor UI themes, all in the same style (Quicksand, rounded, pastel gradient) with warm peachy
  different palettes (CSS variables of `src/style.css`); the 🎨 bubble is a temporary picker.
- `src/styles.js` — text styles: read/write the variables, apply a style to a paragraph, font catalog.
- Start: `npm run dev` → http://localhost:5180
