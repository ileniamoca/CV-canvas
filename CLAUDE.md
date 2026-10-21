# CV-canvas

CV-canvas is a local tool (Vite) for designing and editing CVs the way one would in Word or Canva. It works with
templates, keeps one page per job application, and exports each page to PDF.

## Language

- **The repository is written entirely in English**: code, comments, UI text, documentation and commit messages.
  This applies to every addition or change, regardless of the language used to discuss the work.

## Documents

- `documents/templates/` — **templates**: the base CVs (self-contained HTML, styles inside `<style>`). Every new page
  starts from a template. Changing a template does not affect the pages already made from it.
- `documents/pages/` — **pages**: one CV per job application ("+ Add page", or "Save as page…"). Each page records
  its template in `<meta name="cv-template" content="Template name">` (shown in the sidebar and on the board;
  renaming a template updates its pages). Pages created by hand need this meta as well.
- **Cover letters** are pages too, linked to their CV page with `<meta name="cv-cover-for" content="CV page.html">`
  (plus the same `cv-template` and `cv-job` metas), named `<CV page> – Cover letter.html`. Layout: the CV's text
  styles (with `--body-size: 8.5pt`, `--body-leading: 1.5`, `--body-after: 10pt` for reading), no side stripe, a
  single column with wide margins (header frame at x 86, top 64, width 622: name, `.role` as
  "<strong>COVER LETTER</strong> · ROLE, COMPANY" on a single line (shorten the role if it wraps, or the contact
  line runs into the rule), and a `.contact-line` with city, phone and email; the header rule at
  top 166 across the page; the letter frame at x 86, top 214, width 622). The letter opens with a bold greeting and
  ends with "Kind regards,", the handwritten signature (`<p class="signature"><img src="data:image/png;base64,…">`,
  embedded from `documents/assets/signature.png`, which is private) and the first name in bold. Without a side
  stripe, the page has no margin regions. The sidebar shows them inside their CV page ("cover letter ✓"); opening either shows
  both side by side, and "Export PDF" asks which one to export (they are never exported together). Renaming the CV
  page updates the link.
- `documents/.history/<kind>/<name>/` — the version history of every template and page. The server stores a copy
  whenever a document changes on disk, whatever wrote it, and before each save (200 versions per document). An
  older version is restored by copying it over the page.
- `documents/pdf/` — exported PDFs (A4, generated with Chrome via puppeteer-core). "Export PDF" suggests the name
  `CV_<First>_<Surname>_<position>_<Company>` (e.g. `CV_Ilenia_Molina_product_analyst_AARK`): the name from the CV's
  h1, the position from its subtitle (before any "·"), the company from the linked job ad (`- **Short name:**` if
  present, otherwise `- **Company:**` without its legal form, reduced to the first word when longer than two words).
  A cover letter gets `CoverLetter_…` instead of `CV_…`. After a successful export, Finder opens `documents/pdf/`
  with the new PDF selected.
- `templates/blank.html` (in the repository, not in `documents/`) — the **blank layout**: two columns, generic sample
  text and no personal data, so it is pushed. The "+" next to Templates can start a new template from it.

## CV structure: free-form layout (frames, shapes and styles)

CVs use an InDesign/Canva-style free-form layout on a fixed A4 page (`.page`, 210 × 297 mm = 794 × 1123 px):

- **Frame** = `.page > .frame` (usually `<section class="frame">`) with an inline absolute position:
  `style="left: 40px; top: 129px; width: 516px;"`. Its height comes from its content (plus an optional
  `min-height` when its bottom edge has been dragged down). Main column: x 40, width 516;
  side column: x 606, width 166; standard spacing between frames: 16 px.
- **Shape** = `.page > .shape` with `left/top/width/height/background` (grey side stripe, header rule…).
  Shapes come before the frames in the HTML, so they sit behind them.
- **Regions & margins** = the side stripe (`.shape[data-role="sidebar"]`) and the header rule (`.shape[data-role="rule"]`)
  split the page into four regions: `header-left`, `header-right`, `main`, `side`. Each region has its own margins,
  stored on the page as `data-margins="header-left 28 19 40 28; …"` (top bottom left right, px). The editor shows
  them as violet guides and frames snap to them; changing a margin in the inspector moves the frames sitting on it.
  Frames added or moved by hand must stay inside their region's margins.
- **Item** = `<div class="item">` inside a frame: a job (`.job-head` + `ul`/`p`), a project (`h3` + `ul`), a
  degree… Items are the blocks of the Blocks panel (reorder, hide, move between sections); new entries go in one.
  **Skills and Languages are plain text, not items**, since they change with every job ad: Skills is `h3` + `p`
  pairs placed directly in the frame, Languages is `p` lines. Both keep this structure.
