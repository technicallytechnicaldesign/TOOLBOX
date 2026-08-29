# TOOLBOX

Pure technical-design tools — a sibling site to
[RENKON](https://github.com/technicallytechnicaldesign/RENKON). Where RENKON is
the design + rendering hub, TOOLBOX is the home for engineering/shop-math
utilities: calculators, converters and analysis helpers.

Same house style as RENKON (dark surface, Space Grotesk / Space Mono, sharp
corners, 1px grid lines) with its own **technical-blue** accent and a hex
fastener mark so the two read as related-but-distinct.

## Structure

- **`index.html`** — the landing page (splash + tile grid). Served as the
  GitHub Pages root (`https://technicallytechnicaldesign.github.io/TOOLBOX/`).
- **`calculators/`** — a single-page, tabbed calculator app (beam analysis,
  cost estimator, bolted joints, sheet-metal bend, 1D cut optimiser). Moved
  here from RENKON.
- **`section-lab/`** — an interactive section-view lab: slide a cutting plane
  A–A through parametric parts and read the generated section, with live iso,
  ortho references and feature jumps. `core.js` + `lab-controller.js` are the
  ported engine (unchanged); `index.html` carries the TOOLBOX skin — all
  drawing colour flows through CSS variables so it themes light/dark with the
  rest of the site.
- **`checklists/`** — review checklists for technical drawings, each a live
  sign-off sheet: process toggles (sheet metal / welding / machining / casting…)
  that hide and stop counting irrelevant items, tri-state items, a progress
  meter, per-item issue notes, browser-saved state and clean print output.
  `checklist.js` is the shared data-driven engine (mountable: auto-mounts from a
  `window.CHECKLIST` object, or `mount(root, data, opts)` for previews);
  `checklist.css` is the shared skin. `template.html` is the ready-made
  **Drawing Checklist** and the copy-me starter; `weldment.html` is the
  **Weldment Review** (toggles by parent material plus code-governed work) and
  `sheet-metal-flat.html` is the **Sheet-Metal Flat** release check (toggles by
  operation: laser, punch, bending, hardware, finishing); `builder.html` + `builder.js`
  are a form-driven **template generator** (compose with live preview, save to
  the browser, or export a standalone HTML file); `run.html?id=<slug>` runs a
  browser-saved custom checklist; `index.html` is the section hub.
- **`kb/`** — the **Knowledge Base**: reference pages for the symbols, marks and conventions
  that show up on technical drawings. `kb.css` is the shared article skin (page head, in-page
  TOC chips, callouts, diagram figures, glyph-card grids, reference tables, worked-example
  rows); `index.html` is the section hub. Entries: `welding-symbols.html` — reading an
  AWS A2.4 welding symbol end to end (reference line, arrow/other side, tail, the basic weld
  glyphs, sizing & pitch, supplementary marks, contour & finish); `gdt-symbols.html` — reading
  an ASME Y14.5 feature control frame (the 14 geometric characteristic symbols across form,
  profile, orientation, location and runout; datums & order of precedence; MMC/LMC/RFS and
  the other modifiers); `iso-fits.html` — reading an ISO 286 fit designation like `⌀25 H7/g6`
  (hole-basis vs shaft-basis, the IT tolerance-grade formula, fundamental deviation letters,
  clearance/transition/interference zone diagrams, and the ISO 286-2 preferred-fits table,
  with a rough ANSI/B4.1 class comparison). All three build their marks as a reusable inline
  SVG glyph library (`<symbol>` defs referenced by `<use>`, where the topic is symbol-heavy)
  and close with five fully-decoded worked examples and a quick-reference table.
- **`goblin/`** — the **Hype Goblin**: an animated CSS familiar who has opinions
  about your tolerances. Deliberately *not* a tool — it computes nothing and
  verifies nothing. Four mood buttons (hype / reality check / fix / destroy) each
  draw from their own line pool and recolour him; an ambient timer speaks every
  11–28s, running either a single line, an UNPROVOKED TOLERANCE SCREAM, or one of
  29 multi-beat **routines** in which he holds a sustained pose — reading down a
  drawing, furiously scribbling, weeping over a fillet, measuring something with
  calipers, leaning in to tell you something he should not. Behind him, ghost
  tolerances, atrocious feature control frames and bespoke bolts drift through
  the empty stage; he grins at them, and about a quarter of them scream on their
  way past. 600 lines across fifteen pools, plus a few easter eggs. Single file, no assets, no state, no
  persistence, but it does carry a 106-assertion self-test (`goblin/selftest.js`,
  never loaded by the page) that drives a virtual clock instead of sleeping and
  runs in ~60ms. **See [`goblin/README.md`](goblin/README.md)** for the speech
  controller, the pose/mood/expression layers, how to add lines and routines,
  and how to run the tests.
- **`assets/`** — shared, dependency-free chrome dropped into every page:
  `theme.js` (light/dark toggle), `reveal.js` (load-in animation), `menu.js`
  (unified nav), and `favicon.svg` (the hex mark).

## Conventions

- **No build step, no framework.** Every page is self-contained and opens
  directly in a browser; the only external dependency is the brand fonts from
  Google Fonts (non-blocking, with a system-font fallback).
- **Relative links only** (no leading `/`) so everything works both as local
  files and served under the `/TOOLBOX/` Pages base.
- **Git is the version history** — keep filenames stable, commit changes.
