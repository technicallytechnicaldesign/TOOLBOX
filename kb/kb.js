(function () {
  'use strict';

  var MODE_KEY = 'toolbox-kb-mode';
  var QUIZ_KEY = 'toolbox-kb-completed';
  var root = document.documentElement;

  function readMode() {
    try { return localStorage.getItem(MODE_KEY) === 'boring' ? 'boring' : 'goblin'; }
    catch (_) { return 'goblin'; }
  }

  function applyMode(mode) {
    root.dataset.kbMode = mode;
    document.querySelectorAll('[data-kb-toggle]').forEach(function (button) {
      var boring = mode === 'boring';
      button.textContent = boring ? 'Release the goblin' : 'Make it boring';
      button.setAttribute('aria-pressed', String(boring));
      button.setAttribute('title', boring ? 'Restore playful learning mode' : 'Show the dry factual version');
    });
    document.querySelectorAll('[data-fun][data-boring]').forEach(function (node) {
      node.textContent = mode === 'boring' ? node.dataset.boring : node.dataset.fun;
    });
  }

  function saveMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (_) {}
  }

  function completedIds() {
    try { return JSON.parse(localStorage.getItem(QUIZ_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function setCompleted(id) {
    var ids = completedIds();
    if (ids.indexOf(id) === -1) ids.push(id);
    try { localStorage.setItem(QUIZ_KEY, JSON.stringify(ids)); } catch (_) {}
    updateProgress(ids);
  }

  function updateProgress(ids) {
    var completed = ids || completedIds();
    document.querySelectorAll('[data-kb-progress]').forEach(function (node) {
      node.textContent = completed.length + ' field check' + (completed.length === 1 ? '' : 's') + ' survived';
    });
    document.querySelectorAll('[data-kb-reset]').forEach(function (button) {
      button.hidden = completed.length === 0;
    });
  }

  function wireChallenges() {
    document.querySelectorAll('.kb-challenge').forEach(function (challenge) {
      var feedback = challenge.querySelector('.kb-challenge-feedback');
      var id = challenge.dataset.challengeId;
      challenge.querySelectorAll('button[data-answer]').forEach(function (button) {
        button.addEventListener('click', function () {
          var correct = button.dataset.answer === challenge.dataset.correct;
          challenge.querySelectorAll('button[data-answer]').forEach(function (candidate) {
            candidate.classList.toggle('is-correct', candidate.dataset.answer === challenge.dataset.correct);
            candidate.classList.toggle('is-wrong', candidate === button && !correct);
          });
          feedback.textContent = correct ? challenge.dataset.success : challenge.dataset.retry;
          feedback.dataset.state = correct ? 'correct' : 'wrong';
          if (correct && id) setCompleted(id);
        });
      });
    });
  }

  function wireGames() {
    document.querySelectorAll('.kb-game').forEach(function (game) {
      var launch = game.querySelector('.kb-game-launch');
      var stage = game.querySelector('.kb-game-stage');
      if (!launch || !stage) return;
      launch.addEventListener('click', function () {
        if (stage.querySelector('iframe')) return;
        var frame = document.createElement('iframe');
        frame.src = game.dataset.gameSrc;
        frame.title = game.dataset.gameTitle || 'Embedded learning game';
        frame.loading = 'lazy';
        frame.allow = 'fullscreen';
        frame.setAttribute('allowfullscreen', '');
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        stage.appendChild(frame);
        game.classList.add('is-running');
        launch.hidden = true;
      });
    });
  }

  function init() {
    applyMode(readMode());
    document.querySelectorAll('[data-kb-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var next = root.dataset.kbMode === 'boring' ? 'goblin' : 'boring';
        saveMode(next);
        applyMode(next);
      });
    });
    document.querySelectorAll('[data-kb-reset]').forEach(function (button) {
      button.addEventListener('click', function () {
        try { localStorage.removeItem(QUIZ_KEY); } catch (_) {}
        document.querySelectorAll('.kb-challenge-feedback').forEach(function (feedback) {
          feedback.textContent = '';
          delete feedback.dataset.state;
        });
        document.querySelectorAll('.kb-answer').forEach(function (answer) {
          answer.classList.remove('is-correct', 'is-wrong');
        });
        updateProgress([]);
      });
    });
    wireChallenges();
    wireGames();
    updateProgress();
  }

  window.__kb = { applyMode: applyMode, readMode: readMode, completedIds: completedIds };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
