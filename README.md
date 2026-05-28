# Daily Macro Tracker · جدول الأكل اليومي

A single-file, offline-first daily macro and calorie tracker. Open one HTML file in a browser — that's the entire app. Bilingual English/Arabic with full RTL support.

> No build, no install, no account. Your food log lives in your browser's `localStorage` and never leaves your device, except when *you* click the OCR button.

**Live source:** [`Macro_Tracker_Interactive-32.html`](./Macro_Tracker_Interactive-32.html) · 378 KB · ~6,300 lines of inline HTML/CSS/JS.

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
xdg-open Macro_Tracker_Interactive-32.html      # Linux
open Macro_Tracker_Interactive-32.html          # macOS
# Or serve:
python3 -m http.server 8000
# then visit http://localhost:8000/Macro_Tracker_Interactive-32.html
```

First run shows 11 sample foods. To load the full catalog, open the side panel → **⬆ Restore JSON** → pick `food_database-7.json`.

To use OCR, open Settings, paste a Gemini API key (get one at `aistudio.google.com`), save.

### Reset state
DevTools → Console → `localStorage.clear()` → reload. Or use **🗑 Clear day** / the in-app reset actions.

---

## File overview

| Path | Purpose |
|------|---------|
| `Macro_Tracker_Interactive-32.html` | The whole app: inline HTML + CSS + JS. |
| `food_database-7.json` | Seed food catalog. Load via the Restore JSON button. |
| `CLAUDE.md` | Architecture map, conventions, and `*.local.*` collaboration workflow for AI-assisted edits. |
| `.gitignore` | Excludes `*.local.*` collaboration files. |

Filenames are version-suffixed (`-32`, `-7`). Bumping the suffix is the release mechanism.

---

## Tech stack

- **Vanilla JavaScript.** No framework, no bundler, no test runner. The whole script is one `<script>` block, sectioned with `// ============ NAME ============` banners.
- **CSS variables** drive themes and color schemes; no preprocessor.
- **localStorage** for state — all keys prefixed `mt-` (`mt-db`, `mt-day`, `mt-saved`, `mt-goals`, `mt-lang`, `mt-theme`, `mt-scheme`, `mt-display-modes`, `mt-smart-sort`, `mt-settings-open`, `mt-gemini-key`).
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
node -e "const m=require('fs').readFileSync('Macro_Tracker_Interactive-32.html','utf8').match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)||[];const main=m.filter(s=>!/\ssrc=/.test(s)).pop();new Function(main.replace(/^<script[^>]*>|<\/script>$/g,''));console.log('OK')"
```

3 seconds. Catches parse errors before they ship.

---

## Status

Active, single-author project. No release cadence; new versions land as the version-suffixed filename bumps.

Author: [abdullah-3337](https://github.com/abdullah-3337)
