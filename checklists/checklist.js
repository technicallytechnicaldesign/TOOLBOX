/* TOOLBOX — checklist engine.
 * ---------------------------------------------------------------------------
 * A data-driven technical-drawing checklist, rendered from a single CHECKLIST
 * object. Every checklist gets the same behaviour for free:
 *   - process toggles  (Sheet Metal / Welding / Machining / Casting / …) that
 *     hide AND stop counting items not relevant to the drawing in hand
 *   - tri-state items  (todo -> OK -> issue -> N/A -> todo) by click / Enter
 *   - a live progress meter over the *visible* items (resolved / issues / open)
 *   - a title block of free-text fields (drawing no., rev, checked by, …)
 *   - a per-item note line that opens when an item is flagged as an issue
 *   - localStorage persistence, keyed per checklist id (survives reloads)
 *   - Copy-summary / Print / Reset controls
 *
 * Usage — two ways:
 *   1. Declarative (template.html, run.html): set `window.CHECKLIST = {…}` and
 *      include this file; it auto-mounts into #checklist-root and persists.
 *   2. Programmatic (builder preview): call
 *      window.TOOLBOX_CHECKLIST.mount(rootEl, data, { persist:false }).
 *
 * Data contract (window.CHECKLIST):
 *   {
 *     id:       "drawing",                 // unique — the localStorage key
 *     title:    "Drawing Checklist",
 *     subtitle: "…",                       // optional
 *     fields:   ["Drawing No.", "Rev", …], // optional title-block inputs
 *     processes:[ { key:"welding", label:"Welding" }, … ],   // optional toggles
 *     sections: [
 *       { name:"Views", tags:[], items:[            // section tags optional
 *           "General item (no tags -> always shown)",
 *           { label:"Weld symbols complete", hint:"size, type, length",
 *             tags:["welding"] }                    // item tags override section
 *       ] },
 *       { name:"Casting", tags:["casting"], items:[ "Draft angles applied", … ] }
 *     ]
 *   }
 * An item is visible when it has no process tags, or when at least one of its
 * tags is toggled on. A section hides once all its items are hidden.
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var CYCLE = ["todo", "ok", "issue", "na"];
  var GLYPH = { todo: "", ok: "✓", issue: "!", na: "–" };
  var SR = { todo: "not reviewed", ok: "OK", issue: "issue", na: "not applicable" };
  var MARK = { todo: "[ ]", ok: "[x]", issue: "[!]", na: "[-]" };

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  // ---- the mountable engine ----------------------------------------------
  function mount(root, data, opts) {
    opts = opts || {};
    var persist = opts.persist !== false;
    var hideToolbar = !!opts.hideToolbar;
    var STORE_KEY = opts.key || ("toolbox-checklist:" + (data.id || "untitled"));

    // ---- persistence -----------------------------------------------------
    function load() {
      if (!persist) return { fields: {}, items: {}, processes: {}, updated: null };
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return { fields: {}, items: {}, processes: {}, updated: null };
    }
    function save() {
      state.updated = nowStamp();
      if (persist) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
      }
      paintUpdated();
    }
    function nowStamp() { return new Date().toISOString(); }
    function prettyStamp(iso) {
      if (!iso) return "not started";
      try {
        var d = new Date(iso);
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
               " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return iso; }
    }

    var state = load();
    if (!state.fields) state.fields = {};
    if (!state.items) state.items = {};
    if (!state.processes) state.processes = {};

    var procs = data.processes || [];
    // default every process ON unless the stored state says otherwise
    procs.forEach(function (p) {
      if (typeof state.processes[p.key] !== "boolean") state.processes[p.key] = true;
    });
    function isActive(key) { return state.processes[key] !== false; }

    // ---- item helpers ----------------------------------------------------
    function itemKey(si, ii) { return "s" + si + "-i" + ii; }
    function itemRec(key) {
      if (!state.items[key]) state.items[key] = { state: "todo", note: "" };
      return state.items[key];
    }
    function effTags(rawItem, section) {
      var t = (rawItem && typeof rawItem === "object" && rawItem.tags && rawItem.tags.length)
        ? rawItem.tags : (section.tags || []);
      return t || [];
    }
    function tagsVisible(tags) {
      if (!tags.length) return true;
      for (var i = 0; i < tags.length; i++) if (isActive(tags[i])) return true;
      return false;
    }

    // built structure, kept for live filtering
    var built = [];   // [{ el, headEl, countEl, items:[{ el, tags, rec, noteWrap }] }]
    var meterFill, meterCounts, sectionWrap, updatedEl;

    function tally(itemEntries) {
      var t = { total: itemEntries.length, ok: 0, issue: 0, na: 0, todo: 0 };
      itemEntries.forEach(function (o) { var s = o.rec.state || "todo"; t[s]++; });
      t.resolved = t.ok + t.na;
      return t;
    }
    function pct(t) { return t.total ? Math.round((t.resolved / t.total) * 100) : 0; }

    function visibleEntries() {
      var out = [];
      built.forEach(function (sec) {
        sec.items.forEach(function (it) { if (tagsVisible(it.tags)) out.push(it); });
      });
      return out;
    }

    function seg(txt, cls) { return el("span", "cl-count" + (cls ? " " + cls : ""), txt); }

    function paintMeter() {
      var t = tally(visibleEntries());
      var p = pct(t);
      meterFill.style.width = p + "%";
      meterFill.parentNode.setAttribute("aria-valuenow", String(p));
      meterCounts.innerHTML = "";
      meterCounts.appendChild(seg(p + "%", "is-pct"));
      meterCounts.appendChild(seg(t.resolved + " / " + t.total + " done", ""));
      if (t.issue) meterCounts.appendChild(seg(t.issue + (t.issue === 1 ? " issue" : " issues"), "is-issue"));
      if (t.todo) meterCounts.appendChild(seg(t.todo + " open", "is-todo"));
      meterFill.parentNode.classList.toggle("is-complete", t.total > 0 && t.resolved === t.total && !t.issue);
    }

    function applyFilter() {
      built.forEach(function (sec) {
        var anyVisible = false;
        sec.items.forEach(function (it) {
          var vis = tagsVisible(it.tags);
          it.el.hidden = !vis;
          if (vis) anyVisible = true;
        });
        sec.el.hidden = !anyVisible;
        var t = tally(sec.items.filter(function (it) { return tagsVisible(it.tags); }));
        sec.countEl.textContent = t.resolved + "/" + t.total;
      });
      paintMeter();
    }

    function paintUpdated() {
      if (updatedEl) updatedEl.textContent = persist ? ("Saved " + prettyStamp(state.updated)) : "Preview — not saved";
    }

    // ---- build DOM -------------------------------------------------------
    function build() {
      root.innerHTML = "";
      built = [];

      var head = el("div", "cl-head");
      head.appendChild(el("div", "cl-eyebrow", "Checklist"));
      head.appendChild(el("h1", "cl-title", data.title || "Untitled checklist"));
      if (data.subtitle) head.appendChild(el("p", "cl-subtitle", data.subtitle));
      root.appendChild(head);

      // title block
      if (data.fields && data.fields.length) {
        var tb = el("div", "cl-titleblock");
        data.fields.forEach(function (label) {
          var cell = el("label", "cl-field");
          cell.appendChild(el("span", "cl-field-label", label));
          var inp = el("input", "cl-field-input");
          inp.type = "text";
          inp.value = state.fields[label] || "";
          inp.setAttribute("aria-label", label);
          inp.addEventListener("input", function () { state.fields[label] = inp.value; save(); });
          cell.appendChild(inp);
          tb.appendChild(cell);
        });
        root.appendChild(tb);
      }

      // process toggles
      if (procs.length) {
        var pWrap = el("div", "cl-processes");
        pWrap.appendChild(el("span", "cl-proc-label", "Applies to"));
        var chips = el("div", "cl-proc-chips");
        procs.forEach(function (p) {
          var chip = el("button", "cl-proc", p.label);
          chip.type = "button";
          chip.setAttribute("aria-pressed", isActive(p.key) ? "true" : "false");
          chip.classList.toggle("is-off", !isActive(p.key));
          chip.addEventListener("click", function () {
            state.processes[p.key] = !isActive(p.key);
            chip.setAttribute("aria-pressed", isActive(p.key) ? "true" : "false");
            chip.classList.toggle("is-off", !isActive(p.key));
            save();
            applyFilter();
          });
          chips.appendChild(chip);
        });
        pWrap.appendChild(chips);
        root.appendChild(pWrap);
      }

      // meter
      var meter = el("div", "cl-meter");
      var bar = el("div", "cl-bar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      bar.setAttribute("aria-label", "Checklist progress");
      meterFill = el("div", "cl-bar-fill");
      bar.appendChild(meterFill);
      meterCounts = el("div", "cl-counts");
      meter.appendChild(meterCounts);
      meter.appendChild(bar);
      root.appendChild(meter);

      // sections
      sectionWrap = el("div", "cl-sections");
      (data.sections || []).forEach(function (sec, si) {
        var secEl = el("section", "cl-section");
        var sh = el("div", "cl-section-head");
        sh.appendChild(el("span", "cl-section-idx", pad(si + 1)));
        sh.appendChild(el("h2", "cl-section-name", sec.name || "Section " + (si + 1)));
        var sm = el("span", "cl-section-count", "0/0");
        sh.appendChild(sm);
        secEl.appendChild(sh);

        var itemEntries = [];
        (sec.items || []).forEach(function (raw, ii) {
          var label = typeof raw === "string" ? raw : raw.label;
          var hint = typeof raw === "string" ? "" : (raw.hint || "");
          var key = itemKey(si, ii);
          var rec = itemRec(key);
          var tags = effTags(raw, sec);

          var row = el("div", "cl-item");
          row.setAttribute("data-state", rec.state || "todo");

          var btn = el("button", "cl-status");
          btn.type = "button";
          btn.setAttribute("aria-label", "Toggle status — currently " + SR[rec.state || "todo"]);
          paintStatus(btn, rec.state || "todo");

          var body = el("div", "cl-item-body");
          var lab = el("span", "cl-label", label);
          body.appendChild(lab);
          if (hint) body.appendChild(el("span", "cl-hint", hint));

          var noteWrap = el("div", "cl-note");
          noteWrap.hidden = (rec.state || "todo") !== "issue";
          var note = el("input", "cl-note-input");
          note.type = "text";
          note.placeholder = "What's the issue?";
          note.value = rec.note || "";
          note.addEventListener("input", function () { rec.note = note.value; save(); });
          noteWrap.appendChild(note);
          body.appendChild(noteWrap);

          btn.addEventListener("click", function () {
            var cur = rec.state || "todo";
            var next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
            rec.state = next;
            row.setAttribute("data-state", next);
            paintStatus(btn, next);
            btn.setAttribute("aria-label", "Toggle status — currently " + SR[next]);
            noteWrap.hidden = next !== "issue";
            save();
            paintMeter();
            // refresh this section's counter
            var t = tally(itemEntries.filter(function (o) { return tagsVisible(o.tags); }));
            sm.textContent = t.resolved + "/" + t.total;
          });

          row.appendChild(btn);
          row.appendChild(body);
          secEl.appendChild(row);
          itemEntries.push({ el: row, tags: tags, rec: rec });
        });

        sectionWrap.appendChild(secEl);
        built.push({ el: secEl, headEl: sh, countEl: sm, items: itemEntries });
      });
      root.appendChild(sectionWrap);

      // toolbar
      if (!hideToolbar) {
        var tbar = el("div", "cl-toolbar");
        updatedEl = el("span", "cl-updated", "");
        tbar.appendChild(updatedEl);
        tbar.appendChild(el("span", "cl-tb-spacer"));
        tbar.appendChild(mkBtn("Copy summary", copySummary));
        tbar.appendChild(mkBtn("Print / PDF", function () { window.print(); }));
        if (persist) tbar.appendChild(mkBtn("Reset", resetAll, "is-danger"));
        root.appendChild(tbar);
      }

      applyFilter();
      paintUpdated();
    }

    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function paintStatus(btn, s) { btn.textContent = GLYPH[s] || ""; }
    function mkBtn(label, fn, cls) {
      var b = el("button", "cl-tb-btn" + (cls ? " " + cls : ""), label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    }

    // ---- actions ---------------------------------------------------------
    function resetAll() {
      if (!window.confirm("Reset this checklist? All states, notes and fields on this sheet will be cleared.")) return;
      state = { fields: {}, items: {}, processes: {}, updated: null };
      procs.forEach(function (p) { state.processes[p.key] = true; });
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      build();
    }

    function copySummary() {
      var lines = [];
      lines.push(data.title || "Checklist");
      if (data.fields) data.fields.forEach(function (f) {
        if (state.fields[f]) lines.push(f + ": " + state.fields[f]);
      });
      if (procs.length) {
        var on = procs.filter(function (p) { return isActive(p.key); }).map(function (p) { return p.label; });
        lines.push("Applies to: " + (on.length ? on.join(", ") : "—"));
      }
      var t = tally(visibleEntries());
      lines.push("Progress: " + t.resolved + "/" + t.total + " resolved" +
                 (t.issue ? ", " + t.issue + " issue(s)" : "") +
                 (t.todo ? ", " + t.todo + " open" : ""));
      lines.push("");
      built.forEach(function (sec, si) {
        var visItems = sec.items.filter(function (it) { return tagsVisible(it.tags); });
        if (!visItems.length) return;
        lines.push("## " + (data.sections[si].name || "Section " + (si + 1)));
        var raws = data.sections[si].items || [];
        sec.items.forEach(function (it, ii) {
          if (!tagsVisible(it.tags)) return;
          var raw = raws[ii];
          var label = typeof raw === "string" ? raw : raw.label;
          var line = MARK[it.rec.state || "todo"] + " " + label;
          if (it.rec.state === "issue" && it.rec.note) line += "  — " + it.rec.note;
          lines.push(line);
        });
        lines.push("");
      });
      var text = lines.join("\n").trim();
      var done = function () { toast("Summary copied to clipboard"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      } else { fallbackCopy(text, done); }
    }
    function fallbackCopy(text, done) {
      var ta = el("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-1000px;left:-1000px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    }

    build();
    return {
      destroy: function () { root.innerHTML = ""; built = []; },
      rerender: build
    };
  }

  // ---- shared toast ------------------------------------------------------
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = el("div", "cl-toast"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  window.TOOLBOX_CHECKLIST = { mount: mount, toast: toast };

  // ---- auto-mount (declarative pages) ------------------------------------
  function auto() {
    var root = document.getElementById("checklist-root");
    if (!root) return;
    if (window.CHECKLIST) mount(root, window.CHECKLIST, window.CHECKLIST_OPTS || {});
    else if (window.CHECKLIST_SUPPRESS_AUTO !== true) root.textContent = "No CHECKLIST data found on this page.";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else auto();
})();
