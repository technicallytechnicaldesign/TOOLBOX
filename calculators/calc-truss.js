// Warren Truss — Ritter Method (id: warren-truss-ritter).
// Ported from the verified "Gitter 02 Solver" workbook in the Coursework
// project. The calculator keeps the workbook's exact repeating topology:
// n bottom chords + 2n diagonals + (n - 1) top chords = 4n - 1 members.
// Downward joint loads are positive; positive member force means tension.

function trussMember(id, group, from, to, force) {
  var eps = 1e-8;
  return {
    id: id,
    group: group,
    from: from,
    to: to,
    force: Math.abs(force) < eps ? 0 : force,
    state: Math.abs(force) < eps ? "zero" : (force > 0 ? "tension" : "compression"),
  };
}

function trussCompute(v) {
  var memberCount = Math.round(v.memberCount);
  var n = (memberCount + 1) / 4;
  var valid = Number.isInteger(n) && n >= 1 && n <= 10 && v.b > 0 && v.h > 0;
  if (!valid) {
    return { valid: false, message: "Choose 3–39 members and enter a positive bay width and height." };
  }

  var loads = [];
  for (var i = 0; i < n; i++) loads.push(Number(v.loads[i]) || 0);
  var span = n * v.b;
  var angle = Math.atan2(v.h, v.b / 2);
  var sinAngle = Math.sin(angle);
  var totalLoad = loads.reduce(function (sum, p) { return sum + p; }, 0);
  var momentAboutA = loads.reduce(function (sum, p, i) {
    return sum + p * (i + 0.5) * v.b;
  }, 0);
  var VB = momentAboutA / span;
  var VA = totalLoad - VB;
  var members = [];
  var cumulative = 0;
  var maxForce = 0;

  function loadMomentAt(x) {
    var m = 0;
    for (var j = 0; j < n; j++) {
      var loadX = (j + 0.5) * v.b;
      if (loadX < x) m += loads[j] * (x - loadX);
    }
    return m;
  }

  for (var bay = 1; bay <= n; bay++) {
    var upperX = (bay - 0.5) * v.b;
    var upperMoment = VA * upperX - loadMomentAt(upperX);
    var bottomForce = upperMoment / v.h;
    var leftDiagonal = -(VA - cumulative) / sinAngle;
    cumulative += loads[bay - 1];
    var rightDiagonal = (VA - cumulative) / sinAngle;

    members.push(trussMember("B" + bay, "bottom", "L" + (bay - 1), "L" + bay, bottomForce));
    members.push(trussMember("D" + (2 * bay - 1), "diagonal", "L" + (bay - 1), "U" + bay, leftDiagonal));
    members.push(trussMember("D" + (2 * bay), "diagonal", "U" + bay, "L" + bay, rightDiagonal));

    if (bay < n) {
      var lowerX = bay * v.b;
      var lowerMoment = VA * lowerX - loadMomentAt(lowerX);
      members.push(trussMember("T" + bay, "top", "U" + bay, "U" + (bay + 1), -lowerMoment / v.h));
    }
  }

  members.forEach(function (m) { maxForce = Math.max(maxForce, Math.abs(m.force)); });

  // Independent joint-force residuals observe the section-method results.
  // They never feed the solution, so a formula error cannot make its own
  // equilibrium check pass.
  var joints = {};
  function addJoint(id, x, y) { joints[id] = { id: id, x: x, y: y, fx: 0, fy: 0 }; }
  for (i = 0; i <= n; i++) addJoint("L" + i, i * v.b, 0);
  for (i = 1; i <= n; i++) addJoint("U" + i, (i - 0.5) * v.b, v.h);
  joints.L0.fy += VA;
  joints["L" + n].fy += VB;
  loads.forEach(function (p, idx) { joints["U" + (idx + 1)].fy -= p; });
  members.forEach(function (m) {
    var a = joints[m.from], b = joints[m.to];
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    var fx = m.force * dx / len, fy = m.force * dy / len;
    a.fx += fx; a.fy += fy;
    b.fx -= fx; b.fy -= fy;
  });
  var residual = 0;
  Object.keys(joints).forEach(function (id) {
    residual = Math.max(residual, Math.abs(joints[id].fx), Math.abs(joints[id].fy));
  });

  return {
    valid: true,
    n: n,
    memberCount: memberCount,
    span: span,
    angle: angle * 180 / Math.PI,
    loads: loads,
    totalLoad: totalLoad,
    VA: VA,
    VB: VB,
    HB: 0,
    members: members,
    joints: joints,
    maxForce: maxForce,
    residual: residual,
    verticalCheck: VA + VB - totalLoad,
    momentCheck: VB * span - momentAboutA,
  };
}

