# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

- Single-page web app, **one self-contained HTML file** (currently `Macro_Tracker_Interactive-32.html`) containing inline CSS + HTML + vanilla JS. No framework, no bundler.
- **External resources** (whitelisted in the CSP meta tag at `<head>`):
  - `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` — **lazy-loaded** via `loadScript(CDN.xlsx)` on first Export-Excel or Import-Excel click (no longer fetched at startup).
  - `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` + `https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js` — **lazy-loaded** in sequence on first Export-PDF click.
  - Google Fonts: `Fraunces`, `JetBrains Mono`, `IBM Plex Sans Arabic` via `fonts.googleapis.com` + `fonts.gstatic.com` (eager, `font-display:swap`).
- **User-triggered runtime call:** Gemini API (`gemini-2.5-flash` at `generativelanguage.googleapis.com`) for OCR. Only fires when the user explicitly runs the photo-extraction flow.
- Companion data file: `food_database-7.json` is the canonical food database. Users load it via the in-app "⬆ Restore JSON" button; it lands in `localStorage['mt-db']` and shadows the small sample `DB` array hard-coded in the HTML.
- Filenames are version-suffixed (`-32`, `-7`). Bumping the suffix is the release mechanism. Edit the existing numbered file in place; only bump when explicitly asked.

## Run / debug

There is no build, no lint, no test suite.

- Run: open the HTML file directly in a browser, or serve the directory (`python3 -m http.server`) and load it.
- For UI changes, exercise the affected feature in a real browser — that is the only feedback loop available.
- Reset app state: `localStorage.clear()` in DevTools on the file's origin, or use the in-app reset actions.
- **Smoke test for script-region edits:** after any change to the main `<script>` block, run: `node -e "const m=require('fs').readFileSync('Macro_Tracker_Interactive-32.html','utf8').match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)||[];const main=m.filter(s=>!/\ssrc=/.test(s)).pop();new Function(main.replace(/^<script[^>]*>|<\/script>$/g,''));console.log('OK')"`. Takes ~3 seconds. Catches syntax errors and orphaned content before commit. (Picks the last inline `<script>` block — the main one — skipping CDN `<script src="…">` tags, and tolerates attributes like `defer`/`nonce`.)

## Code organization inside the HTML

The single `<script>` block (starts ~line 2787) is divided by banner comments. Search for these to navigate:

```
// ============ DATABASE ============              sample DB array (overridden by mt-db on load)
// ============ CATEGORIES ============            cat key → bilingual label map; foods with an unknown cat won't render
// ============ STATE ============                 localStorage hydration
// ============ RENDER TABLES ============
// ============ POPUP ============                 add/edit item modal (+ in-popup macro edit)
// ============ TOTALS ============                daily totals + progress bars
// ============ DAY CONTROLS ============
// ============ GOALS ============
// ============ SEARCH & FILTER ============
// ============ SIDE PANEL ============
// ============ DATA EXPORT / IMPORT ============  food DB CSV/JSON
// ============ ADD FOOD ============              manual entry + recipe builder
// ============ THEME & COLOR SCHEME ============
// ============ JSON EXPORT / IMPORT ============  full backup (all mt-* keys)
// ============ LANGUAGE TOGGLE ============
// ============ INIT ============                  top-level calls run on load
// ============ OCR (PHOTO EXTRACTION) ============ Gemini integration
// ============ LIVE CALORIE-MISMATCH CHECK ============
```

CSS uses the same `/* ============ NAME ============ */` banner convention (starts ~line 49). Color schemes are CSS-variable-driven and selectable via `data-scheme` on `<html>`.

## Food item schema

The hard-coded `DB` array, the imported `food_database-7.json`, and individual day items all share this shape:

```
{ id, cat, en, ar, base, basis:{en,ar}, easy:{en,ar}?, p, f, c, kcal, badges[], units?:[{en,ar,g}] }
```

- `base` — grams the listed macros refer to (e.g. 100 for "per 100 g raw"; 50 for "per 1 egg").
- `basis` — bilingual display label describing `base`.
- `p` / `f` / `c` / `kcal` — macros **per `base` grams**, not per 100 g. The renderer scales them based on the per-category display mode (`g100` | `base` | `easy`).
- `units` — optional easy-portion presets used by the "Easy" tab and recipe builder.
- `cat` — must match a `cat` key in the `CATEGORIES` array; unknown categories silently skip rendering.

## State (localStorage keys)

All keys are `mt-`-prefixed: `mt-db`, `mt-day`, `mt-saved`, `mt-goals`, `mt-lang`, `mt-theme`, `mt-scheme`, `mt-display-modes`, `mt-smart-sort`, `mt-settings-open`, `mt-gemini-key`.

