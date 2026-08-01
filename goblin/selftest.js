/* Hype Goblin self-test.
 *
 * Not loaded by index.html. Run it from the page's console, or from a tool
 * that can evaluate in the page:
 *
 *   const m = await import('./selftest.js'); return m.runSelfTest();
 *
 * Returns { ok, passed, failed, failures[], results[] } synchronously-ish:
 * there is exactly one await in the whole suite (a rendered-frame check), and
 * NO sleeping. Every timing behaviour is verified by installing a virtual
 * clock on window.__goblin.clock and advancing it by hand.
 *
 * Why it is built this way: a hidden browser tab clamps setTimeout to roughly
 * one second. A test that sleeps in 100ms increments to watch him speak takes
 * ten times longer than it should, blows tool timeouts, and is really
 * measuring the browser's throttle rather than this page's logic. Driving the
 * clock directly removes the throttle from the equation entirely and makes
 * beat boundaries exact instead of approximate.
 *
 * CSS animations still run on real time, so the two animation checks use the
 * Web Animations API (pause, set currentTime, read computed style) rather than
 * waiting for keyframes to come around.
 */

function makeVirtualClock(startMs, startHour) {
  let now = startMs;
  let hour = startHour;
  let seq = 0;
  const pending = new Map();

  return {
    /* the four methods the page's `clock` needs */
    set(fn, ms) {
      const id = ++seq;
      pending.set(id, { at: now + Math.max(0, ms || 0), fn });
      return id;
    },
    clear(id) { pending.delete(id); },
    now() { return now; },
    hours() { return hour; },

    /* test-side controls */
    setHour(h) { hour = h; },
    pendingCount() { return pending.size; },
    advance(ms) {
      const target = now + ms;
      let guard = 0;
      for (;;) {
        let dueId = null;
        let dueAt = Infinity;
        /* Map preserves insertion order, so ties fire in scheduling order. */
        for (const [id, t] of pending) if (t.at < dueAt) { dueAt = t.at; dueId = id; }
        if (dueId === null || dueAt > target) break;
        now = dueAt;
        const t = pending.get(dueId);
        pending.delete(dueId);
        t.fn();
        if (++guard > 20000) throw new Error('runaway timer loop in advance()');
      }
      now = target;
    }
  };
}