- **Text styles** = variables in `<style id="cv-text-styles">` (`--<style>-font|size|weight|style|case|spacing|leading|color|before|after`).
  Styles: `name` (h1), `role` (.role), `section` (h2), `subheading` (h3, .job-head), `body` (p, li),
  `detail` (.detail, .where, .meta) and `note` (.note). The typography of a whole document is changed through these
  variables, not the rules. `spacing` (letter spacing) is stored in `em` and shown in the editor in Canva units
  (thousandths of an em: `0.05em` = 50); `leading` (line spacing) is a unitless multiplier, as in Canva.
  Fonts are loaded with `<link id="cv-fonts">`, which the editor regenerates. Fonts marked `system: true` in
  `src/styles.js` (e.g. Georgia Pro → Georgia) are not on Google Fonts and come from the computer, so they are
  left out of that link.
- An old flow CV (`main`/`aside`) is converted to this format with `node backups/convert-free.mjs <input> <output>`.

## A4 format

- Every CV fits on **a single A4 page**: no frame may go past `top + height > 1123 px` or overlap another.
  When text changes, the frames below are repositioned (or the exported PDF is checked). The editor's status bar
  warns about frames outside the page or overlapping.

## Editing CVs

- **Manual edits take priority.** Pages are often fine-tuned by hand in the editor. A request to change one section
  changes only that section: the rest of the page stays exactly as it is, and a page is never regenerated from an
  earlier draft. Improvements outside the request are proposed, not applied.
- A page is saved in the editor before it is edited on disk, and the file is re-read right before the edit. If the
  editor has unsaved changes when the file changes on disk, it shows a banner ("Reload" / "Ignore") instead of
  reloading; without unsaved changes, it reloads the document automatically.
- Changes to the app's code (`src/`, `server/`) make Vite reload the editor, so open work is saved first.
- Pages are edited directly in their `.html`, keeping the existing structure and classes (`.frame`, `.item`,
  `.job-head`, `.where`, `.note`, `h2 .meta`…) so the design and the A4 print layout stay intact.
- A new version of a CV (e.g. for a job offer) is a new page in `documents/pages/`, made from a template; the
  template itself is not modified. The template matches the ad's track (e.g. `Analytics_Engineer` for analytics
  engineering roles, `Data_Analyst` for analyst roles).
- A new template from scratch starts from `templates/blank.html` and is saved in `documents/templates/`.
- PDF from the terminal: `npm run pdf -- documents/pages/<file>.html` (output in `documents/pdf/`).
- **Source of truth for content:** `../ilenia/` (outside this repository, private). The entry point is
  `../ilenia/README.md`, which indexes the chapters and sets the rules: honesty about personal vs team work,
  confidence markers, and `timeline.md` taking precedence on dates. `../ilenia/_archive/` holds superseded documents
  and is not used.
- **Job ads** are stored as `../jobs/<company-role>.md` (outside this repository, private). A page is linked to its
  ad with `<meta name="cv-job" content="<file>.md">`, added by hand when the page is created; the app then offers
  "View job ad", and the sidebar shows the ad's `- **Company:**` under the page title. Before the title, in one
  column, the sidebar shows an "applied" checkbox above the match score (`**Match: NN%**` from `## Fit`, coloured
  like the brief's verdict). Ticking it adds `- **Applied:** YYYY-MM-DD` to the ad's meta lines (`PATCH
  /api/jobs/:file`); unticking removes that line.
- **Job brief:** above a page linked to an ad, the board shows a screen-only card (never printed or exported),
  rendered from the ad's Markdown by `src/jobbrief.js`: the `# title`, the `- **Key:** value` meta lines, then each
  `## ` section. It consists of two A4-wide cards above the sheets, at the CV's type sizes and following its zoom:
  the ad on the left (above the CV), `## Fit` on the right (above the cover letter). In `## Fit`, a line
  `**Match: NN%** — why` becomes a score ring with a verdict (75+ worth applying, 50–74 a stretch, under 50 a low
  match), and `### Have` / `### Partly` / `### Missing` coloured blocks with a count bar. A line `a · b · c` becomes
  chips; `## Job ad (as pasted)` and `## Tailoring notes` are folded.

## Tailoring a page to a job ad ("tailor the page X")

**Every page made for a job ad always gets its cover letter**, whether the request was to tailor a page, create a
page or add a job: the steps below always run to the end, including step 8, even if the cover letter is not
mentioned. The model is the most recent cover letter in `documents/pages/`: it is copied (metas, styles, header,
signature, frame positions) and only the header's role and company and the letter's text change.

1. Open `documents/pages/X.html`. Its `cv-job` meta points to the ad in `../jobs/`; `cv-template` to its template.
2. Read `../ilenia/README.md` and the chapters relevant to the ad, respecting each project file's
   "safe / not safe to claim" sections. For wording, refer to the CVs already sent for the same track in
   `../ilenia/_sources/cvs-sent/` (its README first: the early ones overstate the Snowflake project).
3. From the ad, list the must-haves, nice-to-haves, keywords, seniority and domain.
4. Edit only the content of the page, keeping its structure and classes:
   - subtitle (`.role`) and **Professional Summary**: rewritten for the role;
   - **Experience**: bullets reordered and reworded toward the ad's keywords, only where accurate;
   - **Selected Projects**: ordered by relevance; the least relevant hidden with the `hidden` attribute, never deleted;
   - **Skills** (plain text): regrouped and reordered to mirror the ad, using only skills the chapters support.
5. Nothing appears on a CV that is not in `../ilenia/`: no added skills, tools or results. The distinction between
   built / contributed / participated is preserved, and internal notes (names, mentors, personal life) are excluded.
6. The page stays on **one A4 page**: no frame past its region's bottom margin, no overlaps (each column restacked
   with 16 px gaps when heights change). Verified with headless Chrome or `npm run pdf -- documents/pages/X.html`.
