# Daily Macro Tracker · جدول الأكل اليومي

A single-file, offline-first daily macro and calorie tracker. Open one HTML file in a browser — that's the entire app. Bilingual English/Arabic with full RTL support.

> No build, no install, no account. Your food log lives in your browser's `localStorage` and never leaves your device, except when *you* click the OCR button.

**Live source:** [`index.html`](./index.html) · ~9,000 lines of inline HTML/CSS/JS.

---

## Features

### Daily tracking
- **Per-category food tables** (Meat & Poultry · Fish · Eggs & Dairy · Legumes · Grains · Fruit · Vegetables · Fats · Sweets · ...).
- **Three display modes per category**, cycled with one tap: per-100 g · per native portion (e.g. per egg, per slice) · per "easy" portion (`½ cup`, `1 handful`).
- **Smart sort presets** per category — sort by protein density, kcal-low, protein-vs-carbs ratio, and more.
- **Daily totals + progress bars** for kcal, protein, fat, carbs, against editable goals.
- **Save day** to history (up to 60 days), reload any past day with one click.

### Food database
- Comes with a [`food_database-7.json`](./food_database-7.json) of ~200 foods (~123 KB). Load it once via **⬆ Restore JSON** in the side panel.
- **Add Food** modal — manual entry with bilingual labels, optional easy-portion presets, optional badges (e.g. iron, calcium).
- **Recipe builder** — combine existing foods into a new composite food. Recipes become first-class entries in the DB.
- **Edit / delete** any food. Macro overrides on a single day-item (e.g. you ate a 240 g chicken breast that turned out leaner than the DB entry) survive only on that day-item, not back to the DB.

### OCR (photo extraction)
- Tap **📸 OCR**, pick a photo of a nutrition label, and the app sends it to Gemini 2.5 Flash to extract `kcal / protein / fat / carbs / serving_size / base_unit / name` as structured JSON.
- The result feeds into the Add-Food modal, scaled to per-100 g.
- A live calorie-mismatch sanity check (`P×4 + F×9 + C×4` within 15% of `kcal`) flags inconsistent labels.
- **You supply the Gemini key** at runtime via the Settings panel. The key is stored in `localStorage`. It is never sent anywhere except to `generativelanguage.googleapis.com` in the `x-goog-api-key` header.

### Export / import
- **Excel** export and import (.xlsx, via `xlsx 0.18.5`).
- **PDF** export (via `jspdf 2.5.1` + `jspdf-autotable 3.8.2`).
- **JSON backup** — full export/import of every `mt-*` localStorage key (DB, day, saved history, goals, theme, scheme, language).
- **DB-only JSON** export/import for sharing the food database alone.

### UX
- **Light / Dark / System** theme.
- **7 color schemes** (default, ocean, peach, vivid, stone, slate, mono), applied via CSS variables.
- **Language toggle** (EN ⇄ AR), with full RTL mirroring and Arabic-aware search (tashkeel-stripped, hamza/ى/ة normalized).
- **Installable as a PWA** via the inline manifest — add to Home Screen on iOS/Android.

### Privacy
- Everything is stored locally in `localStorage`. There is no backend, no analytics, no telemetry.
- The only network calls are:
  1. Three CDN script loads at startup (xlsx, jspdf, jspdf-autotable) and Google Fonts.
  2. One Gemini API call per OCR run, only when the user explicitly triggers it.
- A `Content-Security-Policy` meta tag at the top of the HTML pins these endpoints; no other connect/script/style origins are allowed.

---

## Quick start

```bash
git clone https://github.com/abdullah-3337/Macro_Tracker_Interactive.git
cd Macro_Tracker_Interactive
# Open directly:
xdg-open index.html      # Linux
open index.html          # macOS
# Or serve:
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```

First run shows 11 sample foods. To load the full catalog, open the side panel → **⬆ Restore JSON** → pick `food_database-7.json`.

To use OCR, open Settings, paste a Gemini API key (get one at `aistudio.google.com`), save.

### Reset state
DevTools → Console → `localStorage.clear()` → reload. Or use **🗑 Clear day** / the in-app reset actions.

---

## File overview

| Path | Purpose |
|------|---------|
| `index.html` | The whole app: inline HTML + CSS + JS. |
| `food_database-7.json` | Seed food catalog. Load via the Restore JSON button. |
| `CLAUDE.md` | Architecture map, conventions, and `*.local.*` collaboration workflow for AI-assisted edits. |
| `.gitignore` | Excludes `*.local.*` collaboration files. |

Filenames are version-suffixed (`-32`, `-7`). Bumping the suffix is the release mechanism.

---

## Tech stack