- `lsGet(key, fallback)` (in the STATE section) is the safe JSON-read helper — use it for any new key so a corrupt value can't crash startup.
- The sample `DB` array is overwritten on load if `mt-db` is present. New seed data must go through the JSON import path, not by editing the hard-coded `DB`.
- The full-backup export/import writes/reads every `mt-*` key listed above; new persistent keys should be added to both ends.

## Conventions

- Every user-supplied or imported string passed through `innerHTML` must go through `escapeHtml()` — it is the project's XSS guard.
- All UI strings are bilingual. Static markup uses `data-en` / `data-ar` attributes resolved by `applyLanguage()`; dynamic strings use `lang === 'ar' ? '…' : '…'`. New UI must supply both.
- Numeric macro display goes through `fmt()` (rounds to 1 decimal).
- Theme/scheme is applied via `<html data-theme="…" data-scheme="…">` set pre-paint by the inline `<script>` at the top of `<head>`. Keep that block dependency-free — it runs before everything else.
- The Gemini API key (`mt-gemini-key`) is user-supplied at runtime via the Settings panel. Never hard-code one.

## Architecture deep-dive

For models other than Opus, treat this section as the map you need before touching any feature.

### Boot sequence (in order)
1. **Pre-paint inline `<script>` in `<head>`** (`:5-28`) — reads `mt-scheme` and `mt-theme` from `localStorage` and sets `data-scheme` + `data-theme` on `<html>` before first paint. Has its own try/catch with safe defaults. **Must stay dependency-free** (no references to functions defined later).
2. **DOM body parses.** All UI shells render with `data-en`/`data-ar` attributes still in their default-EN text content.
3. **Main `<script>` at `:2787`:**
   - `DB` declared (sample array).
   - `CATEGORIES` declared.
   - STATE section: `lsGet` defined → `lang/goals/dayItems/savedDays/currentFood/editingIndex/activeTab` hydrated → `mt-db` reads to override the sample `DB`.
   - All renderer + handler functions declared.
   - INIT block at `:5833` calls `applyTheme(); renderGoals(); applyLanguage(); saveDayState();` in that order.
   - `applyLanguage()` is the master re-render: it walks every `[data-en]/[data-ar]` element, sets `document.dir`, then calls `renderTables()`, `applyFilters()`, `renderTotals()`. **Any code path that wants a full UI refresh calls `applyLanguage()`**, not the individual renderers.
4. Global menu / settings-collapse / API-key-status / OCR handlers wire up.
5. `renderTotals()` final call at end of file.

### Render flow & re-render triggers
- `renderTables()` rebuilds **every category section** from scratch into innerHTML. Triggered by: language change, full restore, DB import/edit, item add/delete/recipe save.
- `applyFilters()` runs in-DOM (toggles `.hidden` on rows + sections). Triggered by: search input, category filter button. Does **not** re-render — it relies on data-attributes baked in by `renderTables()`.
- `renderTotals()` rewrites the totals table tbody/tfoot + drives `updateProgress()` bars. Triggered after any change to `dayItems` or `goals`.
- `renderGoals()` paints the four target values in the goals bar.
- `renderOcrResult()` paints the OCR result preview inside the modal.

Whenever `dayItems` mutates → call `saveDayState()` (persists to `mt-day`) **and** `renderTotals()`. Whenever `DB` mutates → write `mt-db` **and** call `renderTables()`.

