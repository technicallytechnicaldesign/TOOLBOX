/* TOOLBOX — checklist builder (the "Custom" tab / template gen).
 * ---------------------------------------------------------------------------
 * A form-driven editor for composing your own checklist — title, title-block
 * fields, process toggles, and sections of taggable items — with a LIVE
 * preview rendered by the real engine (checklist.js). You can:
 *   - Save it to this browser (it then appears on the Checklists hub and opens
 *     via run.html?id=<slug>)
 *   - Export it as a standalone .html file to drop into checklists/ and commit
 *   - Export / import the definition as JSON
 * A working draft autosaves so a reload never loses in-progress work.
 *
 * The definition object it edits is exactly the engine's CHECKLIST contract:
 *   { id, title, subtitle, fields:[…], processes:[{key,label}],
 *     sections:[ { name, tags:[key], items:[ {label,hint,tags:[key]} ] } ] }
 * ------------------------------------------------------------------------- */
(function () {
  "use strict";

  var REG = "toolbox-checklist-defs";
  var DRAFT = "toolbox-checklist-builder-draft";
  var toast = (window.TOOLBOX_CHECKLIST && window.TOOLBOX_CHECKLIST.toast) || function () {};

  // ---- storage helpers ---------------------------------------------------
  function readReg() { try { return JSON.parse(localStorage.getItem(REG) || "[]"); } catch (e) { return []; } }
  function writeReg(a) { try { localStorage.setItem(REG, JSON.stringify(a)); } catch (e) {} }
  function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify(def)); } catch (e) {} }

  function slug(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "checklist";
  }
  function uniqueKey(base, existing) {
    var k = slug(base), n = 2;
    while (existing.indexOf(k) >= 0) { k = slug(base) + "-" + n; n++; }
    return k;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- the definition being edited --------------------------------------
  function newDef() {
    return {
      id: "", title: "", subtitle: "",
      fields: ["Drawing No.", "Revision", "Checked by", "Date"],
      processes: [],
      sections: [ { name: "Section 1", tags: [], items: [ { label: "", hint: "", tags: [] } ] } ]
    };
  }
  function ensureShape(d) {
    d.fields = d.fields || [];
    d.processes = (d.processes || []).map(function (p) {
      return typeof p === "string" ? { key: slug(p), label: p } : { key: p.key || slug(p.label), label: p.label || p.key };
    });
    d.sections = (d.sections || []).map(function (s) {
      return {
        name: s.name || "", tags: s.tags || [],
        items: (s.items || []).map(function (it) {
          return typeof it === "string" ? { label: it, hint: "", tags: [] }
            : { label: it.label || "", hint: it.hint || "", tags: it.tags || [] };
        })
      };
    });
    return d;
  }

  var params = new URLSearchParams(location.search);
  var openId = params.get("id");
  var def;
  if (openId) {
    var found = readReg().filter(function (d) { return d && d.id === openId; })[0];
    def = found ? ensureShape(clone(found)) : ensureShape(newDef());
  } else {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT) || "null"); } catch (e) {}
    def = draft ? ensureShape(draft) : ensureShape(newDef());
  }

  // ---- engine-ready copy (drops empties, stabilises tags) ----------------
  function clean(d) {
    var procs = (d.processes || []).filter(function (p) { return p.label && p.label.trim(); })
      .map(function (p) { return { key: p.key, label: p.label.trim() }; });
    var keys = procs.map(function (p) { return p.key; });
    function fixTags(tags) { return (tags || []).filter(function (t) { return keys.indexOf(t) >= 0; }); }
    var sections = (d.sections || []).map(function (s) {
      return {
        name: (s.name || "").trim(),
        tags: fixTags(s.tags),
        items: (s.items || []).filter(function (it) { return it.label && it.label.trim(); })
          .map(function (it) {
            var o = { label: it.label.trim() };
            if (it.hint && it.hint.trim()) o.hint = it.hint.trim();
            var itags = fixTags(it.tags);
            if (itags.length) o.tags = itags;
            return o;
          })
      };
    }).filter(function (s) { return s.name || s.items.length; });
    var out = {
      id: slug(d.id || d.title),
      title: (d.title || "Untitled checklist").trim(),
      fields: (d.fields || []).map(function (f) { return (f || "").trim(); }).filter(Boolean),
      sections: sections
    };
    if (d.subtitle && d.subtitle.trim()) out.subtitle = d.subtitle.trim();
    if (procs.length) out.processes = procs;
    return out;
  }

  // ---- DOM helpers -------------------------------------------------------
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function textInput(value, ph, oninput) {
    var i = el("input", "b-input"); i.type = "text"; i.value = value || ""; if (ph) i.placeholder = ph;
    i.addEventListener("input", function () { oninput(i.value); });
    return i;
  }
  function iconBtn(label, title, fn, cls) {
    var b = el("button", "b-icon" + (cls ? " " + cls : ""), label); b.type = "button"; b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", fn); return b;
  }
  function card(titleTxt) {
    var c = el("div", "b-card");
    var h = el("div", "b-card-head");
    h.appendChild(el("span", "b-card-title", titleTxt));
    c.appendChild(h); c._head = h; return c;
  }
  function move(arr, i, dir) {
    var j = i + dir; if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }

  var editor, preview, api = null, previewTimer = null;

  function changed() { saveDraft(); schedulePreview(); }
  function structuralChange() { saveDraft(); renderEditor(); schedulePreview(); }
  function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 220); }
  function renderPreview() {
    if (api) { api.destroy(); api = null; }
    var data = clean(def);
    api = window.TOOLBOX_CHECKLIST.mount(preview, data, { persist: false, hideToolbar: true });
  }

  // ---- editor sections ---------------------------------------------------
  function metaCard() {
    var c = card("Checklist");
    var g = el("div", "b-grid2");
    g.appendChild(labelled("Title", textInput(def.title, "e.g. Casting Drawing Checklist", function (v) { def.title = v; changed(); syncSlug(); })));
    var idIn = textInput(def.id, slug(def.title || "checklist"), function (v) { def.id = v; changed(); });
    idIn._auto = true;
    c._idInput = idIn;
    g.appendChild(labelled("Save name (slug)", idIn));
    c.appendChild(g);
    var sub = el("textarea", "b-input b-textarea"); sub.rows = 2; sub.value = def.subtitle || "";
    sub.placeholder = "One-line description (optional)";
    sub.addEventListener("input", function () { def.subtitle = sub.value; changed(); });
    c.appendChild(labelled("Subtitle", sub));
    return c;
    function syncSlug() { if (idIn._auto && !def.id) idIn.placeholder = slug(def.title || "checklist"); }
  }
  function labelled(text, control) {
    var w = el("label", "b-labelled");
    w.appendChild(el("span", "b-label", text));
    w.appendChild(control);
    return w;
  }

  function fieldsCard() {
    var c = card("Title-block fields");
    c._head.appendChild(addBtn("+ Field", function () { def.fields.push(""); structuralChange(); }));
    if (!def.fields.length) c.appendChild(el("p", "b-empty", "No fields. These are the free-text boxes at the top of the sheet (drawing no., rev…)."));
    def.fields.forEach(function (f, i) {
      var row = el("div", "b-row");
      row.appendChild(textInput(f, "Field label", function (v) { def.fields[i] = v; changed(); }));
      row.appendChild(iconBtn("↑", "Move up", function () { move(def.fields, i, -1); structuralChange(); }));
      row.appendChild(iconBtn("↓", "Move down", function () { move(def.fields, i, 1); structuralChange(); }));
      row.appendChild(iconBtn("×", "Remove field", function () { def.fields.splice(i, 1); structuralChange(); }, "is-danger"));
      c.appendChild(row);
    });
    return c;
  }

  function processesCard() {
    var c = card("Processes (toggle chips)");
    c._head.appendChild(addBtn("+ Process", function () {
      var keys = def.processes.map(function (p) { return p.key; });
      def.processes.push({ key: uniqueKey("process", keys), label: "" });
      structuralChange();
    }));
    if (!def.processes.length) c.appendChild(el("p", "b-empty", "No processes. Add e.g. Sheet Metal, Welding, Machining — then tag sections/items so they can be toggled on and off."));
    def.processes.forEach(function (p, i) {
      var row = el("div", "b-row");
      row.appendChild(textInput(p.label, "Process name", function (v) { p.label = v; changed(); relabelChips(p.key, v); }));
      row.appendChild(iconBtn("↑", "Move up", function () { move(def.processes, i, -1); structuralChange(); }));
      row.appendChild(iconBtn("↓", "Move down", function () { move(def.processes, i, 1); structuralChange(); }));
      row.appendChild(iconBtn("×", "Remove process", function () {
        var key = def.processes[i].key;
        def.processes.splice(i, 1);
        // strip this key from every section/item tag list
        def.sections.forEach(function (s) {
          s.tags = (s.tags || []).filter(function (t) { return t !== key; });
          (s.items || []).forEach(function (it) { it.tags = (it.tags || []).filter(function (t) { return t !== key; }); });
        });
        structuralChange();
      }, "is-danger"));
      c.appendChild(row);
    });
    return c;
  }

  function tagChips(tagsArr, labelText) {
    // a compact chip row that toggles process keys in tagsArr
    if (!def.processes.length) return null;
    var wrap = el("div", "b-tags");
    if (labelText) wrap.appendChild(el("span", "b-tags-label", labelText));
    def.processes.forEach(function (p) {
      var on = tagsArr.indexOf(p.key) >= 0;
      var chip = el("button", "b-tag" + (on ? " is-on" : ""), p.label || p.key);
      chip.type = "button";
      chip.dataset.key = p.key;
      chip.addEventListener("click", function () {
        var idx = tagsArr.indexOf(p.key);
        if (idx >= 0) tagsArr.splice(idx, 1); else tagsArr.push(p.key);
        structuralChange();
      });
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function sectionsCard() {
    var c = card("Sections & items");
    c._head.appendChild(addBtn("+ Section", function () {
      def.sections.push({ name: "New section", tags: [], items: [ { label: "", hint: "", tags: [] } ] });
      structuralChange();
    }));
    def.sections.forEach(function (s, si) {
      var sc = el("div", "b-section");
      var top = el("div", "b-row b-section-top");
      var nameIn = textInput(s.name, "Section name", function (v) { s.name = v; changed(); });
      nameIn.classList.add("b-section-name");
      top.appendChild(nameIn);
      top.appendChild(iconBtn("↑", "Move section up", function () { move(def.sections, si, -1); structuralChange(); }));
      top.appendChild(iconBtn("↓", "Move section down", function () { move(def.sections, si, 1); structuralChange(); }));
      top.appendChild(iconBtn("×", "Remove section", function () { def.sections.splice(si, 1); structuralChange(); }, "is-danger"));
      sc.appendChild(top);

      var secTags = tagChips(s.tags, "Applies to");
      if (secTags) {
        var hint = el("span", "b-inherit-note", s.tags.length ? "" : "(untagged = always shown)");
        secTags.appendChild(hint);
        sc.appendChild(secTags);
      }

      (s.items || []).forEach(function (it, ii) {
        var item = el("div", "b-item");
        var r1 = el("div", "b-row");
        r1.appendChild(textInput(it.label, "Item — what to check", function (v) { it.label = v; changed(); }));
        r1.appendChild(iconBtn("↑", "Move item up", function () { move(s.items, ii, -1); structuralChange(); }));
        r1.appendChild(iconBtn("↓", "Move item down", function () { move(s.items, ii, 1); structuralChange(); }));
        r1.appendChild(iconBtn("×", "Remove item", function () { s.items.splice(ii, 1); structuralChange(); }, "is-danger"));
        item.appendChild(r1);
        var hintIn = textInput(it.hint, "Hint / sub-line (optional)", function (v) { it.hint = v; changed(); });
        hintIn.classList.add("b-hint-input");
        item.appendChild(hintIn);
        var itTags = tagChips(it.tags, "Only");
        if (itTags) {
          itTags.appendChild(el("span", "b-inherit-note", it.tags.length ? "(overrides section)" : "(inherits section)"));
          item.appendChild(itTags);
        }
        sc.appendChild(item);
      });

      sc.appendChild(addBtn("+ Item", function () { s.items.push({ label: "", hint: "", tags: [] }); structuralChange(); }, "b-add-item"));
      c.appendChild(sc);
    });
    return c;
  }

  function relabelChips(key, label) {
    var chips = document.querySelectorAll('.b-tag[data-key="' + key + '"]');
    for (var i = 0; i < chips.length; i++) chips[i].textContent = label || key;
  }

  function addBtn(text, fn, cls) {
    var b = el("button", "b-add" + (cls ? " " + cls : ""), text); b.type = "button";
    b.addEventListener("click", fn); return b;
  }

  function renderEditor() {
    editor.innerHTML = "";
    editor.appendChild(metaCard());
    editor.appendChild(fieldsCard());
    editor.appendChild(processesCard());
    editor.appendChild(sectionsCard());
  }

  // ---- toolbar actions ---------------------------------------------------
  function doSave() {
    if (!def.title || !def.title.trim()) { toast("Give the checklist a title first"); return; }
    var d = clean(def);
    def.id = d.id; // lock in the slug
    var reg = readReg();
    var idx = reg.map(function (x) { return x.id; }).indexOf(d.id);
    if (idx >= 0) reg[idx] = d; else reg.push(d);
    writeReg(reg);
    saveDraft();
    renderEditor();
    toast(idx >= 0 ? "Updated — on the Checklists page" : "Saved — now on the Checklists page");
  }
  function doNew() {
    if (!window.confirm("Start a new blank checklist? Unsaved edits to the current one will be cleared from the editor.")) return;
    def = ensureShape(newDef());
    try { localStorage.removeItem(DRAFT); } catch (e) {}
    renderEditor(); renderPreview();
  }
  function doDelete() {
    var d = clean(def);
    var reg = readReg();
    var idx = reg.map(function (x) { return x.id; }).indexOf(d.id);
    if (idx < 0) { toast("This checklist isn't saved yet"); return; }
    if (!window.confirm('Delete the saved checklist "' + d.title + '" from this browser? (Any exported .html file is untouched.)')) return;
    reg.splice(idx, 1); writeReg(reg);
    toast("Deleted from this browser");
    populateOpen();
  }
  function doExportJSON() {
    var d = clean(def);
    download(d.id + ".json", JSON.stringify(d, null, 2), "application/json");
  }
  function doExportHTML() {
    var d = clean(def);
    download(d.id + ".html", standaloneHTML(d), "text/html");
    toast("Exported — drop it in checklists/ and commit");
  }
  function doImport(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        def = ensureShape(obj);
        saveDraft(); renderEditor(); renderPreview();
        toast("Imported");
      } catch (e) { toast("That file isn't valid checklist JSON"); }
    };
    reader.readAsText(file);
  }
  function doOpen(id) {
    var found = readReg().filter(function (x) { return x.id === id; })[0];
    if (!found) return;
    def = ensureShape(clone(found));
    saveDraft(); renderEditor(); renderPreview();
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  // ---- standalone HTML export -------------------------------------------
  function standaloneHTML(d) {
    var title = (d.title || "Checklist").replace(/</g, "&lt;");
    var json = JSON.stringify(d, null, 2);
    return [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="UTF-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
      '<meta name="description" content="' + title + ' — a TOOLBOX checklist." />',
      "<title>" + title + " — TOOLBOX</title>",
      '<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">',
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" media="print" onload="this.media=\'all\'">',
      '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap"></noscript>',
      '<link rel="stylesheet" href="checklist.css">',
      '<script src="../assets/theme.js"><\/script>',
      '<script src="../assets/reveal.js"><\/script>',
      "</head>",
      "<body>",
      "<header>",
      '  <a class="brand" href="../index.html" aria-label="TOOLBOX home">',
      '    <span class="mark" aria-hidden="true">',
      '      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round">',
      '        <polygon points="50,10 85,30 85,70 50,90 15,70 15,30"/>',
      '        <circle cx="50" cy="50" r="17"/>',
      "      </svg>",
      "    </span>",
      '    <span class="wordmark">TO<b>O</b>LBOX</span>',
      "  </a>",
      '  <div class="meta">Checklists</div>',
      "</header>",
      "<main>",
      '  <div class="shell">',
      '    <a class="up-link" href="index.html"><span aria-hidden="true">&larr;</span> All checklists</a>',
      '    <div id="checklist-root"></div>',
      "  </div>",
      "</main>",
      "<footer>",
      '  TOOLBOX &middot; Checklists &middot; <a href="https://github.com/technicallytechnicaldesign/TOOLBOX">github.com/technicallytechnicaldesign/TOOLBOX</a>',
      "</footer>",
      "<script>",
      "window.CHECKLIST = " + json + ";",
      "<\/script>",
      '<script src="checklist.js"><\/script>',
      '<script src="../assets/menu.js"><\/script>',
      "</body>",
      "</html>",
      ""
    ].join("\n");
  }

  // ---- open dropdown -----------------------------------------------------
  var openSelect;
  function populateOpen() {
    if (!openSelect) return;
    var reg = readReg();
    openSelect.innerHTML = "";
    var first = el("option", null, reg.length ? "Open saved…" : "No saved checklists");
    first.value = ""; openSelect.appendChild(first);
    reg.forEach(function (d) {
      var o = el("option", null, d.title || d.id); o.value = d.id; openSelect.appendChild(o);
    });
  }

  // ---- wire up -----------------------------------------------------------
  function init() {
    editor = document.getElementById("builder-editor");
    preview = document.getElementById("checklist-root");

    document.getElementById("b-save").addEventListener("click", doSave);
    document.getElementById("b-new").addEventListener("click", doNew);
    document.getElementById("b-delete").addEventListener("click", doDelete);
    document.getElementById("b-export-html").addEventListener("click", doExportHTML);
    document.getElementById("b-export-json").addEventListener("click", doExportJSON);

    var fileIn = document.getElementById("b-import-file");
    document.getElementById("b-import").addEventListener("click", function () { fileIn.click(); });
    fileIn.addEventListener("change", function () { if (fileIn.files[0]) doImport(fileIn.files[0]); fileIn.value = ""; });

    openSelect = document.getElementById("b-open");
    openSelect.addEventListener("change", function () { if (openSelect.value) doOpen(openSelect.value); });
    populateOpen();

    renderEditor();
    renderPreview();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