function trussDiagram(root, v, out) {
  var n = out.n;
  var plotW = Math.max(620, n * 96 + 120);
  var H = 330, left = 60, right = 60, yTop = 92, yBottom = 226;
  var usable = plotW - left - right;
  var bayPx = usable / n;
  var maxLoad = Math.max(1e-9, Math.max.apply(null, out.loads.map(function (p) { return Math.abs(p); })));
  var maxForce = Math.max(1e-9, out.maxForce);

  function sx(x) { return left + (x / out.span) * usable; }
  function sy(y) { return yBottom - (y / v.h) * (yBottom - yTop); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function memberClass(m) { return "truss-member " + m.state + " " + m.group; }
  function memberWidth(m) { return (2 + 3.5 * Math.abs(m.force) / maxForce).toFixed(2); }

  var svg = '<svg class="truss-svg" style="min-width:' + plotW + 'px" viewBox="0 0 ' + plotW + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="truss-title truss-desc">';
  svg += '<title id="truss-title">' + n + '-bay Warren truss force diagram</title>';
  svg += '<desc id="truss-desc">Members are coloured by axial state: blue for tension, red for compression, grey for zero. Loads act at upper joints.</desc>';
  svg += '<defs><marker id="load-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" class="truss-load-fill"/></marker><marker id="reaction-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" class="truss-reaction-fill"/></marker></defs>';
  svg += '<line class="truss-ground" x1="' + (left - 26) + '" y1="' + (yBottom + 28) + '" x2="' + (plotW - right + 26) + '" y2="' + (yBottom + 28) + '"/>';

  out.members.forEach(function (m) {
    var a = out.joints[m.from], b = out.joints[m.to];
    var x1 = sx(a.x), y1 = sy(a.y), x2 = sx(b.x), y2 = sy(b.y);
    svg += '<line class="' + memberClass(m) + '" style="stroke-width:' + memberWidth(m) + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"><title>' + esc(m.id + ': ' + fmt(m.force, 4) + ' kN, ' + m.state) + '</title></line>';
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var labelY = my + (m.group === "bottom" ? 18 : (m.group === "top" ? -10 : (m.id.replace(/\D/g, "") % 2 ? -8 : 15)));
    var label = m.id + (n <= 5 ? " " + fmt(m.force, 3) : "");
    svg += '<text class="truss-member-label ' + m.state + '" x="' + mx.toFixed(1) + '" y="' + labelY.toFixed(1) + '" text-anchor="middle">' + esc(label) + '</text>';
  });

  for (var i = 0; i <= n; i++) {
    var lx = sx(i * v.b);
    svg += '<circle class="truss-joint" cx="' + lx.toFixed(1) + '" cy="' + yBottom + '" r="4.5"/>';
    svg += '<text class="truss-joint-label" x="' + lx.toFixed(1) + '" y="' + (yBottom + 44) + '" text-anchor="middle">L' + i + '</text>';
  }
  for (i = 1; i <= n; i++) {
    var ux = sx((i - 0.5) * v.b);
    var load = out.loads[i - 1];
    var arrow = 26 + 20 * Math.abs(load) / maxLoad;
    var arrowTop = yTop - arrow - 16;
    if (Math.abs(load) > 1e-9) {
      var y1 = load > 0 ? arrowTop : yTop - 8;
      var y2 = load > 0 ? yTop - 8 : arrowTop;
      svg += '<line class="truss-load" x1="' + ux.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + ux.toFixed(1) + '" y2="' + y2.toFixed(1) + '" marker-end="url(#load-arrow)"/>';
    }
    svg += '<text class="truss-load-label" x="' + ux.toFixed(1) + '" y="' + (arrowTop - 7).toFixed(1) + '" text-anchor="middle">P' + i + ' ' + fmt(load, 3) + ' kN</text>';
    svg += '<circle class="truss-joint" cx="' + ux.toFixed(1) + '" cy="' + yTop + '" r="4.5"/>';
    svg += '<text class="truss-joint-label" x="' + ux.toFixed(1) + '" y="' + (yTop + 22) + '" text-anchor="middle">U' + i + '</text>';
  }

  svg += '<path class="truss-support" d="M' + left + ',' + (yBottom + 6) + ' l-13,20 h26 z"/>';
  svg += '<circle class="truss-support-wheel" cx="' + (left - 7) + '" cy="' + (yBottom + 31) + '" r="3.5"/><circle class="truss-support-wheel" cx="' + (left + 7) + '" cy="' + (yBottom + 31) + '" r="3.5"/>';
  var bx = plotW - right;
  svg += '<path class="truss-support" d="M' + bx + ',' + (yBottom + 6) + ' l-13,20 h26 z"/>';
  svg += '<line class="truss-reaction" x1="' + (left - 29) + '" y1="' + (yBottom + 23) + '" x2="' + (left - 29) + '" y2="' + (yBottom - 24) + '" marker-end="url(#reaction-arrow)"/>';
  svg += '<text class="truss-reaction-label" x="' + (left - 34) + '" y="' + (yBottom - 29) + '" text-anchor="end">VA ' + fmt(out.VA, 3) + '</text>';
  svg += '<line class="truss-reaction" x1="' + (bx + 29) + '" y1="' + (yBottom + 23) + '" x2="' + (bx + 29) + '" y2="' + (yBottom - 24) + '" marker-end="url(#reaction-arrow)"/>';
  svg += '<text class="truss-reaction-label" x="' + (bx + 34) + '" y="' + (yBottom - 29) + '">VB ' + fmt(out.VB, 3) + '</text>';
  svg += '<line class="truss-dimension" x1="' + left + '" y1="' + (H - 17) + '" x2="' + (left + bayPx) + '" y2="' + (H - 17) + '"/><text class="truss-dimension-label" x="' + (left + bayPx / 2) + '" y="' + (H - 23) + '" text-anchor="middle">b = ' + fmt(v.b, 4) + ' mm</text>';
  svg += '<line class="truss-dimension" x1="' + (plotW - 22) + '" y1="' + yTop + '" x2="' + (plotW - 22) + '" y2="' + yBottom + '"/><text class="truss-dimension-label" x="' + (plotW - 29) + '" y="' + ((yTop + yBottom) / 2) + '" text-anchor="end">h = ' + fmt(v.h, 4) + ' mm</text>';
  svg += '</svg>';
  root.innerHTML = svg;
}

function trussMemberGroup(root, title, members) {
  var section = document.createElement("section");
  section.className = "truss-member-section";
  var heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);
  var grid = document.createElement("div");
  grid.className = "truss-member-grid";
  members.forEach(function (m) {
    var card = document.createElement("div");
    card.className = "truss-member-card " + m.state;
    card.innerHTML = '<div class="truss-member-name"><b>' + m.id + '</b><span>' + m.from + ' → ' + m.to + '</span></div>' +
      '<div class="truss-member-force">' + fmt(m.force, 4) + ' <span>kN</span></div>' +
      '<div class="truss-member-state">' + (m.state === "tension" ? "Tension / Træk" : (m.state === "compression" ? "Compression / Tryk" : "Zero force")) + '</div>';
    grid.appendChild(card);
  });
  section.appendChild(grid);
  root.appendChild(section);
}

function trussEscapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function trussReportHTML(v, out, diagramMarkup, generatedAt) {
  var made = generatedAt instanceof Date ? generatedAt : new Date();
  var dateLabel = made.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  var stateLabel = function (state) {
    return state === "tension" ? "Tension / Træk" : (state === "compression" ? "Compression / Tryk" : "Zero force");
  };
  var rows = out.members.map(function (m) {
    return '<tr><td><b>' + trussEscapeHTML(m.id) + '</b></td><td>' + trussEscapeHTML(m.group) + '</td><td>' +
      trussEscapeHTML(m.from) + ' → ' + trussEscapeHTML(m.to) + '</td><td class="num ' + m.state + '">' +
      trussEscapeHTML(fmt(m.force, 5)) + '</td><td>' + stateLabel(m.state) + '</td></tr>';
  }).join("");
  var loadRows = out.loads.map(function (load, i) {
    return '<tr><td>P' + (i + 1) + '</td><td>U' + (i + 1) + '</td><td class="num">' +
      trussEscapeHTML(fmt((i + 0.5) * v.b, 6)) + '</td><td class="num">' + trussEscapeHTML(fmt(load, 5)) + '</td></tr>';
  }).join("");
  var residualPass = out.residual < 1e-7;
  var safeDiagram = String(diagramMarkup || "");

  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Warren Truss: Ritter Analysis Report</title>' +
    '<style>' +
    ':root{--ink:#10202f;--muted:#5d6b78;--line:#cbd5df;--panel:#f2f6f9;--blue:#1679ae;--red:#bd3a35;--teal:#117c82;--green:#337a53}' +
    '*{box-sizing:border-box}body{margin:0;background:#dfe7ed;color:var(--ink);font:13px/1.45 Arial,sans-serif}' +
    'main{width:min(1080px,calc(100% - 32px));margin:24px auto;background:#fff;padding:34px 40px;box-shadow:0 8px 30px #17324a24}' +
    'header{display:flex;justify-content:space-between;gap:24px;padding-bottom:18px;border-bottom:3px solid var(--blue)}' +
    '.eyebrow,.kicker{font:700 10px/1.2 "Courier New",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}' +
    'h1{font-size:29px;line-height:1.05;margin:7px 0 8px}h2{font-size:15px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}' +
    'p{margin:5px 0;color:var(--muted)}.meta{text-align:right;font:11px/1.5 "Courier New",monospace;color:var(--muted)}' +
    '.print{margin-top:10px;border:1px solid var(--ink);background:#fff;color:var(--ink);padding:7px 10px;cursor:pointer;font:700 10px "Courier New",monospace;text-transform:uppercase}' +
    '.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);margin-top:18px}' +
    '.card{background:var(--panel);padding:12px}.card span{display:block;color:var(--muted);font:9px "Courier New",monospace;text-transform:uppercase;letter-spacing:.06em}.card b{display:block;margin-top:5px;font:700 17px "Courier New",monospace}' +
    '.diagram{border:1px solid var(--line);padding:10px;overflow:hidden}.diagram svg{display:block;width:100%;height:auto;min-width:0!important}' +
    '.truss-member{fill:none;stroke-linecap:round}.truss-member.tension{stroke:var(--blue)}.truss-member.compression{stroke:var(--red)}.truss-member.zero{stroke:#8b98a4}' +
    '.truss-member-label,.truss-joint-label,.truss-load-label,.truss-reaction-label,.truss-dimension-label{font:9px "Courier New",monospace;fill:var(--muted)}' +
    '.truss-member-label.tension{fill:var(--blue)}.truss-member-label.compression{fill:var(--red)}.truss-joint{fill:var(--ink);stroke:#fff;stroke-width:2px}' +
    '.truss-load{stroke:var(--red);stroke-width:1.7px}.truss-load-fill{fill:var(--red)}.truss-load-label{fill:var(--red)}' +
    '.truss-reaction{stroke:var(--teal);stroke-width:1.7px}.truss-reaction-fill{fill:var(--teal)}.truss-reaction-label{fill:var(--teal)}' +
    '.truss-support{fill:var(--panel);stroke:var(--ink);stroke-width:1.5px}.truss-support-wheel{fill:#fff;stroke:var(--ink);stroke-width:1.3px}.truss-ground,.truss-dimension{stroke:var(--line);stroke-width:1px}.truss-dimension{stroke-dasharray:3 3}' +
    '.legend{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0 18px;font:10px "Courier New",monospace;color:var(--muted)}.legend i{display:inline-block;width:20px;height:3px;margin-right:6px;vertical-align:middle}.legend .t{background:var(--blue)}.legend .c{background:var(--red)}.legend .z{background:#8b98a4}' +
    'table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:7px 8px;border:1px solid var(--line);text-align:left}th{background:var(--panel);font:700 9px "Courier New",monospace;letter-spacing:.06em;text-transform:uppercase}.num{text-align:right;font-family:"Courier New",monospace}.num.tension{color:var(--blue);font-weight:700}.num.compression{color:var(--red);font-weight:700}' +
    '.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}.check{display:inline-block;padding:3px 7px;border:1px solid var(--green);color:var(--green);font:700 9px "Courier New",monospace;text-transform:uppercase}' +
    '.note{border-left:3px solid var(--teal);background:var(--panel);padding:11px 13px;color:var(--muted)}footer{margin-top:28px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font:9px "Courier New",monospace}' +
    '@media(max-width:720px){main{width:100%;margin:0;padding:22px 18px}.cards{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}header{display:block}.meta{text-align:left;margin-top:14px}}' +
    '@media print{body{background:#fff}main{width:100%;margin:0;padding:0;box-shadow:none}.print{display:none}h2{break-after:avoid}.diagram,.cards{break-inside:avoid}thead{display:table-header-group}tr{break-inside:avoid}a{color:inherit}}' +
    '</style></head><body><main>' +
    '<header><div><div class="eyebrow">TOOLBOX · STATICS REPORT</div><h1>Warren Truss: Ritter Method</h1><p>Force analysis for an ideal pin-jointed truss.</p></div>' +
    '<div class="meta">Generated ' + trussEscapeHTML(dateLabel) + '<br>' + out.n + ' bays · ' + out.memberCount + ' members<br><button class="print" onclick="window.print()">Print / save PDF</button></div></header>' +
    '<div class="cards"><div class="card"><span>Left reaction</span><b>VA ' + trussEscapeHTML(fmt(out.VA, 5)) + ' kN</b></div>' +
    '<div class="card"><span>Right reaction</span><b>VB ' + trussEscapeHTML(fmt(out.VB, 5)) + ' kN</b></div>' +
    '<div class="card"><span>Horizontal reaction</span><b>HB ' + trussEscapeHTML(fmt(out.HB, 5)) + ' kN</b></div>' +
    '<div class="card"><span>Total downward load</span><b>' + trussEscapeHTML(fmt(out.totalLoad, 5)) + ' kN</b></div></div>' +
    '<h2>01 · Force map</h2><div class="diagram">' + safeDiagram + '</div>' +
    '<div class="legend"><span><i class="t"></i>Tension / Træk (+)</span><span><i class="c"></i>Compression / Tryk (−)</span><span><i class="z"></i>Zero force</span><span>Line weight = relative force magnitude</span></div>' +
    '<div class="two"><section><h2>02 · Geometry</h2><table><tbody>' +
    '<tr><th>Bay width b</th><td class="num">' + trussEscapeHTML(fmt(v.b, 6)) + ' mm</td></tr>' +
    '<tr><th>Height h</th><td class="num">' + trussEscapeHTML(fmt(v.h, 6)) + ' mm</td></tr>' +
    '<tr><th>Span L</th><td class="num">' + trussEscapeHTML(fmt(out.span, 6)) + ' mm</td></tr>' +
    '<tr><th>Diagonal angle θ</th><td class="num">' + trussEscapeHTML(fmt(out.angle, 5)) + '°</td></tr></tbody></table></section>' +
    '<section><h2>03 · Equilibrium checks</h2><table><tbody>' +
    '<tr><th>ΣFy residual</th><td class="num">' + trussEscapeHTML(fmt(out.verticalCheck, 6)) + ' kN</td></tr>' +
    '<tr><th>ΣMA residual</th><td class="num">' + trussEscapeHTML(fmt(out.momentCheck, 6)) + ' kN·mm</td></tr>' +
    '<tr><th>Largest joint residual</th><td class="num">' + trussEscapeHTML(fmt(out.residual, 6)) + ' kN</td></tr></tbody></table>' +
    '<p><span class="check">' + (residualPass ? 'Equilibrium closes' : 'Review result') + '</span></p></section></div>' +
    '<h2>04 · Applied loads</h2><table><thead><tr><th>Load</th><th>Joint</th><th class="num">x from A (mm)</th><th class="num">Downward load (kN)</th></tr></thead><tbody>' + loadRows + '</tbody></table>' +
    '<h2>05 · All member forces</h2><table><thead><tr><th>Member</th><th>Group</th><th>Joints</th><th class="num">Force (kN)</th><th>State</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h2>06 · Method and scope</h2><div class="note"><b>Ritter section method.</b> Support reactions come from global ΣM = 0 and ΣFy = 0. Chord forces use section moment ÷ h; diagonal forces use joint vertical balance ÷ sin θ. Positive member force is tension; negative is compression. This is an idealised statics model only: it does not check buckling, section capacity, joints, welds, bolts, fatigue or code compliance.</div>' +
    '<footer>Generated by technicallytechnicaldesign.github.io/TOOLBOX · Warren Truss: Ritter Method</footer>' +
    '</main></body></html>';
}