export function runSelfTest() {
  const G = window.__goblin;
  if (!G) throw new Error('window.__goblin missing — is this the goblin page?');

  const results = [];
  const check = (name, cond, detail) => {
    results.push({ name, pass: !!cond, detail: cond ? undefined : detail });
  };

  const realClock = { set: G.clock.set, clear: G.clock.clear, now: G.clock.now, hours: G.clock.hours };

  /* Stop the page's live timers BEFORE swapping clocks, so no real-clock
     callback can fire into the middle of the suite. */
  G.stopAmbient();
  G.resetPokes();
  G.cancelSpeech();

  /* Start virtual time at the real epoch so any stale holdUntil stays sane. */
  const vc = makeVirtualClock(realClock.now(), 14);
  G.clock.set = vc.set; G.clock.clear = vc.clear;
  G.clock.now = vc.now; G.clock.hours = vc.hours;

  try {
    // ---- registry integrity ------------------------------------------------
    const { MOODS, BIT_STATES, BUBBLE_STYLES } = G.registries;
    const BITS = G.pools.BITS;

    const ids = BITS.map(b => b.id);
    check('bit ids unique', new Set(ids).size === ids.length,
      ids.filter((v, i) => ids.indexOf(v) !== i));

    const unknown = [];
    BITS.forEach(b => {
      b.state.split(' ').filter(Boolean)
        .forEach(s => { if (!BIT_STATES.includes(s)) unknown.push([b.id, 'state', s]); });
      if (!MOODS.includes(b.mood)) unknown.push([b.id, 'mood', b.mood]);
      if (b.bubbleClass && !BUBBLE_STYLES.includes(b.bubbleClass))
        unknown.push([b.id, 'bubbleClass', b.bubbleClass]);
    });
    check('every bit state/mood/bubbleClass is registered', unknown.length === 0, unknown);

    /* The original prototype bug: the rare line also sat in the common pool,
       so the 0.2% gate did nothing. Guard it forever. */
    const leaked = G.pools.psychicDamage.filter(l => G.pools.lines.ambient.includes(l));
    check('psychicDamage does not leak into ambient', leaked.length === 0, leaked);

    const all = [...G.pools.lines.ambient, ...G.pools.lines.hype, ...G.pools.lines.reality,
                 ...G.pools.lines.fix, ...G.pools.lines.destroy,
                 ...G.pools.toleranceScreams, ...G.pools.psychicDamage, ...G.pools.nightLines];
    const dupes = all.filter((v, i) => all.indexOf(v) !== i);
    check('no duplicate lines across pools', dupes.length === 0, dupes.slice(0, 5));
    check('no em dashes in any line', !all.some(l => /—|–/.test(l)),
      all.filter(l => /—|–/.test(l)).slice(0, 3));

    // ---- beat scheduling is exact ------------------------------------------
    const bit = BITS.find(b => b.beats.length >= 4 && !b.nightOnly);
    G.performBit(bit);
    vc.advance(0);
    check('routine: first beat shows immediately',
      G.state().text === bit.beats[0].text, G.state().text);

    let beatsExact = true;
    let visibleThroughout = true;
    const beatTrace = [];
    for (let i = 0; i < bit.beats.length; i++) {
      const hold = bit.beats[i].hold || G.timing.beatHold(bit.beats[i].text);
      /* one tick before the boundary the CURRENT beat must still be up, fully
         visible, and not yet fading */
      vc.advance(hold - 1);
      const atBoundary = G.state();
      if (!atBoundary.visible) visibleThroughout = false;
      vc.advance(1);   /* crossing the last boundary ends the utterance */
      const after = G.state().text;
      const expected = i + 1 < bit.beats.length ? bit.beats[i + 1].text : bit.beats[i].text;
      if (atBoundary.text !== bit.beats[i].text || after !== expected) beatsExact = false;
      beatTrace.push({
        beat: i, hold,
        heldToBoundary: atBoundary.text === bit.beats[i].text,
        visible: atBoundary.visible,
        thenAdvanced: after === expected
      });
    }
    check('routine: every beat holds its full duration, no early swap', beatsExact, beatTrace);
    check('routine: visible and not fading through every beat', visibleThroughout, beatTrace);

    /* the original leaked-timer bug lived exactly here */
    vc.advance(G.timing.FADE_MS - 1);
    check('routine: fading, not yet cleared', G.state().fading, G.state());
    vc.advance(1);
    const cleared = G.state();
    check('routine: fully cleared after the fade',
      !cleared.visible && cleared.poses.length === 0 && cleared.moods.length === 0, cleared);
    check('routine: no timers left pending', cleared.pendingTimers === 0, cleared.pendingTimers);

    // ---- ambient never interrupts -----------------------------------------
    G.say('ambient', 'A DELIBERATELY LONG LINE THAT MUST NOT BE CUT OFF BY THE AMBIENT TIMER');
    const guarded = G.state().text;
    vc.advance(500);
    G.runAmbient();                       // fire it point-blank, mid-sentence
    check('ambient defers while he is mid-sentence', G.state().text === guarded, G.state().text);

    G.scheduleAmbient();
    vc.advance(1000);
    check('ambient still deferred a second later', G.state().text === guarded, G.state().text);

    // ---- a button interrupts, and cleanly ---------------------------------
    G.performBit(BITS.find(b => b.state.includes('scribbling')));
    vc.advance(300);
    const mid = G.state();
    document.querySelector('button[data-mode="fix"]').click();
    const after = G.state();
    check('button interrupts a routine', after.text !== mid.text, { mid: mid.text, after: after.text });
    check('interrupt clears every pose class', after.poses.length === 0, after.poses);
    check('interrupt leaves exactly one mood', after.moods.length === 1 && after.moods[0] === 'fix', after.moods);

    // ---- bubble styles do not leak ----------------------------------------
    const whisperBit = BITS.find(b => b.bubbleClass === 'whisper');
    G.performBit(whisperBit);
    vc.advance(0);
    check('whisper style applies on a conspiracy routine',
      G.state().bubbleStyles.includes('whisper'), G.state().bubbleStyles);
    G.say('hype', 'a plain line');
    check('whisper style does not leak into the next line',
      G.state().bubbleStyles.length === 0, G.state().bubbleStyles);

    // ---- poke ladder -------------------------------------------------------
    G.resetPokes();
    const poke = document.getElementById('poke');
    const ladder = [];
    for (let i = 1; i <= 12; i++) { poke.click(); ladder.push(G.state().moods[0]); }
    const want = ['ambient', 'ambient', 'destroy', 'destroy', 'destroy',
                  'hype', 'hype', 'hype', 'hype', 'gold', 'gold', 'gold'];
    check('poke ladder tiers are boundary-exact',
      ladder.join() === want.join(), { got: ladder, want });

    /* the counter must survive him talking, then forget on its own */
    G.say('ambient', 'something else entirely');
    poke.click();
    check('poke counter survives an unrelated utterance',
      G.state().moods[0] === 'gold', G.state().moods);
    vc.advance(60001);
    poke.click();
    check('poke counter forgets after 60 quiet seconds',
      G.state().moods[0] === 'ambient', G.state().moods);
    G.resetPokes();

    // ---- night gating ------------------------------------------------------
    vc.setHour(14);
    check('14:00 is not small hours', G.isSmallHours() === false);
    const dayDraws = Array.from({ length: 800 }, () => G.pickBit().id);
    check('night-only routines are absent by day',
      !dayDraws.some(id => BITS.find(b => b.id === id).nightOnly),
      dayDraws.filter(id => BITS.find(b => b.id === id).nightOnly).slice(0, 3));

    vc.setHour(3);
    check('03:00 is small hours', G.isSmallHours() === true);
    const nightDraws = Array.from({ length: 800 }, () => G.pickBit().id);
    check('night-only routines appear at 03:00',
      nightDraws.some(id => BITS.find(b => b.id === id).nightOnly));
    vc.setHour(14);

    // ---- rare weighting ----------------------------------------------------
    const draws = Array.from({ length: 8000 }, () => G.pickBit());
    const observed = draws.filter(b => b.rare).length / 8000;
    const dayRare = BITS.filter(b => b.rare && !b.nightOnly).length;
    const dayCommon = BITS.filter(b => !b.rare && !b.nightOnly).length;
    const expected = dayRare / (dayRare + dayCommon * 4);
    check('rare routines land near their 1:4 weighting',
      Math.abs(observed - expected) < 0.015, { observed: +observed.toFixed(4), expected: +expected.toFixed(4) });

    // ---- CSS poses resolve (WAAPI, no sleeping) ----------------------------
    const goblin = document.getElementById('goblin');
    const savedClass = goblin.className;

    goblin.className = 'goblin grief talking weeping';
    const tear = document.querySelector('.tear');
    const anims = tear.getAnimations();
    let tearPeak = 0;
    if (anims.length) {
      const a = anims[0];
      a.pause();
      [0, 200, 400, 900, 1500].forEach(t => {
        a.currentTime = t;
        tearPeak = Math.max(tearPeak, parseFloat(getComputedStyle(tear).opacity));
      });
      a.cancel();
    }
    check('weeping: the tear actually becomes visible', tearPeak > 0.9, tearPeak);

    /* The clipboard, pencil and calipers arrive on a CSS *transition*, so a
       computed style read immediately after adding the class catches them at
       0. Kill transitions only (not animations) for these static probes. */
    const probe = document.createElement('style');
    probe.textContent = '*{transition:none!important}';
    document.head.appendChild(probe);

    goblin.className = 'goblin ambient talking measuring';
    check('measuring: calipers are shown',
      parseFloat(getComputedStyle(document.querySelector('.calipers')).opacity) === 1);
    goblin.className = 'goblin ambient talking scribbling holding';
    check('scribbling: pencil is shown',
      parseFloat(getComputedStyle(document.querySelector('.pencil')).opacity) === 1);
    check('holding: clipboard is shown',
      parseFloat(getComputedStyle(document.querySelector('.clipboard')).opacity) === 1);
    goblin.className = 'goblin ambient talking';
    check('clipboard is hidden when not holding',
      parseFloat(getComputedStyle(document.querySelector('.clipboard')).opacity) === 0);

    const tintBg = {};
    ['awe', 'grief', 'gold'].forEach(m => {
      goblin.className = 'goblin talking ' + m;
      tintBg[m] = getComputedStyle(document.querySelector('.head')).backgroundImage;
    });
    check('the three routine tints are visually distinct',
      new Set(Object.values(tintBg)).size === 3, Object.keys(tintBg));

    probe.remove();
    goblin.className = savedClass;

    // ---- layout ------------------------------------------------------------
    /* Viewport-dependent, and this suite cannot resize the window: run it once
       per width from whatever is driving the browser. The offender list is the
       useful part when it does fail. */
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .map(el => ({ el: (el.className && el.className.toString().slice(0, 30)) || el.tagName,
                    right: Math.round(el.getBoundingClientRect().right) }))
      .filter(x => x.right > window.innerWidth + 1)
      .slice(0, 6);
    check('no horizontal page overflow at ' + window.innerWidth + 'px',
      overflow === 0, { overflow, viewport: window.innerWidth, offenders });

  } finally {
    /* Always hand the real clock back and leave him talking, even on a throw. */
    G.clock.set = realClock.set; G.clock.clear = realClock.clear;
    G.clock.now = realClock.now; G.clock.hours = realClock.hours;
    G.resetPokes();
    G.cancelSpeech();
    G.say('ambient', 'Self-test complete. I was magnificent.', { hold: 5000 });
    G.scheduleAmbient();
  }

  const failures = results.filter(r => !r.pass);
  return {
    ok: failures.length === 0,
    passed: results.length - failures.length,
    failed: failures.length,
    failures,
    results: results.map(r => (r.pass ? 'PASS ' : 'FAIL ') + r.name)
  };
}
