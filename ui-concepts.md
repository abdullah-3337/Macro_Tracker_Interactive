# UI/UX Concepts — Reference

Distilled from a 10-minute UI/UX fundamentals video. Use as a checklist when reviewing or designing new screens in this app. Companion to `CLAUDE.md`.

---

## 1. Signifiers

A UI element should signal what it does without instructions.

- **Container around items** signals grouping ("these are related, those aren't").
- **Container + filled background** signals selection ("this is the active tab").
- **Grayed-out text** signals inactive / disabled.
- Other common signifiers: button press state, hover state, highlighted active nav item, tooltips.

**Rule:** if a user needs a label that says "click here," the affordance has failed.

---

## 2. Visual hierarchy

Three levers: **size**, **position**, **color**. Contrast between them creates hierarchy.

- **Image** at top = strong color pop + scannable.
- **Most important fact** (item name) → large + bold + top.
- **Secondary facts** (time, day) → smaller + below.
- **Differentiated data** (price) → top-right, colored (blue), to draw the eye.
- **Spatial relationships** (from → to) → use an icon + line instead of words like "from" / "to".

**Rule:** important = bigger + bolder + colored + near top. Less important = smaller + dimmer + below.

Hierarchy isn't an exact science — multiple valid arrangements exist, but the principles hold.

---

## 3. Grids and layout

12-column grids are **guidelines**, not laws.

- **Useful** for highly structured content: galleries, blogs, repeating cards, responsive layouts (12 cols → 8 (tablet) → 4 (mobile)).
- **Optional** for custom landing pages — those routinely break the grid on purpose.
- **4-point grid** is the underlying system: every measurement is a multiple of 4 px so things divide cleanly in half. Looks consistent because it IS consistent, not because 4 is magic.

---

## 4. Whitespace & rhythm

Whitespace > grids for legibility.

- Example spec: header `font-size` / `line-height`, subtext `font-size` / `line-height`, buttons sized similarly, optional announcement bar above.
- **~32 px between distinct items.**
- **Group related elements tighter** (announcement + headline, headline + sub-headline) — proximity = relationship. Another form of hierarchy.

---

## 5. Typography

- **One sans-serif font is enough** for almost any design. Don't burn hours picking fonts.
- **Letter-spacing hack:** for big headers, set tracking to **-2% to -3%** and line-height to **110–120%** — instantly looks pro.
- **Landing pages / websites:** up to ~6 font sizes, wide range.
- **Dashboards:** narrow range, rarely > 24 px (info density requires it).

---

## 6. Color

- **Start with one primary (brand) color.**
- **Lighten** for backgrounds, **darken** for text → already halfway to a full color ramp.
- A ramp powers chips, states, charts, etc.
- **Let color find purpose** — don't paint things "just to add color."
- **Semantic colors:**
  - 🔵 blue → trust, info
  - 🔴 red → danger, urgency
  - 🟡 yellow → warning
  - 🟢 green → success
- **Rule:** color signifies meaning; never decoration alone.

---

## 7. Dark mode

Different rules than light mode.

- **Borders:** dim them — bright borders carry too much contrast on dark.
- **No shadows for depth** (they don't read). Instead: **make cards LIGHTER than the background**.
- **Chips:** lower saturation and brightness; flip foreground for text contrast.
- **Color palette flexibility:** deep purples, reds, greens all work — not limited to navy/gray.

---

## 8. Shadows (light mode)

- Most default shadows are too strong.
- **Reduce opacity, increase blur.**
- **Cards** need very soft shadows.
- **Popovers / modals** (content above other content) need stronger shadows so they read as "floating".
- **Inner + outer shadows** can simulate raised tactile buttons.
- **Rule:** if the shadow is the first thing you notice, it's wrong.

---

## 9. Icons

- Default icon size in design tools is usually too large.
- **Match the icon size to the line-height** of the adjacent text (e.g., 24 px text → 24 px icon).
- Tighten the gap between icon and text after sizing.

---

## 10. Buttons

- **Ghost button** = no background until hover. Sidebar nav links are usually ghost buttons.
- **Solid button** = persistent background; primary CTA.
- **Padding rule:** width ≈ **2 × height**.
- Pair primary + secondary CTAs side by side.
- Works with or without icons.

---

## 11. States (everything that responds to input)

Every button needs **at least four** states:

1. Default
2. Hover
3. Active / pressed
4. Disabled

Plus, when relevant:

5. Loading (spinner)

Inputs need:

- Focus (border / ring)
- Error (red border + message)
- Warning (yellow border, optional)
- Disabled

**Rule:** every user action gets a visible response. No exceptions.

---

## 12. Micro-interactions

A step beyond state feedback — they **confirm** the action happened.

- Copy button: state change is not enough → slide up a "Copied ✓" chip to confirm.
- Range: practical (toast confirmations) → playful (animated reactions).
- Other examples: loading spinners during fetch, success messages on save, scroll/swipe micro-animations.

---

## 13. Overlays on images

Plain image + plain text rarely reads — overlay is required.

- ❌ Full-screen flat black overlay = kills the image.
- ✅ **Linear gradient** from transparent at the image area to opaque under the text.
- ✅ **Progressive blur** on top of the gradient = modern, premium look.

---

## How to apply this to Macro Tracker

Concrete audit targets in `index.html`:

| Area | Concept to check |
|---|---|
| Food rows in category tables | Hierarchy (name > basis > macros), color (protein / fat / carb columns colored?), icons matched to line-height |
| Day totals (progress cards) | Semantic color use (over / on-target / warn), spacing (32 px between cards), contrast in dark mode |
| FAB (floating add button) | Solid CTA, padding ratio, all 4 button states, micro-interaction on press |
| Modals (Add Food, Popup, OCR) | Stronger shadow than cards, focus / error / warning states on inputs, overlay handling |
| Toasts | Micro-interaction (slide, fade), kind colors map semantically (success / warn / error) |
| Filter / category chips | Selected state container, disabled state if empty, hover affordance |
| Dark mode | Lighter cards vs background, dimmed borders, no light-mode shadows leaking through |
| Typography | One sans-serif beyond display (`Fraunces`), letter-spacing tightened on large headers, ≤6 sizes total |
| Charts (analytics) | Semantic colors, axis label legibility in RTL + dark mode |
| Empty states | Hierarchy + CTA, micro-interaction on first add |