### Display modes (per-category)
`displayModes[catFilter]` ∈ `{ 'g100' | 'base' | 'easy' }`, persisted to `mt-display-modes`.
- `g100` — divide macros by `base/100` so all foods compare per 100 g.
- `base` — show macros as-is (per the food's native `base`).
- `easy` — scale to `units[0].g`; falls back to `g100` if the item has no `units`.
The cycle button steps `g100 → base → easy → g100`. Helper: `nextDisplayMode()`, `modeForCat()`, `scaleFor(f)`.

### Smart sort
`smartSortState[catFilter]` ∈ preset id (e.g. `p-high`, `p-vs-c`, `kcal-low`) or `null`. Persisted to `mt-smart-sort`. Presets defined in `PRESET_MENU_ITEMS` and applied by `applyPresetScore()` over the per-category food list.

### Popup state machine
`currentFood` + `editingIndex` drive the add/edit popup at `openPopup()`:
- `editingIndex < 0` → adding a new day-item from the food row.
- `editingIndex >= 0` → editing `dayItems[editingIndex]`; macros can be overridden in-popup (sets a per-base override that survives only in `dayItems[i]`, not back to the DB).

### Recipe builder (composite items)
- `recipePicked: [{id, qty, unitG, unitLabel}]` is the in-progress recipe. `recipeTotals()` sums macros across picks (scaled by `qty * unitG / base`). Save commits a new DB item with the computed per-100g macros — i.e. recipes become first-class foods in `DB`.

### OCR pipeline (Gemini)
`openOcrModal()` → file picker → `FileReader` → base64 in `ocrImageBase64`/`ocrImageMime` → `callGeminiOCR()` POSTs to `gemini-2.5-flash`'s `:generateContent` with `OCR_PROMPT` and `responseMimeType: 'application/json'` + `thinkingBudget: 0`. Response shape is fixed by the prompt (`kcal/protein/fat/carbs/serving_size/base_unit/name_en/name_ar/confidence/notes/warnings`). `ocrSanityCheck()` validates that `P×4 + F×9 + C×4` is within 15 % of `kcal` and tags `ok/warning/error`. `renderOcrResult()` paints the modal's result step; `openAddFoodFromOCR()` pre-fills the Add-Food modal, scaling to per-100g if Gemini returned per-serving values.

### Bilingual UX rules
- Static text uses `data-en` + `data-ar` attributes; `applyLanguage()` reads them every time the language flips. Adding a new label means adding both.
- Dynamic text uses `lang === 'ar' ? 'ع' : 'en'` ternaries.
- `document.dir` is set from `lang`. CSS sectioned with `[dir="rtl"]` rules where direction matters (the smart-sort popover positioning, for instance, mirrors).
- Arabic search normalization (`normalizeSearch()`) strips tashkeel, normalizes hamza variants and `ى/ة` so users can type without diacritics.

### Trust boundaries (security)
1. **`localStorage` payloads** — treat as semi-trusted (user owns it, but a synced/imported backup may carry junk). Always escape on render. Use `lsGet` so corrupt JSON doesn't crash.
2. **Imported JSON** (DB restore, full backup) — untrusted. Today the validator is permissive; tighten when changing this path.
3. **Gemini API output** — untrusted. The image is attacker-controllable (anyone can photograph a label embedding a prompt-injection string telling the model to output HTML). Escape every field of the OCR response before any innerHTML write.

## Multi-model collaboration workflow (`*.local.*` files)

This repo uses three local-only files (gitignored via `*.local.*`) as an asynchronous review pipeline between Opus and a lighter executor model.

| File | Direction | Purpose |
|------|-----------|---------|
| `review.local.md` | Opus → executor | Per-commit reviews. Findings keyed `F-<sha>-NN` with severity + fix. Status checkboxes per finding; progress counter per review block. |
| `tasks.local.md` | Opus → executor | Actionable work items derived from findings or new asks. Each task cites its origin finding. Status (`todo/in-progress/blocked/done/cancelled`) + priority (`P0–P3`). Open/in-progress/done counters at top. |
| `questions.local.md` | Executor → Opus | Questions about a commit / finding / task. Opus answers in-place and flips status. |

**Rules:**
- Every entry in any of the three files **must carry a status field** and contribute to the file's progress counter at the top. Updating an entry means updating the counter.
- Cross-link aggressively: a task that resolves `F-ae19bb4-03` says so; a question about `T-002` says so. This is what lets either model jump in cold.
- When a finding flips to `[x]` done, the executor cites the commit SHA that fixed it in the finding line.
- Files are gitignored — they hold collaboration state, not shipped artifacts. Never commit them; never `git add -A` without checking that the `.local.` pattern is excluded.
- **Commit attribution:** use the user's name and email (`git -c user.name="abdullah-3337" -c user.email="abdullah.ayoub2000@gmail.com" commit ...`). Never add `Co-Authored-By:` or other trailers crediting Claude/Haiku/Opus. Commits are authored by the user; AI assistance is documented in the PR/MR, not in git history.
- **Cleanup policy:** once an entry's status becomes `done` / `shipped` / `cancelled` / `addressed` AND the relevant change has landed on `main`, delete the entry from its `.local.md` file. Git history (merge commits + commit messages) is the durable record. The `.local.md` files are a live work queue, not an archive.

## Working with this file (CLAUDE.md)

- **Length cap:** keep CLAUDE.md under 500 lines. The whole file is loaded into every Claude Code session — long files cost tokens on every turn. If a new section would push past 500, condense or rotate something out first.
- **Model split:** Opus is the planner and reviewer for this repo. When a change needs more than ~2 files of edits or a long mechanical pass (CSS-variable migrations, multi-section rewrites, refactors that touch dozens of lines), Opus writes a detailed spec and spawns a Haiku agent (`Agent` tool, `subagent_type: "general-purpose"`, `model: "haiku"`) to execute. Opus stays in planning / review mode; Haiku does the typing.

### What NOT to do

- Don't split the HTML into separate JS/CSS files — single-file delivery is the intended design.
- Don't add a bundler, package manager, or test framework — incompatible with the ship model.
- Don't add NEW CDN dependencies at startup beyond the four already whitelisted (xlsx, jspdf, jspdf-autotable, Google Fonts). New runtime calls must be user-triggered, like the Gemini OCR call. Any new endpoint also requires a CSP update at line 5 of the HTML, or the browser will silently block it.
- Don't commit `*.local.*` files. They are the collaboration scratchpad.
- Don't mutate `DB` or `dayItems` without firing the corresponding persistence + re-render pair noted above.
