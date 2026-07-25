(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let latest = null;

  function mm(value, unit){
    const n = value * unit;
    return Math.abs(n - Math.round(n)) < .01 ? Math.round(n) + ' mm' : n.toFixed(1) + ' mm';
  }

  function eventModel(part){
    const events = [{pct:5,label:'Front entry',description:'A–A is inside the front face.'}];
    if(part.family === 'counterbore'){
      const boundary = part.p.cbDepth / part.d * 100;
      events.push({pct:boundary,label:'Counterbore shoulder',description:'The opening changes to the bore diameter.',tick:true});
    } else if(part.family === 'countersink'){
      const boundary = part.p.sinkDepth / part.d * 100;
      events.push({pct:boundary,label:'Countersink base',description:'The taper meets the pilot bore.',tick:true});
    } else if(part.family === 'vertical' || part.family === 'crossdrill'){
      const first = (part.p.cy - part.p.holeR) / part.d * 100;
      const last = (part.p.cy + part.p.holeR) / part.d * 100;
      events.push(
        {pct:first,label:'Hole begins',description:'A–A reaches the vertical-hole footprint.',tick:true},
        {pct:last,label:'Hole ends',description:'A–A leaves the vertical-hole footprint.',tick:true}
      );
    } else if(part.family === 'pipeflange'){
      const boundary = part.p.flangeT / part.d * 100;
      events.push({pct:boundary,label:'Flange shoulder',description:'The cut leaves the flange and enters the pipe barrel.',tick:true});
    } else if(part.family === 'stepped'){
      events.push(
        {pct:part.p.s1 / part.d * 100,label:'First shoulder',description:'The cut enters the middle height.',tick:true},
        {pct:part.p.s2 / part.d * 100,label:'Second shoulder',description:'The cut enters the rear height.',tick:true}
      );
    } else if(part.family === 'bearing'){
      const boundary = part.p.bossDepth / part.d * 100;
      events.push(
        {pct:Math.max(7,boundary - 5),label:'Inside boss',description:'The crowned boss and bore are intersected.'},
        {pct:boundary,label:'Boss shoulder',description:'The cut crosses the boss termination.',tick:true},
        {pct:Math.min(93,boundary + 5),label:'Behind boss',description:'Only the full-depth base remains.'}
      );
    } else if(part.family === 'blind'){
      const boundary = part.p.boreDepth / part.d * 100;
      events.push(
        {pct:Math.max(7,boundary - 5),label:'Inside bore',description:'The blind bore is open at the cut.'},
        {pct:boundary,label:'Bore bottom',description:'The cut crosses the internal end of the bore.',tick:true},
        {pct:Math.min(93,boundary + 5),label:'Solid rear',description:'The cut lies behind the bore.'}
      );
    } else if(part.family === 'wedge'){
      events.push(
        {pct:25,label:'Front quarter',description:'The section is close to the taller front profile.'},
        {pct:50,label:'Mid-slope',description:'The plane is at the midpoint of the slope.',tick:true},
        {pct:75,label:'Rear quarter',description:'The profile approaches the rear height.'}
      );
    } else {
      events.push({pct:50,label:'Mid-depth',description:'The section topology remains constant.'});
    }
    events.push({pct:95,label:'Rear exit',description:'A–A is inside the rear face.'});
    return events.sort((a,b) => a.pct - b.pct);
  }

  function analyse(part, pct, unit){
    const depth = part.d * pct / 100;
    const stable = {
      title:'Section profile remains constant',
      copy:'The profile and openings run through the full depth. Moving A–A changes location, not the section.'
    };
    if(part.family === 'bored') return {...stable,title:'Through-bore remains open',copy:'At ' + mm(depth,unit) + ' from the front, A–A intersects the same outer body and through-bore.'};
    if(part.family === 'counterbore'){
      const boundary = part.p.cbDepth / part.d * 100;
      if(Math.abs(pct - boundary) < 1.5) return {title:'A–A at the counterbore shoulder',copy:'The opening reduces to the bore diameter here.'};
      if(pct < boundary) return {title:'Counterbore is cut',copy:'The larger front recess is open in the section.'};
      return {title:'Through bore remains',copy:'Only the smaller bore is open in the section.'};
    }
    if(part.family === 'countersink'){
      const boundary = part.p.sinkDepth / part.d * 100;
      if(Math.abs(pct - boundary) < 1.5) return {title:'A–A at the countersink base',copy:'The taper meets the pilot bore here.'};
      if(pct < boundary) return {title:'Countersink narrows with depth',copy:'The tapered mouth is open in the section.'};
      return {title:'Pilot bore remains',copy:'The taper has ended; the smaller bore is now constant.'};
    }
    if(part.family === 'vertical' || part.family === 'crossdrill'){
      const first = (part.p.cy - part.p.holeR) / part.d * 100;
      const last = (part.p.cy + part.p.holeR) / part.d * 100;
      if(Math.abs(pct - first) < 1.5 || Math.abs(pct - last) < 1.5) return {title:'A–A meets a vertical hole',copy:'The circular footprint is just reached by the cut.'};
      if(part.family === 'crossdrill'){
        if(pct > first && pct < last) return {title:'Both hole axes are cut',copy:'The axial bore stays circular while the vertical bores form two slots.'};
        return {title:'Only the axial bore is cut',copy:'A–A is clear of the vertical ports.'};
      }
      if(pct > first && pct < last) return {title:'Vertical holes are cut',copy:'Both vertical bores appear as slot-shaped voids.'};
      return {title:'Vertical holes are missed',copy:'A–A is clear of their depth band, so the section is solid.'};
    }
    if(part.family === 'pipe') return {title:'Pipe wall repeats',copy:'A–A remains an annulus with a ' + mm(part.p.wall,unit) + ' wall.'};
    if(part.family === 'pipeflange'){
      const boundary = part.p.flangeT / part.d * 100;
      if(Math.abs(pct - boundary) < 1.5) return {title:'A–A at the flange shoulder',copy:'The bolt circle ends and the pipe barrel begins.'};
      if(pct < boundary) return {title:'Flange and bolt holes are cut',copy:'The centre bore and four bolt holes are open.'};
      return {title:'Pipe wall remains',copy:'Behind the flange, the section is a simple annulus.'};
    }
    if(part.family === 'ibeam') return {title:'I-profile repeats',copy:'Both flanges and the central web run through the full length.'};
    if(part.family === 'channel') return {title:'Channel profile repeats',copy:'The web, flanges, and open mouth remain unchanged.'};
    if(part.family === 'stepped'){
      const first = part.p.s1 / part.d * 100, second = part.p.s2 / part.d * 100;
      if(Math.abs(pct - first) < 1.5) return {title:'A–A at the first shoulder',copy:'The section drops to the middle height.'};
      if(Math.abs(pct - second) < 1.5) return {title:'A–A at the second shoulder',copy:'The section drops to the rear height.'};
      if(pct < first) return {title:'Front level is cut',copy:'Current section height: ' + mm(part.p.hFront,unit) + '.'};
      if(pct < second) return {title:'Middle level is cut',copy:'Current section height: ' + mm(part.p.hMid,unit) + '.'};
      return {title:'Rear level is cut',copy:'Current section height: ' + mm(part.p.hRear,unit) + '.'};
    }
    if(part.family === 'fork') return {...stable,title:'Open fork profile repeats',copy:'The top slot runs through the depth. A–A repeats the open U-profile at ' + mm(depth,unit) + '.'};
    if(part.family === 'flange') return {...stable,title:'Twin bores repeat through depth',copy:'Both bores and the outer outline run through the part, so the section stays the same at ' + mm(depth,unit) + '.'};
    if(part.family === 'wedge'){
      const height = part.p.hf + (part.p.hb - part.p.hf) * (depth / part.d);
      const direction = part.p.hb < part.p.hf ? 'decreases' : 'increases';
      return {title:'Section height changes continuously',copy:'The sloped top means section height ' + direction + ' as A–A moves rearward. Current height: ' + mm(height,unit) + '.'};
    }
    if(part.family === 'bearing'){
      const boundary = part.p.bossDepth / part.d * 100;
      if(Math.abs(pct - boundary) < 1.5) return {title:'A–A at the boss shoulder',copy:'The crown and bore end at this feature boundary.'};
      if(pct < boundary) return {title:'Crown and bore are intersected',copy:'A–A lies before the shoulder at ' + mm(part.p.bossDepth,unit) + '. The round crown and bore belong in the section.'};
      return {title:'Only the full-depth base remains',copy:'A–A lies behind the boss shoulder. The crown and bore are not intersected.'};
    }
    if(part.family === 'blind'){
      const boundary = part.p.boreDepth / part.d * 100;
      if(Math.abs(pct - boundary) < 1.5) return {title:'A–A crosses the blind-bore bottom',copy:'The circular void ends here. The section changes from an opening to cut material.'};
      if(pct < boundary) return {title:'Blind bore is open at A–A',copy:'The cut lies before the bore bottom at ' + mm(part.p.boreDepth,unit) + ', so the circular void appears.'};
      return {title:'A–A lies behind the bore bottom',copy:'A–A is past the bore bottom. The section is solid.'};
    }
    return stable;
  }

  function renderEvents(part, pct){
    const events = eventModel(part);
    const track = $('#eventTrack');
    const list = $('#timeline');
    track.innerHTML = '';
    list.innerHTML = '';
    events.forEach((event,index) => {
      if(index > 0 && index < events.length - 1 && event.tick){
        const mark = document.createElement('span');
        mark.className = 'event-tick';
        mark.style.left = event.pct + '%';
        track.appendChild(mark);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = event.label;
      button.title = event.description;
      button.classList.toggle('current',Math.abs(pct - event.pct) < 3);
      button.addEventListener('click',() => window.SectionLabCore.setSectionPct(Math.round(event.pct)));
      list.appendChild(button);
    });
  }

  function sync(detail){
    latest = detail;
    const change = analyse(detail.part,detail.sectionPct,detail.unit);
    $('#liveChangeTitle').textContent = change.title;
    $('#liveChangeCopy').textContent = change.copy;
    $('#sectionDepthMirror').textContent = Math.round(detail.sectionPct) + '% · ' + mm(detail.part.d * detail.sectionPct / 100,detail.unit);
    renderEvents(detail.part,detail.sectionPct);
  }

  function move(delta){
    const value = Math.max(5,Math.min(95,window.SectionLabCore.state.sectionPct + delta));
    window.SectionLabCore.setSectionPct(value);
  }

  $$('[data-step]').forEach(button => button.addEventListener('click',() => move(Number(button.dataset.step))));
  $('#previousEvent').addEventListener('click',() => {
    if(!latest) return;
    const positions = eventModel(latest.part).map(event => event.pct).filter(value => value < latest.sectionPct - 1);
    window.SectionLabCore.setSectionPct(Math.round(positions.at(-1) ?? 5));
  });
  $('#nextEvent').addEventListener('click',() => {
    if(!latest) return;
    const next = eventModel(latest.part).map(event => event.pct).find(value => value > latest.sectionPct + 1);
    window.SectionLabCore.setSectionPct(Math.round(next ?? 95));
  });

  $$('.mobile-view-switch button').forEach(button => button.addEventListener('click',() => {
    $$('.mobile-view-switch button').forEach(item => item.classList.toggle('active',item === button));
    $$('.secondary-view').forEach(view => view.classList.toggle('mobile-active',view.dataset.mobileView === button.dataset.view));
  }));

  window.addEventListener('sectionlab:generated',event => sync(event.detail));
  window.addEventListener('sectionlab:sectionchange',event => sync(event.detail));
  const part = new URLSearchParams(location.search).get('part');
  if(part && $('#family').querySelector('option[value="' + part + '"]')){
    $('#family').value = part;
    window.SectionLabCore.generate();
  }
  if(window.SectionLabCore?.state?.part){
    sync({part:window.SectionLabCore.state.part,sectionPct:window.SectionLabCore.state.sectionPct,unit:window.SectionLabCore.baseUnit,seed:window.SectionLabCore.state.seed});
  }
})();