- **Vanilla JavaScript.** No framework, no bundler, no test runner. The whole script is one `<script>` block, sectioned with `// ============ NAME ============` banners.
- **CSS variables** drive themes and color schemes; no preprocessor.
- **localStorage** for state — all keys prefixed `mt-`. See [State keys](#state-keys-localstorage) below.
- **External libraries at startup** (from cdnjs):
  - `xlsx@0.18.5` — Excel I/O
  - `jspdf@2.5.1` + `jspdf-autotable@3.8.2` — PDF export
  - Google Fonts: Fraunces, JetBrains Mono, IBM Plex Sans Arabic
- **Gemini 2.5 Flash** for nutrition-label OCR (user-triggered, user-keyed).

---

## Food-item schema

The hard-coded sample `DB`, `food_database-7.json`, and per-day items all share:

```js
{
  id,                          // unique slug, e.g. "chick-breast"
  cat,                         // category key, must match CATEGORIES
  en, ar,                      // bilingual name
  base,                        // grams the listed macros refer to
  basis: { en, ar },           // display label for `base`
  easy: { en, ar },            // optional "easy" portion label
  p, f, c, kcal,               // macros per `base` grams (not per 100 g)
  badges: [...],               // optional flags: "iron", "calcium", ...
  units: [ { en, ar, g } ]     // optional preset portions for the Easy tab
}
```

`base` is the most common pitfall. Macros are **per `base` grams**, not per 100 g. The renderer scales them when you switch display modes.

---

## Architecture

`index.html` is ~9,000 lines of inline HTML + CSS + JS. To make it navigable, the file is split into named sections marked by banner comments. Search for `// ============ NAME ============` (JS) or `/* ============ NAME ============ */` (CSS) to jump.

### File layout (top to bottom)

```
<head>
├─ CSP meta tag                          line 5     · whitelist for CDN + Gemini + OpenFoodFacts
├─ Pre-paint <script>                    line 5-28  · sets data-theme + data-scheme + lang on <html>
│                                                     BEFORE first paint. Dependency-free, has its own
│                                                     try/catch. Never reference functions defined later.
└─ Inline <style>                        line 49+   · all CSS, sectioned by /* ============ */ banners

<body>
├─ Header (cover)                        line 2944  · title + langToggle + themeToggle + settings
├─ Goals card                            line 2957  · daily kcal/P/F/C targets
├─ Totals card                           ~3000      · today's running totals + progress bars
├─ Floating search bar (dock)            line 3012  · #searchInput + category filter chips + FAB
├─ Food tables container                 ~3050      · category sections injected by renderTables()
├─ Empty-state message                   line 3074  · shown when no search matches
├─ Bottom dock                           ~3139      · #bottomDock with search + filters + FAB
├─ Popup overlay                         ~3200      · add/edit item modal
├─ Settings overlay (tabs)               line 3653  · Appearance / Features / Water / Reminders / API / Data
├─ Add-food modal                        ~3380      · manual entry + recipe builder
├─ OCR modal                             ~3520      · photo upload + Gemini result preview
├─ Side panel                            ~3600      · day controls, history, exports
└─ Inline main <script>                  line 3819+ · the entire app logic
```

### JS section map (inside the main `<script>`)

Search for `// ============ NAME ============`.

| Line | Section | What lives here |
|------|---------|-----------------|
| 3822 | DATABASE | Sample `DB` array (overridden by `mt-db` on load) |
| 4249 | CATEGORIES | `cat` key → bilingual label. Foods with an unknown cat silently skip. |
| 4337 | STATE | `lsGet` helper, all `localStorage` hydration |
| 4402 | INDEXEDDB BACKUP | Mirror of `mt-*` keys into IDB (iOS LS-eviction safety net) |
| 4556 | LAZY-LOAD CDN | `loadScript()` for xlsx + jspdf on first use |
| 4604 | WORKOUT OFFSET | Activity kcal applied as a goal offset |
| 4613 | RENDER TABLES | `renderTables()` — full innerHTML rebuild per category |
| 4710 | SMART SORT | Presets + scoring (`p-high`, `kcal-low`, …) |
| 5220 | POPUP | Add/edit item modal, in-popup macro override |
| 5613 | TOTALS | `renderTotals()` + progress bars |
| 5742 | DAY CONTROLS | Save / load / clear day, history navigation |
| 5834 | GOALS | Edit + persist daily targets |
| 5865 | WATER TRACKER | Glasses, ml/glass config, daily goal |
| 5945 | ADD METHOD CHOOSER | "How do you want to add?" — manual / OCR / barcode / recipe |
| 5975 | SEARCH & FILTER | `runSearchFromInput`, `applyFilters`, normalize Arabic, debounce |
| 6088 | SIDE PANEL | Slide-in drawer logic |
| 6174 | MEAL TEMPLATES | Save current day as template, restore from template |
| 6312 | DATA EXPORT/IMPORT (DB) | Excel + DB-only JSON export/import for food database |
| 6517 | ADD FOOD (manual) | Add Food modal form handlers |
| 6608 | ADD FOOD — RECIPE BUILDER | Compose new DB item from existing foods |
| 7183 | FOOD SHARE / IMPORT (hash) | `#share=...` URL hash → recipe import |
| 7282 | THEME & COLOR SCHEME | `applyTheme()`, scheme grid, header theme toggle |
| 7383 | JSON EXPORT/IMPORT (full backup) | `buildBackupObject()`, full restore flow |
| 7615 | LANGUAGE TOGGLE | `applyLanguage()` — the master re-render |
| 7687 | INIT | Top-level boot calls in order |
| 7702 | DOCK ABOVE KEYBOARD | `visualViewport` watcher so dock stays above soft keyboard |
| 7723 | GLOBAL SORT MENU | Click-outside-to-close for the smart-sort popover |
| 7759 | UNIFIED SETTINGS MODAL | Tab switching, open/close, deep-link via `openSettingsAt()` |
| 7806 | GEMINI API KEY MGMT | Read/save/status of `mt-gemini-key` |
| 7871 | TREND CHART | Past-N-days line chart over `savedDays` |
| 8027 | OCR (PHOTO EXTRACTION) | File → base64 → Gemini 2.5 Flash → sanity check → pre-fill Add Food |
| 8357 | BARCODE SCANNER | OpenFoodFacts lookup by barcode |
| 8601 | LIVE CALORIE-MISMATCH | `P×4 + F×9 + C×4` vs `kcal` in Add Food modal (live warning) |
| 8647 | DB-EMPTY NOTICE | Banner shown when DB is empty until user imports food_database-7.json |
| 8663 | DAILY REMINDERS | `Notification` API + setTimeout scheduler |
| 8808 | PWA | Service worker registration, install prompt, persistence requests, app shortcuts |

### Boot sequence

1. **Pre-paint inline `<script>`** (`<head>`) reads `mt-theme` + `mt-scheme` from localStorage and sets `data-theme` + `data-scheme` on `<html>` before first paint. Prevents a "wrong-theme flash". Must stay dependency-free.
2. **DOM body parses.** Static markup contains `data-en` / `data-ar` attributes still in their default-EN text.
3. **Main `<script>` runs** at line ~3819:
   - `DB` + `CATEGORIES` declared.
   - STATE section hydrates from `localStorage` via `lsGet`.
   - All renderers + handlers declared.
   - INIT block calls `rebuildSearchIndex(); applyTheme(); applyFeatures(); renderGoals(); renderWater(); applyLanguage(); renderMealTemplates(); saveDayState(); renderWorkoutsList();`.
4. **`applyLanguage()` is the master re-render.** It walks every `[data-en]/[data-ar]` element, sets `document.dir`, then calls `renderTables() + applyFilters() + renderTotals()`. Any code path that wants a "full UI refresh" calls `applyLanguage()`, not the individual renderers.
5. Global menu/settings/API-key/OCR/reminder handlers wire up.
6. Service worker registers; install prompt + shortcuts arm.

### Render-flow rules

| Mutate this | Then call |
|-------------|-----------|
| `dayItems`    | `saveDayState()` + `renderTotals()` |
| `DB`          | `lsSet('mt-db', ...)` + `renderTables()` |
| `goals`       | `lsSet('mt-goals', ...)` + `renderTotals()` + `renderGoals()` |
| `lang`        | `lsSet('mt-lang', ...)` + `applyLanguage()` (cascades to everything) |
| `currentTheme` or `currentScheme` | `lsSet(...)` + `applyTheme()` + `syncSchemeModalUI()` |

`renderTables()` rebuilds every category section from scratch. `applyFilters()` runs in-DOM — it toggles `.hidden` on rows + sections using data-attributes baked in by the last `renderTables()`. So `applyFilters()` alone does NOT re-render structure; it relies on a prior `renderTables()`.

### State keys (localStorage)

| Key | Type | In backup? | Purpose |
|-----|------|------------|---------|
| `mt-db` | `Food[]` JSON | ✅ | Food database. Overrides hard-coded `DB` on load. |
| `mt-day` | `DayItem[]` JSON | ✅ | Today's logged items. |
| `mt-saved` | `{date, items}[]` JSON | ✅ | History of saved days (up to 60). |
| `mt-goals` | `{kcal,protein,fat,carbs}` JSON | ✅ | Daily targets. |
| `mt-water` | `{count, mlPerGlass, goalMl, date}` JSON | ✅ | Water tracker state. |
| `mt-workouts` | `Workout[]` JSON | ✅ | Logged training sessions / activity kcal. |
| `mt-templates` | `Template[]` JSON | ✅ | Saved meal templates. |
| `mt-features` | `Record<feat, boolean>` JSON | ✅ | Feature on/off flags (water, ocr, recipes, …). |
| `mt-display-modes` | `Record<cat, mode>` JSON | ✅ | Per-category display mode (`g100`/`base`/`easy`). |
| `mt-smart-sort` | `Record<cat, presetId>` JSON | ✅ | Per-category smart-sort preset. |
| `mt-lang` | `"en"` \| `"ar"` | ✅ | UI language. |
| `mt-theme` | `"light"` \| `"dark"` \| `"system"` | ✅ | Theme mode. |
| `mt-scheme` | scheme id | ✅ | Color scheme (default, ocean, peach, …). |
| `mt-notif-enabled` | `"0"` \| `"1"` | ✅ | Daily reminder on/off. |
| `mt-notif-time` | `"HH:MM"` | ✅ | Reminder time-of-day. |
| `mt-gemini-key` | string | ❌ | Gemini API key. **Excluded from backup** so shared/synced backups can't leak your key. Re-enter via Settings → API Key after restore. |
| `mt-settings-tab` | string | ❌ | Last-open settings tab. Ephemeral UX state. |
| `mt-install-dismissed` | `"1"` | ❌ | "Don't show install prompt again" flag. |
| `mt-idb-filled`, `mt-idb-restored` | flags | ❌ | IndexedDB mirror bookkeeping. |

### IndexedDB mirror (iOS LS-eviction safety net)

iOS Safari can evict `localStorage` when storage pressure builds (e.g. after several days without re-opening the page). To survive this, every `lsSet()` also writes the same value to an IndexedDB store named `mt-backup`. On boot, if a `mt-*` key is missing from `localStorage` but present in IDB, it's restored. Lives in the `INDEXEDDB BACKUP` section.

### Trust boundaries (security)

1. **`localStorage` payloads** — semi-trusted. User owns it but a synced/imported backup may carry junk. Always escape on render. Use `lsGet` so corrupt JSON can't crash.
2. **Imported JSON / Excel** — untrusted. DB items run through `validateFood()` before being accepted. Goals through `validateGoals()`.
3. **Gemini API output** — untrusted. The image is attacker-controllable (anyone can photograph a label embedding a prompt-injection string). Escape every field of the OCR response before any `innerHTML` write.
4. **OpenFoodFacts response** — untrusted. Same rule: escape before render.
5. **URL hash share** — untrusted. `#share=...` data passes through the same escape + validate path as an import.

The single XSS guard is `escapeHtml()`. Anything from `DB`, `dayItems`, imports, or external APIs that hits `innerHTML` MUST pass through it.

### External dependencies

| Library | Where | When loaded |
|---------|-------|-------------|
| `xlsx@0.18.5` | Excel I/O | Lazy — first Export/Import-Excel click |
| `jspdf@2.5.1` + `jspdf-autotable@3.8.2` | PDF export | Lazy — first Export-PDF click |
| Google Fonts (Fraunces, JetBrains Mono, IBM Plex Sans Arabic) | Typography | Eager, `font-display:swap` |
| Gemini 2.5 Flash | OCR | User-triggered, user-keyed |
| OpenFoodFacts API | Barcode lookup | User-triggered, no key |

CSP at line 5 of `index.html` pins these endpoints. Any new origin requires a CSP update or the browser silently blocks it.

---

## Contributing

This is a personal project, but PRs are welcome.

Read [`CLAUDE.md`](./CLAUDE.md) before editing. It documents:
- The boot sequence (pre-paint script → DOM → main script → `applyLanguage` re-render).
- Where each feature lives by `// ============ BANNER ============` name.
- XSS guardrails (`escapeHtml()` is mandatory on any DB-derived `innerHTML` write).
- The bilingual rule (every static label needs `data-en` + `data-ar`; every dynamic string needs a `lang === 'ar'` ternary).
- The CSP meta tag — adding any new network origin requires updating it.

After any change to the main `<script>` block, run the smoke test from `CLAUDE.md`:

```bash
node -e "const m=require('fs').readFileSync('index.html','utf8').match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)||[];const main=m.filter(s=>!/\ssrc=/.test(s)).pop();new Function(main.replace(/^<script[^>]*>|<\/script>$/g,''));console.log('OK')"
```

3 seconds. Catches parse errors before they ship.

---

## Status

Active, single-author project. No release cadence; new versions land as the version-suffixed filename bumps.

Author: [abdullah-3337](https://github.com/abdullah-3337)
