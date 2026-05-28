# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

- Single-page web app, **one self-contained HTML file** (currently `Macro_Tracker_Interactive-32.html`) containing inline CSS + HTML + vanilla JS. No framework, no bundler, no dependencies fetched at build time. The only runtime network call is to the Gemini API (`gemini-2.5-flash`) for the OCR / photo-extraction feature, and it is user-triggered.
- Companion data file: `food_database-7.json` is the canonical food database. Users load it via the in-app "⬆ Restore JSON" button; it lands in `localStorage['mt-db']` and shadows the small sample `DB` array hard-coded in the HTML.
- Filenames are version-suffixed (`-32`, `-7`). Bumping the suffix is the release mechanism. Edit the existing numbered file in place; only bump when explicitly asked.

## Run / debug

There is no build, no lint, no test suite.

- Run: open the HTML file directly in a browser, or serve the directory (`python3 -m http.server`) and load it.
- For UI changes, exercise the affected feature in a real browser — that is the only feedback loop available.
- Reset app state: `localStorage.clear()` in DevTools on the file's origin, or use the in-app reset actions.

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

## What not to do

- Don't split the HTML into separate JS/CSS files — single-file delivery is the intended design.
- Don't add a bundler, package manager, or test framework — incompatible with the ship model.
- Don't add a runtime dependency that loads from a CDN at startup. The Gemini API is the only allowed network call, and it's user-triggered.
