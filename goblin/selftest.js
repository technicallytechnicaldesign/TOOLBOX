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
  G.stopApparitions();
  G.resetPokes();
  G.cancelSpeech();

  /* Start virtual time at the real epoch so any stale holdUntil stays sane. */
  const vc = makeVirtualClock(realClock.now(), 14);
  G.clock.set = vc.set; G.clock.clear = vc.clear;
  G.clock.now = vc.now; G.clock.hours = vc.hours;

  try {
    // ---- registry integrity ------------------------------------------------
    const { MOODS, BIT_STATES, BUBBLE_STYLES, EXPRESSIONS } = G.registries;
    const BITS = G.pools.BITS;

    const ids = BITS.map(b => b.id);
    check('bit ids unique', new Set(ids).size === ids.length,
      ids.filter((v, i) => ids.indexOf(v) !== i));

    /* Applied to every routine AND every greeting, so a typo in any of them
       fails here rather than silently rendering nothing. */
    const VOICES = ['clipboard', 'peek'];
    const PEEK_SIDES = ['left', 'right'];
    const unknown = [];
    const validateRoutine = b => {
      b.state.split(' ').filter(Boolean)
        .forEach(s => { if (!BIT_STATES.includes(s)) unknown.push([b.id, 'state', s]); });
      if (!MOODS.includes(b.mood)) unknown.push([b.id, 'mood', b.mood]);
      if (b.bubbleClass && !BUBBLE_STYLES.includes(b.bubbleClass))
        unknown.push([b.id, 'bubbleClass', b.bubbleClass]);
      b.beats.forEach(beat => {
        if (beat.voice && !VOICES.includes(beat.voice)) unknown.push([b.id, 'voice', beat.voice]);
        if (beat.expression && !EXPRESSIONS.includes(beat.expression))
          unknown.push([b.id, 'expression', beat.expression]);
        if (beat.addState) beat.addState.split(' ').filter(Boolean).forEach(s => {
          if (!BIT_STATES.includes(s)) unknown.push([b.id, 'addState', s]);
        });
        if (beat.voice === 'peek') {
          if (!beat.peek) unknown.push([b.id, 'peek beat with no peek spec']);
          else {
            if (!PEEK_SIDES.includes(beat.peek.side)) unknown.push([b.id, 'peek side', beat.peek.side]);
            if (!G.PEEK_ART[beat.peek.art]) unknown.push([b.id, 'peek art', beat.peek.art]);
          }
        }
      });
    };
    BITS.forEach(validateRoutine);
    [G.pools.babeGreeting, ...G.pools.GREETINGS].forEach(validateRoutine);
    check('every routine and greeting uses only registered states/moods/voices/art',
      unknown.length === 0, unknown);

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

    // ---- greetings ---------------------------------------------------------
    const babe = G.pools.babeGreeting;
    const greets = G.pools.GREETINGS;

    /* A greeting that turns up forty minutes in is not a greeting. */
    const bitIds = BITS.map(b => b.id);
    check('no greeting is reachable from the ambient bit picker',
      !bitIds.includes(babe.id) && !greets.some(g => bitIds.includes(g.id)),
      bitIds.filter(id => id === babe.id || greets.some(g => g.id === id)));
    check('1000 ambient draws never surface a greeting',
      !Array.from({ length: 1000 }, () => G.pickBit().id)
        .some(id => id === babe.id || greets.some(g => g.id === id)));

    const drawn = Array.from({ length: 6000 }, () => G.pickGreeting());
    const babeShare = drawn.filter(g => g.id === babe.id).length / drawn.length;
    check('the personal greeting comes up about 1 time in 5',
      Math.abs(babeShare - 0.20) < 0.02, +babeShare.toFixed(3));
    check('the other greetings all get used',
      new Set(drawn.filter(g => g.id !== babe.id).map(g => g.id)).size === greets.length,
      { seen: new Set(drawn.map(g => g.id)).size, expected: greets.length + 1 });
    check('there are enough non-personal greetings to share the page',
      greets.length >= 6, greets.length);

    /* every greeting must satisfy the same registry rules as a routine */
    const badGreet = [];
    [babe, ...greets].forEach(g => {
      g.state.split(' ').filter(Boolean)
        .forEach(s => { if (!BIT_STATES.includes(s)) badGreet.push([g.id, 'state', s]); });
      if (!MOODS.includes(g.mood)) badGreet.push([g.id, 'mood', g.mood]);
      g.beats.forEach(b => {
        if (b.bubbleClass && !BUBBLE_STYLES.includes(b.bubbleClass))
          badGreet.push([g.id, 'beat bubbleClass', b.bubbleClass]);
        if (b.voice && b.voice !== 'clipboard') badGreet.push([g.id, 'beat voice', b.voice]);
        if (b.addState) b.addState.split(' ').filter(Boolean).forEach(s => {
          if (!BIT_STATES.includes(s)) badGreet.push([g.id, 'beat addState', s]);
        });
        if (b.expression && !EXPRESSIONS.includes(b.expression))
          badGreet.push([g.id, 'beat expression', b.expression]);
      });
    });
    check('every greeting state/mood/beat-style is registered', badGreet.length === 0, badGreet);

    /* the call-and-response: the clipboard asks, he answers */
    check('the questions are declared as the clipboard speaking',
      babe.beats.slice(0, 9).map(b => b.voice === 'clipboard' ? 'clip' : 'him').join() ===
      'him,clip,him,clip,him,clip,him,clip,him',
      babe.beats.map(b => b.voice || 'him'));
    check('he is hand-editing dimensions throughout it',
      babe.state.includes('overwriting') && babe.state.includes('holding'), babe.state);
    check('it ends by defacing the sheet and then hurling the clipboard',
      babe.beats.some(b => b.addState === 'defacing') &&
      babe.beats[babe.beats.length - 1].expression === 'hurl',
      babe.beats.slice(-3));

    /* the two voices must actually land in two different bubbles */
    G.performBit(babe);
    vc.advance(0);
    const trace = [];
    babe.beats.forEach(b => {
      const s = G.state();
      trace.push({
        him: s.visible ? s.text : null,
        clip: s.clipVisible ? s.clipText : null,
        defacing: s.poses.includes('defacing'),
        hurling: s.expressions.includes('hurl')
      });
      vc.advance(b.hold || G.timing.beatHold(b.text));
    });

    check('the clipboard speaks exactly the four questions',
      trace.filter(t => t.clip).map(t => t.clip).join(' | ') ===
      'What babe? | What power? | Who do? | Do what?',
      trace.filter(t => t.clip).map(t => t.clip));
    check('his own bubble is empty while the clipboard is talking',
      trace.filter(t => t.clip).every(t => t.him === null),
      trace.filter(t => t.clip));
    check('only one of them is ever visible at a time',
      trace.every(t => !(t.him && t.clip)), trace.filter(t => t.him && t.clip));
    check('the defacing starts partway through and stays on',
      !trace[0].defacing && trace[trace.length - 1].defacing,
      trace.map(t => t.defacing));
    /* `hurl` is a one-shot expression that expires partway through its beat,
       so this asserts it fired ON the final beat rather than afterwards. */
    check('the clipboard gets thrown on the final beat, and only then',
      trace[trace.length - 1].hurling && trace.slice(0, -1).every(t => !t.hurling),
      trace.map(t => t.hurling));

    G.cancelSpeech();
    check('cancelling clears the clipboard bubble too',
      G.state().clipText === '' && !G.state().clipVisible, G.state());

    // ---- the spell sequence ------------------------------------------------
    const spell = BITS.find(b => b.id === 'magic-spell');
    check('the spell sequence exists and is rare', !!spell && spell.rare === true);
    check('it is offered a suggestion from each side',
      spell.beats.filter(b => b.voice === 'peek').map(b => b.peek.side).join() === 'left,right',
      spell.beats.filter(b => b.voice === 'peek').map(b => b.peek.side));

    G.cancelSpeech();
    G.performBit(spell);
    vc.advance(0);
    const spellTrace = [];
    spell.beats.forEach(b => {
      const s = G.state();
      spellTrace.push({
        him: s.visible ? s.text : null,
        peek: s.peekers.map(p => p.side + ':' + p.text).join(),
        overwriting: s.poses.includes('overwriting')
      });
      vc.advance(b.hold || G.timing.beatHold(b.text));
    });

    /* At a beat boundary the outgoing peeker is briefly still in the DOM: its
       animation has already faded it to nothing and its removal timer fires
       shortly after. So these assert containment, not exclusivity. */
    check('the washer leans in from the left offering TORQUE',
      spellTrace[1].peek.includes('left:TORQUE?') && spellTrace[1].him === null, spellTrace[1]);
    check('the tolerance answers from the right',
      spellTrace[2].peek.includes('right:GD&T') && spellTrace[2].him === null, spellTrace[2]);
    check('no more than one hands over to one other at a time',
      spellTrace.every(t => t.peek.split(',').filter(Boolean).length <= 2),
      spellTrace.map(t => t.peek));
    check('he settles it himself, and starts overriding',
      spellTrace[3].him === 'MANUALLY OVERRIDING DIMENSIONS!!!' && spellTrace[3].overwriting,
      spellTrace[3]);
    check('peekers are gone once the sequence ends',
      G.state().peekers.length === 0, G.state().peekers);

    /* a cancelled routine must not leave a washer hanging off the side */
    G.performBit(spell);
    vc.advance((spell.beats[0].hold || 0) + 100);
    check('a peeker is live mid-sequence', G.state().peekers.length === 1, G.state().peekers);
    G.cancelSpeech();
    check('cancelling a routine clears its peekers',
      G.state().peekers.length === 0, G.state().peekers);

    /* Placement, at whatever width this is running. A phone stage leaves only
       ~50px either side of him, so peekers must sit BEHIND him rather than
       across his face, and must stay inside the stage. */
    G.clearPeekers();
    const noAnimP = document.createElement('style');
    noAnimP.textContent = '*{animation:none!important;transition:none!important}';
    document.head.appendChild(noAnimP);
    const pw = G.spawnPeeker('TORQUE?', { side: 'left', art: 'washer', top: 26 }, 3000);
    const pf = G.spawnPeeker('GD&T', { side: 'right', art: 'frame', top: 58 }, 3000);
    const stg = document.querySelector('.stage').getBoundingClientRect();
    const pwB = pw.getBoundingClientRect(), pfB = pf.getBoundingClientRect();
    const zPeek = parseInt(getComputedStyle(document.getElementById('peekers')).zIndex, 10);
    const zGob = parseInt(getComputedStyle(document.getElementById('goblin')).zIndex, 10);

    check('peekers sit behind the goblin', zPeek < zGob, { zPeek, zGob });
    check('peekers arrive from opposite edges of the stage',
      Math.round(pwB.left) <= Math.round(stg.left) + 1 &&
      Math.round(pfB.right) >= Math.round(stg.right) - 1,
      { washerL: Math.round(pwB.left), frameR: Math.round(pfB.right),
        stage: { l: Math.round(stg.left), r: Math.round(stg.right) } });
    check('peekers stay inside the stage and cause no page overflow',
      pwB.right <= stg.right + 1 && pfB.left >= stg.left - 1 &&
      document.documentElement.scrollWidth - document.documentElement.clientWidth === 0,
      { washerR: Math.round(pwB.right), frameL: Math.round(pfB.left) });
    check('a peeker is never wider than half the stage',
      pwB.width <= stg.width / 2 && pfB.width <= stg.width / 2,
      { washer: Math.round(pwB.width), frame: Math.round(pfB.width),
        half: Math.round(stg.width / 2) });
    noAnimP.remove();
    G.clearPeekers();

    check('the new arrival greeting is present',
      G.pools.GREETINGS.some(g => g.id === 'greet-fan' &&
        g.beats.some(b => /machinists cry/.test(b.text))));

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

    goblin.className = 'goblin hype talking holding overwriting';
    const dims = document.querySelector('.dims');
    check('overwriting: the hand-edited dimensions are shown',
      parseFloat(getComputedStyle(dims).opacity) === 1 &&
      dims.querySelectorAll('.dim').length === 3);
    check('overwriting: each dimension has an original and a scrawled override',
      [...dims.querySelectorAll('.dim')].every(d => d.querySelector('s') && d.querySelector('i')));
    check('overwriting: the pencil is out for it',
      parseFloat(getComputedStyle(document.querySelector('.pencil')).opacity) === 1);

    /* The edits have to land ON the clipboard paper, not beside it. Measured
       with animation off, since his float rotation inflates a bounding box by
       a couple of px and makes this look wrong when it is fine (and vice
       versa: it hid a real 15px overhang the first time). */
    const noAnim = document.createElement('style');
    noAnim.textContent = '*{animation:none!important}';
    document.head.appendChild(noAnim);
    const cb = document.querySelector('.clipboard').getBoundingClientRect();
    const dm = document.querySelector('.dims').getBoundingClientRect();
    const paper = { l: cb.left + 12, r: cb.right - 12, t: cb.top + 14, b: cb.bottom - 12 };
    /* Placement, not just logic. The first cut of this had the clipboard's
       bubble parented to .pen instead of .goblin, so it rendered 300px away
       and outside the stage while every logic assertion still passed. */
    goblin.className = 'goblin hype talking holding overwriting';
    const cbEl = document.getElementById('clip-bubble');
    cbEl.textContent = 'What power?';
    cbEl.classList.add('show');
    cbEl.style.opacity = '1';
    const cbBox = cbEl.getBoundingClientRect();
    const clipBox = document.querySelector('.clipboard').getBoundingClientRect();
    const stageBox = document.querySelector('.stage').getBoundingClientRect();
    check('the clipboard bubble is parented to the goblin, not the stage',
      cbEl.closest('.goblin') !== null, cbEl.parentElement && cbEl.parentElement.className);
    /* 8px of slack, not 0: at the default position a phone leaves ~1px, and a
       single longer clipboard line would then clip off the stage. */
    check('the clipboard bubble sits above the clipboard, inside the stage, with slack',
      cbBox.bottom <= clipBox.top &&
      cbBox.right > clipBox.left && cbBox.left < clipBox.right &&
      cbBox.left >= stageBox.left && cbBox.right <= stageBox.right - 8 && cbBox.top >= stageBox.top,
      { bubble: { l: Math.round(cbBox.left), r: Math.round(cbBox.right), b: Math.round(cbBox.bottom) },
        clipboard: { l: Math.round(clipBox.left), r: Math.round(clipBox.right), t: Math.round(clipBox.top) },
        stage: { l: Math.round(stageBox.left), r: Math.round(stageBox.right) } });
    cbEl.classList.remove('show'); cbEl.textContent = ''; cbEl.style.opacity = '';

    goblin.className = 'goblin hype talking holding overwriting defacing';
    const scrawl = document.querySelector('.scrawl');
    check('defacing: the scrawl covers the sheet',
      parseFloat(getComputedStyle(scrawl).opacity) === 1 && !!scrawl.querySelector('path'));
    check('defacing: the scrawl sits over the paper, not beside it', (() => {
      const s = scrawl.getBoundingClientRect();
      const c = document.querySelector('.clipboard').getBoundingClientRect();
      return s.left >= c.left && s.right <= c.right && s.top >= c.top && s.bottom <= c.bottom;
    })());
    goblin.className = 'goblin hype talking holding overwriting';

    check('overwriting: the edits land on the clipboard paper',
      dm.left >= paper.l && dm.right <= paper.r && dm.top >= paper.t && dm.bottom <= paper.b,
      { overhangRight: Math.round(dm.right - paper.r), overhangLeft: Math.round(paper.l - dm.left),
        overhangBottom: Math.round(dm.bottom - paper.b) });
    noAnim.remove();
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

    // ---- the drift layer ---------------------------------------------------
    G.stopApparitions();
    const driftEl = document.getElementById('drift');
    check('drift layer starts empty', G.ghostState().live === 0);

    /* Apparitions must pass BEHIND him and behind whatever he is saying.
       The bubble is position:relative, so without an explicit z-index it
       paints below the drift layer and ghosts drift across the words. */
    const zDrift = parseInt(getComputedStyle(driftEl).zIndex, 10);
    const zGoblin = parseInt(getComputedStyle(document.getElementById('goblin')).zIndex, 10);
    const zBubble = parseInt(getComputedStyle(document.querySelector('.bubble-slot')).zIndex, 10);
    check('apparitions sit behind the goblin and behind the bubble',
      zDrift < zGoblin && zDrift < zBubble, { zDrift, zGoblin, zBubble });
    check('drift layer is inert and clipped',
      getComputedStyle(driftEl).pointerEvents === 'none' &&
      getComputedStyle(driftEl).overflow === 'hidden' &&
      getComputedStyle(document.querySelector('.stage')).position === 'relative');

    /* one of each kind renders the right thing */
    const tolEl = G.spawnApparition({ kind: 'tolerance', text: 'Ø6.0000003 H7', duration: 15000 });
    check('tolerance ghost renders its text',
      tolEl.textContent.includes('Ø6.0000003'), tolEl.textContent);

    const frameEl = G.spawnApparition({
      kind: 'frame', duration: 15000,
      frame: { sym: 'position', tol: 'Ø0.0000001', datums: ['A', 'B', 'C'] }
    });
    check('feature control frame draws an SVG symbol plus a cell per datum',
      frameEl.querySelector('.fcf svg') && frameEl.querySelectorAll('.fcf .cell').length === 5,
      frameEl.querySelectorAll('.fcf .cell').length);

    const boltEl = G.spawnApparition({
      kind: 'bolt', duration: 15000, bolt: { art: 'bent', label: 'M6, PRE-BENT TO SUIT' }
    });
    check('bolt ghost draws art and a label',
      boltEl.querySelector('svg') && boltEl.textContent.includes('PRE-BENT'), boltEl.textContent);

    const cryEl = G.spawnApparition({
      kind: 'tolerance', text: 'DATUM Q (TBD)', duration: 15000,
      scream: true, screamText: 'WHO BROUGHT ME INTO EXISTENCE'
    });
    check('a screaming apparition gets the cry class and its scream',
      cryEl.classList.contains('cry') && cryEl.textContent.includes('WHO BROUGHT ME'),
      cryEl.className);

    check('every ghost is positioned and given a travel distance',
      [tolEl, frameEl, boltEl, cryEl].every(el =>
        el.style.getPropertyValue('--dx') && el.style.top && el.style.animationDuration),
      tolEl.style.cssText);

    check('four apparitions are live', G.ghostState().live === 4, G.ghostState());

    /* he notices one, and every node cleans itself up */
    G.cancelSpeech();
    vc.advance(15000 * 0.42);
    check('he grins when something drifts past',
      document.getElementById('goblin').classList.contains('grin'),
      document.getElementById('goblin').className);

    vc.advance(15000);
    check('apparitions remove themselves when the drift ends',
      G.ghostState().live === 0, G.ghostState());
    check('no ghost timers left pending',
      G.ghostState().pendingGhostTimers === 0, G.ghostState());

    /* The drift layer must never interrupt him. Reactions are probabilistic
       (45% for a screaming one), so fire a crowd of them rather than one and
       hope: if the guard were broken this would catch it with near certainty.
       Reaction lands at 42% of the drift duration, so a 4s drift puts it at
       ~1.7s, comfortably inside the line's hold. */
    G.cancelSpeech();
    const longLine = 'A LINE THAT AN APPARITION MUST NOT BE ALLOWED TO CUT OFF, NOT EVEN A SCREAMING ONE';
    G.say('ambient', longLine);
    const holdEnds = G.state().holdUntil;
    for (let i = 0; i < 30; i++) {
      G.spawnApparition({ kind: 'tolerance', text: 'SEE DETAIL B', duration: 4000,
                          scream: true, screamText: 'NOBODY CHECKED' });
    }
    vc.advance(2000);                     // past every reaction, still mid-line
    check('30 screaming apparitions never interrupt a line in progress',
      G.state().text === longLine, G.state().text);
    check('the test actually stayed inside the line', G.clock.now() < holdEnds,
      { now: G.clock.now(), holdEnds });
    check('he still grinned at them while staying quiet',
      document.getElementById('goblin').classList.contains('grin'));

    /* ...but once he is genuinely finished, a reaction IS allowed through. */
    vc.advance(G.timing.lineHold(longLine) + G.timing.FADE_MS + 10);
    let spoke = false;
    for (let i = 0; i < 40 && !spoke; i++) {
      G.spawnApparition({ kind: 'tolerance', text: 'DATUM Q (TBD)', duration: 4000,
                          scream: true, screamText: 'RELEASE ME' });
      vc.advance(2000);
      if (G.pools.ghostScreamReactions.includes(G.state().text)) spoke = true;
      G.cancelSpeech();
    }
    check('a reaction does get through once he is idle', spoke);
    G.stopApparitions();

    // ---- apparition variety ------------------------------------------------
    G.stopApparitions();
    const specs = Array.from({ length: 6000 }, () => G.pickApparition());

    const kindShare = k => specs.filter(s => s.kind === k).length / specs.length;
    check('all three kinds appear, none starved',
      ['tolerance', 'frame', 'bolt'].every(k => kindShare(k) > 0.15),
      { tolerance: +kindShare('tolerance').toFixed(3), frame: +kindShare('frame').toFixed(3),
        bolt: +kindShare('bolt').toFixed(3) });

    const peaks = specs.map(s => s.peak);
    check('opacity stays within 10-40%',
      Math.min(...peaks) >= 0.10 && Math.max(...peaks) <= 0.40,
      { min: +Math.min(...peaks).toFixed(3), max: +Math.max(...peaks).toFixed(3) });
    check('the biggest ones are held to the faint end',
      specs.filter(s => s.scale > 3).every(s => s.peak <= 0.36),
      Math.max(...specs.filter(s => s.scale > 3).map(s => s.peak)).toFixed(3));

    const scales = specs.map(s => s.scale);
    check('scale spans small to stage-filling',
      Math.min(...scales) >= 1 && Math.max(...scales) > 5 &&
      specs.filter(s => s.scale > 3.8).length / specs.length > 0.03,
      { min: +Math.min(...scales).toFixed(2), max: +Math.max(...scales).toFixed(2),
        hugeShare: +(specs.filter(s => s.scale > 3.8).length / specs.length).toFixed(3) });

    check('some drift only partway and fade out where they are',
      specs.filter(s => s.partial).length / specs.length > 0.25);
    check('every apparition gets a wave amplitude', specs.every(s => s.wave >= 22));

    /* the two lines that must be paired, never bolted onto something random */
    check('"no datum" and "part number" are not in the random scream pool',
      !G.pools.ghostScreams.some(s => /NO DATUM|PART NUMBER/.test(s)),
      G.pools.ghostScreams.filter(s => /NO DATUM|PART NUMBER/.test(s)));
    check('hauntings always scream, and always with their own paired line',
      specs.filter(s => s.haunting).every(s =>
        s.scream && G.pools.ghostHauntings.some(h => h.screamText === s.screamText)));
    check('hauntings actually come up', specs.filter(s => s.haunting).length / specs.length > 0.10);
    check('both requested hauntings exist and are extended',
      G.pools.ghostHauntings.some(h => /NO DATUMS\. ONLY THE VAGUE HOPE/.test(h.screamText)) &&
      G.pools.ghostHauntings.some(h => /PLEASEEFFINGWORKNOW123123123123_FINAL/.test(h.screamText)));

    /* A stage-filling one must render huge, but "huge" is relative to the
       stage it is crossing, so this asserts against the clamp rather than a
       fixed multiplier: the same check then holds on a phone and a desktop. */
    const bigSpec = { kind: 'tolerance', text: 'DO NOT SCALE DRAWING',
      scale: 99, peak: 0.18, wave: 60, duration: 20000 };
    const big = G.spawnApparition(bigSpec);
    const smallSpec = { kind: 'tolerance', text: 'DO NOT SCALE DRAWING',
      scale: 1, peak: 0.3, wave: 30, duration: 20000 };
    const small = G.spawnApparition(smallSpec);
    const bigW = big.getBoundingClientRect().width;
    const smallW = small.getBoundingClientRect().width;
    const cap = G.maxApparitionScale();

    check('an oversized request is clamped to what the stage can hold',
      bigSpec.effectiveScale <= cap + 0.01 && smallSpec.effectiveScale === 1,
      { requested: 99, effective: bigSpec.effectiveScale, cap: +cap.toFixed(2) });
    check('rendered width tracks the effective scale',
      Math.abs((bigW / smallW) - bigSpec.effectiveScale) / bigSpec.effectiveScale < 0.15,
      { ratio: +(bigW / smallW).toFixed(2), effective: +bigSpec.effectiveScale.toFixed(2) });
    check('a stage-filling ghost roughly spans the stage without overflowing it',
      bigW > document.querySelector('.stage').getBoundingClientRect().width * 0.6 &&
      document.documentElement.scrollWidth - document.documentElement.clientWidth === 0,
      { bigW: Math.round(bigW), stage: Math.round(document.querySelector('.stage').getBoundingClientRect().width) });
    G.stopApparitions();

    /* they wait for a quiet moment */
    G.cancelSpeech();
    check('the moment is right when he is silent and the stage is clear',
      G.apparitionMomentIsRight());
    G.say('ambient', 'he is talking now, so nothing should surface');
    check('no apparition surfaces while he is speaking', !G.apparitionMomentIsRight());
    vc.advance(G.timing.lineHold('he is talking now, so nothing should surface') + G.timing.FADE_MS + 10);
    check('the moment comes back once he is finished', G.apparitionMomentIsRight());
    G.spawnApparition({ kind: 'tolerance', text: 'SEE DETAIL B', duration: 15000 });
    check('no apparition surfaces on top of another', !G.apparitionMomentIsRight());
    G.stopApparitions();

    check('ghost pools are populated and clean',
      G.pools.ghostTolerances.length >= 15 && G.pools.ghostFrames.length >= 8 &&
      G.pools.ghostBolts.length >= 8 && G.pools.ghostScreams.length >= 10 &&
      ![...G.pools.ghostTolerances, ...G.pools.ghostScreams, ...G.pools.ghostReactions,
        ...G.pools.ghostScreamReactions,
        ...G.pools.ghostHauntings.map(h => h.screamText)].some(l => /—|–/.test(l)),
      { tol: G.pools.ghostTolerances.length, frames: G.pools.ghostFrames.length,
        bolts: G.pools.ghostBolts.length, screams: G.pools.ghostScreams.length });

    check('every frame symbol resolves to real art',
      G.pools.ghostFrames.every(f => {
        const probe = G.spawnApparition({ kind: 'frame', frame: f, duration: 100 });
        const ok = !!probe.querySelector('.fcf svg');
        probe.remove();
        return ok;
      }));
    check('every bolt variant resolves to real art',
      G.pools.ghostBolts.every(b => {
        const probe = G.spawnApparition({ kind: 'bolt', bolt: b, duration: 100 });
        const ok = !!probe.querySelector('svg');
        probe.remove();
        return ok;
      }));
    G.stopApparitions();

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
    G.stopApparitions();
    G.clearPeekers();
    G.resetPokes();
    G.cancelSpeech();
    G.say('ambient', 'Self-test complete. I was magnificent.', { hold: 5000 });
    G.scheduleAmbient();
    if (!G.reducedMotion) G.scheduleApparition();
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
