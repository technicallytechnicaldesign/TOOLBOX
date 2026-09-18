(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role="tabpanel"]'));
  var chaos = document.getElementById("chaos-button");

  function activate(key, focusTab, updateHash) {
    var activeTab = tabs.find(function (tab) { return tab.dataset.panel === key; }) || tabs[0];
    var activeKey = activeTab.dataset.panel;

    tabs.forEach(function (tab) {
      var selected = tab === activeTab;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.department !== activeKey;
    });

    if (focusTab) activeTab.focus();
    if (updateHash && history.replaceState) history.replaceState(null, "", "#" + activeKey);
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () { activate(tab.dataset.panel, false, true); });
    tab.addEventListener("keydown", function (event) {
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      activate(tabs[next].dataset.panel, true, true);
    });
  });

  chaos.addEventListener("click", function () {
    var games = Array.prototype.slice.call(document.querySelectorAll("[data-game]"));
    var game = games[Math.floor(Math.random() * games.length)];
    var panel = game.closest("[data-department]");
    activate(panel.dataset.department, false, true);
    games.forEach(function (card) { card.classList.remove("is-chosen"); });
    window.requestAnimationFrame(function () {
      game.classList.add("is-chosen");
      game.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  activate(location.hash.replace("#", ""), false, false);
  window.__edutaintment = { activate: activate };
})();