7. In the job file, set `Status: tailored (YYYY-MM-DD)` and, before `## Job ad (as pasted)`, write the brief:
   `## At a glance` (a short plain-language synthesis + key bullets), `## What they ask for` (`### Must-haves`,
   `### What the days look like`, `### Keywords` as one `a · b · c` line) and `## Fit` (`### Have` / `### Partly` /
   `### Missing`, each bullet `**requirement:** evidence from ../ilenia/`), opening `## Fit` with
   `**Match: NN%** — why`: an honest estimate weighted towards the must-haves, not a count of bullets. After the ad,
   add a short "Tailoring notes" section: what was emphasised, what was hidden, and the honest gaps, which are also
   reported directly in the conversation.
8. Always write the cover letter as `documents/pages/X – Cover letter.html` (see Cover letters above), on one A4 page:
   why this role → Livstories → one Hyper Island project in depth → honest gaps and what to learn → architecture as
   a problem-solving background → close. Same honesty rules as the CV; interests may be stated as interests.

## Personal data

- Personal data (email, phone, etc.) lives in `ilenia.md`, which is listed in `.gitignore`.
  **The repository is public:** this data is never copied into `CLAUDE.md` or any other pushed file.

## Git

- Repository: https://github.com/ileniamoca/CV-canvas.git (branch `main`).
- **Every substantial change is committed and pushed to `main`** (`git add … && git commit && git push origin main`)
  with a descriptive message. Minor tweaks can be grouped into the next commit.

## Code

- `server/cv-api.js` — Vite plugin with the local API (`/api/docs` list, `/api/docs/:kind/:name` read/save/delete,
  `POST /api/docs/:kind` create a page or template, `/api/pdf`, `/api/events` SSE). It also maintains the version
  history in `documents/.history/`, watches `../jobs/`, and on startup moves the legacy `documents/originals` and
  `documents/copies` folders into `templates` and `pages`.
- `server/pdf.js` — HTML → PDF with the installed Chrome/Brave.
- `src/main.js` — the editor: the CV is loaded in an iframe with `body.contentEditable`; everything the editor injects
  carries `data-cv-editor` (and `cv-*` classes) and is removed on save.
- `src/board.js` — the board: the document being edited (with its cover letter beside it) on a pasteboard,
  below the job brief (trackpad pan, pinch zoom). Clicking a page in the sidebar loads only that page; clicking a template opens template mode (main.js),
  where it is edited until "Save & close" or "Discard". Leaving a page with unsaved changes saves it. A sheet is
  moved in the DOM only when it is out of place, since moving an iframe reloads it.
- `src/canvas.js` — free-form layout, Canva-style: a click selects a frame/shape as an object (drag or arrow keys
  to move); dragging on an empty area draws a selection box, ⇧+click adds/removes, ⌘A selects all, and several
  objects move/align/delete together; double-click or Enter edits a frame's text (only that frame is
  `contentEditable`, so text is never selected otherwise), Esc goes back; any edge or corner resizes (invisible
  strips, no buttons), ⌘C/⌘X/⌘V copy objects; snapping and smart guides (Canva/InDesign-style alignment lines),
  keyboard control, frames pushed down as text grows, overlap warnings, alignment, adding elements.
- `src/blocks.js` — items (.item), the sub-blocks of a frame: selected with a second click inside a selected frame
  (canvas.js), dragged within or between frames or into a new frame, duplicated, hidden; plus the shared undo
  history (body + styles).
- `src/jobbrief.js` — the job brief above a page linked to a job ad (Markdown of `../jobs/<file>.md` → HTML cards).
- `src/library.js` — blocks: every `.item` gets a stable `data-item` id; the Blocks panel lists each section's
  items with a checkbox (unticked = `hidden` attribute: kept in place, not shown or printed), reorders them and
  moves them between sections.
- `src/margins.js` — regions and margins: reading/writing `data-margins`, guides, adjusting frames when a margin
  changes.
- `src/themes.js` + `src/ui-styles.css` — editor UI looks (never the CV): 31 styles (Cute, Claymorphism, Cybercore,
  Neo-Brutalism…, plus Swiss & Editorial variations, set as `<html data-style>`), and for "Cute" the colour palettes
  (CSS variables of `src/style.css`, which exposes hooks such as `--btn-*`, `--panel-*`, `--desk-image`,
  `--font-display`). Chosen in the 🎨 bubble.
- `src/styles.js` — text styles: reading/writing the variables, applying a style to a paragraph, font catalogue.
- Start: `npm run dev` → http://localhost:5180
