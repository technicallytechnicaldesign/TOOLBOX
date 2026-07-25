/* TOOLBOX — checklist engine.
 * ---------------------------------------------------------------------------
 * Renders a data-driven technical-drawing checklist from a single global
 * CHECKLIST object into #checklist-root, and gives every checklist the same
 * behaviour for free:
 *   - tri-state items  (todo -> OK -> issue -> N/A -> todo)  by click / Enter
 *   - a live progress meter (resolved / issues / total, with a fill bar)
 *   - a title block of free-text fields (drawing no., rev, checked by, ...)
 *   - a per-item note line that opens when an item is flagged as an issue
 *   - localStorage persistence, keyed per checklist id (survives reloads)
 *   - Reset, Print / PDF (clean sign-off sheet) and Copy-summary controls
 *
 * Every colour flows through the page's CSS variables, so a checklist themes
 * light/dark with the rest of TOOLBOX. NOTHING here is checklist-specific:
 * to make a new checklist, copy template.html and edit its inline CHECKLIST
 * data block — never this file.
 *
 * Data contract (window.CHECKLIST):
 *   {
 *     id:       "drawing-release",         // unique — the localStorage key
 *     title:    "General Drawing Release",
 *     subtitle: "Pre-release review …",    // optional
 *     fields:   ["Drawing No.", "Rev", "Checked by", "Date"],   // optional
 *     sections: [
 *       { name: "Title Block", items: [
 *           "Drawing number, title and revision present",       // string, or…
 *           { label: "Scale stated", hint: "consistent across views" }
 *       ] },
 *       …
 *     ]
 *   }
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var data = window.CHECKLIST;
  var root = document.getElementById("checklist-root");
  if (!data || !root) {
    if (root) root.textContent = "No CHECKLIST data found on this page.";
    return;
  }

  var STORE_KEY = "toolbox-checklist:" + (data.id || "untitled");

  // state cycle — the order a click walks through
  var CYCLE = ["todo", "ok", "issue", "na"];
  var GLYPH = { todo: "", ok: "✓", issue: "!", na: "–" };
  var SR = { todo: "not reviewed", ok: "OK", issue: "issue", na: "not applicable" };

  // ---- persistence -------------------------------------------------------
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { fields: {}, items: {}, updated: null };
  }
  function save() {
    state.updated = nowStamp();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    paintUpdated();
  }
  // Date.now()/new Date() are fine in the browser; only the workflow VM bans them.
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

  // ---- helpers -----------------------------------------------------------
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function itemKey(si, ii) { return "s" + si + "-i" + ii; }
  function itemRec(key) {
    if (!state.items[key]) state.items[key] = { state: "todo", note: "" };
    return state.items[key];
  }
  function allItems() {
    var out = [];
    (data.sections || []).forEach(function (sec, si) {
      (sec.items || []).forEach(function (it, ii) {
        out.push({ key: itemKey(si, ii), rec: itemRec(itemKey(si, ii)) });
      });
    });
    return out;
  }

  // ---- progress meter ----------------------------------------------------
  var meterFill, meterCounts, sectionMeters = {};
  function tally(items) {
    var t = { total: items.length, ok: 0, issue: 0, na: 0, todo: 0 };
    items.forEach(function (o) {
      var s = o.rec.state || "todo";
      t[s] = (t[s] || 0) + 1;
    });
    t.resolved = t.ok + t.na;       // "done" = OK or explicitly N/A
    return t;
  }
  function pct(t) { return t.total ? Math.round((t.resolved / t.total) * 100) : 0; }

  function paintMeter() {
    var t = tally(allItems());
    var p = pct(t);
    meterFill.style.width = p + "%";
    meterFill.parentNode.setAttribute("aria-valuenow", String(p));
    meterCounts.innerHTML = "";
    meterCounts.appendChild(seg(p + "%", "is-pct"));
    meterCounts.appendChild(seg(t.resolved + " / " + t.total + " done", ""));
    if (t.issue) meterCounts.appendChild(seg(t.issue + (t.issue === 1 ? " issue" : " issues"), "is-issue"));
    if (t.todo) meterCounts.appendChild(seg(t.todo + " open", "is-todo"));
    meterFill.parentNode.classList.toggle("is-complete", t.total > 0 && t.resolved === t.total && !t.issue);
    // per-section counters
    (data.sections || []).forEach(function (sec, si) {
      var items = (sec.items || []).map(function (_, ii) {
        return { key: itemKey(si, ii), rec: itemRec(itemKey(si, ii)) };
      });
      var st = tally(items);
      if (sectionMeters[si]) sectionMeters[si].textContent = st.resolved + "/" + st.total;
    });
  }
  function seg(txt, cls) {
    var s = el("span", "cl-count" + (cls ? " " + cls : ""), txt);
    return s;
  }

  var updatedEl;
  function paintUpdated() {
    if (updatedEl) updatedEl.textContent = "Saved " + prettyStamp(state.updated);
  }

  // ---- build DOM ---------------------------------------------------------
  function build() {
    root.innerHTML = "";

    // header block: title + subtitle
    var head = el("div", "cl-head");
    head.appendChild(el("div", "cl-eyebrow", "Checklist"));
    head.appendChild(el("h1", "cl-title", data.title || "Untitled checklist"));
    if (data.subtitle) head.appendChild(el("p", "cl-subtitle", data.subtitle));
    root.appendChild(head);

    // title block (free-text fields)
    if (data.fields && data.fields.length) {
      var tb = el("div", "cl-titleblock");
      data.fields.forEach(function (label) {
        var cell = el("label", "cl-field");
        cell.appendChild(el("span", "cl-field-label", label));
        var inp = el("input", "cl-field-input");
        inp.type = "text";
        inp.value = state.fields[label] || "";
        inp.setAttribute("aria-label", label);
        inp.addEventListener("input", function () {
          state.fields[label] = inp.value;
          save();
        });
        cell.appendChild(inp);
        tb.appendChild(cell);
      });
      root.appendChild(tb);
    }

    // sticky progress meter
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
    (data.sections || []).forEach(function (sec, si) {
      var s = el("section", "cl-section");
      var sh = el("div", "cl-section-head");
      sh.appendChild(el("span", "cl-section-idx", pad(si + 1)));
      sh.appendChild(el("h2", "cl-section-name", sec.name || "Section " + (si + 1)));
      var sm = el("span", "cl-section-count", "0/0");
      sectionMeters[si] = sm;
      sh.appendChild(sm);
      s.appendChild(sh);

      (sec.items || []).forEach(function (raw, ii) {
        var label = typeof raw === "string" ? raw : raw.label;
        var hint = typeof raw === "string" ? "" : (raw.hint || "");
        var key = itemKey(si, ii);
        var rec = itemRec(key);

        var row = el("div", "cl-item");
        row.setAttribute("data-state", rec.state || "todo");

        var btn = el("button", "cl-status");
        btn.type = "button";
        btn.setAttribute("aria-label", "Toggle status — currently " + SR[rec.state || "todo"]);
        paintStatus(btn, rec.state || "todo");
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
        });

        var body = el("div", "cl-item-body");
        var lab = el("span", "cl-label", label);
        body.appendChild(lab);
        if (hint) body.appendChild(el("span", "cl-hint", hint));

        // per-item note — revealed while flagged as an issue
        var noteWrap = el("div", "cl-note");
        noteWrap.hidden = (rec.state || "todo") !== "issue";
        var note = el("input", "cl-note-input");
        note.type = "text";
        note.placeholder = "What's the issue?";
        note.value = rec.note || "";
        note.addEventListener("input", function () { rec.note = note.value; save(); });
        noteWrap.appendChild(note);
        body.appendChild(noteWrap);

        row.appendChild(btn);
        row.appendChild(body);
        s.appendChild(row);
      });

      root.appendChild(s);
    });

    // footer toolbar
    var bar2 = el("div", "cl-toolbar");
    updatedEl = el("span", "cl-updated", "");
    bar2.appendChild(updatedEl);
    var spacer = el("span", "cl-tb-spacer");
    bar2.appendChild(spacer);
    bar2.appendChild(mkBtn("Copy summary", copySummary));
    bar2.appendChild(mkBtn("Print / PDF", function () { window.print(); }));
    bar2.appendChild(mkBtn("Reset", resetAll, "is-danger"));
    root.appendChild(bar2);

    paintMeter();
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

  // ---- actions -----------------------------------------------------------
  function resetAll() {
    if (!window.confirm("Reset this checklist? All states, notes and fields on this sheet will be cleared.")) return;
    state = { fields: {}, items: {}, updated: null };
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    build();
  }

  function copySummary() {
    var lines = [];
    lines.push(data.title || "Checklist");
    if (data.fields) data.fields.forEach(function (f) {
      if (state.fields[f]) lines.push(f + ": " + state.fields[f]);
    });
    var t = tally(allItems());
    lines.push("Progress: " + t.resolved + "/" + t.total + " resolved" +
               (t.issue ? ", " + t.issue + " issue(s)" : "") +
               (t.todo ? ", " + t.todo + " open" : ""));
    lines.push("");
    (data.sections || []).forEach(function (sec, si) {
      lines.push("## " + (sec.name || "Section " + (si + 1)));
      (sec.items || []).forEach(function (raw, ii) {
        var label = typeof raw === "string" ? raw : raw.label;
        var rec = itemRec(itemKey(si, ii));
        var mark = { todo: "[ ]", ok: "[x]", issue: "[!]", na: "[-]" }[rec.state || "todo"];
        var line = mark + " " + label;
        if (rec.state === "issue" && rec.note) line += "  — " + rec.note;
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

  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el("div", "cl-toast");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  build();
})();