function trussDownloadReport(v, out, diagramMarkup) {
  var html = trussReportHTML(v, out, diagramMarkup);
  var blob = new Blob([html], { type: "text/html;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  var stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = "warren-truss-ritter-report-" + stamp + ".html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 0);
}

var TRUSS_CALC = {
  id: "warren-truss-ritter",
  chip: "Statics",
  title: "Warren Truss — Ritter Method",
  why: "Turns the course workbook into a live force map: choose 1–10 Warren bays, load each upper joint, then read reactions and every member force directly on the truss.",
  refs: "Ritter section method; support reactions from ΣM = 0 and ΣFy = 0; ideal pin-jointed truss assumptions.",
  buildInputs: function (getVals, recompute) {
    var wrap = document.createElement("div");
    var loadCache = [4, 4, 4, 0, 0, 0, 0, 0, 0, 0];
    var loadFields = [];
    var memberOptions = [];
    for (var n = 1; n <= 10; n++) memberOptions.push([String(4 * n - 1), (4 * n - 1) + " members · " + n + (n === 1 ? " bay" : " bays")]);
    var memberCount = fieldSelect(wrap, "Truss size", memberOptions, "11", function () {
      loadFields.forEach(function (field, i) { loadCache[i] = field.value; });
      renderLoads();
      recompute();
    });
    var b = fieldNumber(wrap, "Bay width (b)", "mm", 2000, 1, function () {
      loadFields.forEach(function (field, i) { loadCache[i] = field.value; });
      renderLoads();
      recompute();
    });
    var h = fieldNumber(wrap, "Height (h)", "mm", 1000, 1, recompute);

    var loadHeading = document.createElement("h3");
    loadHeading.className = "truss-input-heading";
    loadHeading.textContent = "Upper-joint loads";
    wrap.appendChild(loadHeading);
    var note = document.createElement("div");
    note.className = "field-note truss-input-note";
    note.textContent = "Downward is positive. Use a negative value for an upward load.";
    wrap.appendChild(note);
    var loadHost = document.createElement("div");
    loadHost.className = "truss-load-grid";
    wrap.appendChild(loadHost);

    function renderLoads() {
      loadHost.innerHTML = "";
      loadFields = [];
      var bays = (parseInt(memberCount.value, 10) + 1) / 4;
      for (var i = 0; i < bays; i++) {
        (function (idx) {
          var x = (idx + 0.5) * b.value;
          var field = fieldNumber(loadHost, "P" + (idx + 1) + " at " + fmt(x, 4) + " mm", "kN", loadCache[idx], null, function () {
            loadCache[idx] = field.value;
            recompute();
          });
          loadFields.push(field);
        })(i);
      }
    }
    renderLoads();

    var scope = document.createElement("div");
    scope.className = "truss-scope-note";
    scope.innerHTML = '<b>Force analysis only.</b> This idealised statics model does not check member buckling, section capacity, joints, welds, bolts or code compliance.';
    wrap.appendChild(scope);

    getVals.get = function () {
      return {
        memberCount: parseInt(memberCount.value, 10),
        b: b.value,
        h: h.value,
        loads: loadFields.map(function (field) { return field.value; }),
      };
    };
    return wrap;
  },
  compute: trussCompute,
  buildOutputs: function (root, v, out) {
    root.innerHTML = "";
    if (!out.valid) {
      var invalid = document.createElement("div");
      invalid.className = "truss-scope-note error";
      invalid.textContent = out.message;
      root.appendChild(invalid);
      return;
    }

    var summary = document.createElement("div");
    summary.className = "truss-summary";
    outRow(summary, "Left reaction VA", fmt(out.VA, 4), "kN");
    outRow(summary, "Right reaction VB", fmt(out.VB, 4), "kN");
    outRow(summary, "Span", fmt(out.span, 5), "mm");
    outRow(summary, "Diagonal angle", fmt(out.angle, 4), "°");
    outRow(summary, "Largest member force", fmt(out.maxForce, 4), "kN", null, null, true);
    var residualGood = out.residual < 1e-7;
    var residualText = residualGood ? "< 0.000001" : fmt(out.residual, 3);
    outRow(summary, "Largest joint residual", residualText, "kN", residualGood ? "Joint equilibrium closes." : "Residual is larger than expected; review inputs.", residualGood ? "good" : "warn");
    root.appendChild(summary);

    var legend = document.createElement("div");
    legend.className = "truss-legend";
    legend.innerHTML = '<span><i class="tension"></i>Tension / Træk (+)</span><span><i class="compression"></i>Compression / Tryk (−)</span><span><i class="zero"></i>Zero force</span><span class="scale-note">Line weight = relative force magnitude</span>';
    root.appendChild(legend);

    var diagram = document.createElement("div");
    diagram.className = "diagram truss-diagram";
    root.appendChild(diagram);
    trussDiagram(diagram, v, out);
    var cap = document.createElement("div");
    cap.className = "cap truss-cap";
    cap.textContent = "Loads P1…Pn act at upper joints U1…Un. B = bottom chord, D = diagonal, T = top chord. Hover a member for its force.";
    root.appendChild(cap);

    var method = document.createElement("div");
    method.className = "truss-method";
    method.innerHTML = '<b>Ritter readout</b><span>Reactions from global equilibrium</span><span>Chord force = section moment ÷ h</span><span>Diagonal force = joint vertical balance ÷ sin θ</span>';
    root.appendChild(method);

    var reportBar = document.createElement("div");
    reportBar.style.display = "flex";
    reportBar.style.alignItems = "center";
    reportBar.style.flexWrap = "wrap";
    reportBar.style.gap = "10px";
    reportBar.style.marginTop = "16px";
    var reportBtn = document.createElement("button");
    reportBtn.type = "button";
    reportBtn.textContent = "↓ Export full report";
    reportBtn.style.background = "var(--c-accent)";
    reportBtn.style.border = "1px solid var(--c-accent)";
    reportBtn.style.color = "var(--bg)";
    reportBtn.style.fontFamily = "var(--font-mono)";
    reportBtn.style.fontSize = "11px";
    reportBtn.style.fontWeight = "700";
    reportBtn.style.textTransform = "uppercase";
    reportBtn.style.letterSpacing = "0.05em";
    reportBtn.style.padding = "9px 13px";
    reportBtn.style.cursor = "pointer";
    reportBtn.addEventListener("click", function () { trussDownloadReport(v, out, diagram.innerHTML); });
    reportBar.appendChild(reportBtn);
    var reportNote = document.createElement("span");
    reportNote.style.color = "var(--muted)";
    reportNote.style.fontFamily = "var(--font-mono)";
    reportNote.style.fontSize = "9px";
    reportNote.textContent = "Self-contained HTML · open anywhere · print / save as PDF";
    reportBar.appendChild(reportNote);
    root.appendChild(reportBar);

    trussMemberGroup(root, "Bottom chords", out.members.filter(function (m) { return m.group === "bottom"; }));
    trussMemberGroup(root, "Diagonal web", out.members.filter(function (m) { return m.group === "diagonal"; }));
    if (out.n > 1) trussMemberGroup(root, "Top chords", out.members.filter(function (m) { return m.group === "top"; }));
  },
};
