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
- **`checklists/`** — reusable review checklists for technical drawings, each a
  live sign-off sheet (tri-state items, progress meter, per-item issue notes,
  browser-saved state, clean print output). `checklist.js` is a shared,
  data-driven engine; `template.html` is the starter (copy it, edit its inline
  `CHECKLIST` data block to make a new one); `index.html` is the section hub.
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
