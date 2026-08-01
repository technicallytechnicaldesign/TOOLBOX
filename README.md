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
- **`goblin/`** — the **Hype Goblin**: an animated CSS familiar who has opinions
  about your tolerances. Deliberately *not* a tool — it computes nothing and
  verifies nothing. Four mood buttons (hype / reality check / fix / destroy) each
  draw from their own line pool and recolour him; an ambient timer speaks every
  11–28s, running either a single line, an UNPROVOKED TOLERANCE SCREAM, or one of
  29 multi-beat **routines** in which he holds a sustained pose — reading down a
  drawing, furiously scribbling, weeping over a fillet, measuring something with
  calipers, leaning in to tell you something he should not. 537 lines across ten
  pools, plus a few easter eggs. Single file, no assets, no state, no
  persistence. **See [`goblin/README.md`](goblin/README.md)** for the speech
  controller, the pose/mood/expression layers, and how to add lines and routines.
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
