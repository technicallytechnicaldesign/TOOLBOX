(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BASE_UNIT = 10;
  const state = {part:null, seed:0, sectionPct:50};
  function dispatch(name){
    if(!state.part)return;
    window.dispatchEvent(new CustomEvent(name,{detail:{part:state.part,sectionPct:state.sectionPct,unit:unit(),seed:state.seed}}));
  }

  function seeded(seed){let s=seed>>>0;return()=>((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296)}
  function range(rng,a,b){return a+(b-a)*rng()}
  function pick(rng,a){return a[Math.floor(rng()*a.length)]}
  function roundStep(v,step=.25){return Math.round(v/step)*step}
  function make(tag,attrs={}){const el=document.createElementNS(SVG_NS,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el}
  function clear(svg){while(svg.firstChild)svg.removeChild(svg.firstChild)}
  function text(svg,x,y,str,attrs={}){const t=make('text',{x,y,'font-family':'ui-monospace, monospace','font-size':10,fill:'currentColor',...attrs});t.textContent=str;svg.appendChild(t);return t}
  function unit(){return BASE_UNIT}
  function mm(v){const n=v*unit();return Math.abs(n-Math.round(n))<.01?String(Math.round(n)):n.toFixed(1)}
  function deg(v){return `${Math.round(v)}°`}

  const familyNames={bored:'Chamfered bore block',counterbore:'Rounded counterbore block',wedge:'Sloped wedge mount',countersink:'Countersunk wedge mount',fork:'Fork bracket',bearing:'Stepped bearing block',blind:'Blind-bore machine block',vertical:'Vertical-hole mounting block',flange:'Twin-bore obround flange',pipe:'Straight hollow pipe',pipeflange:'Front-flanged pipe',crossdrill:'Cross-drilled manifold block',ibeam:'I-section beam',channel:'Channel section',stepped:'Three-level stepped block'};
  const familyIds=Object.keys(familyNames);
  const difficultyBase={easy:{w:5,d:3.25,h:4.25},medium:{w:6.5,d:4.25,h:5.25},hard:{w:8,d:5.25,h:6.25}};

  function createPart(family,difficulty,rng){
    const base=difficultyBase[difficulty]; let w=roundStep(base.w*range(rng,.92,1.08)),d=roundStep(base.d*range(rng,.9,1.08)),h=roundStep(base.h*range(rng,.92,1.08));
    if(family==='bored'){
      const c=roundStep(Math.min(w,h)*range(rng,.07,.12)); const r=roundStep(Math.min(w,h)*range(rng,.12,.17));
      const cx=roundStep(w*range(rng,.40,.60)); const cz=roundStep(h*range(rng,.43,.62));
      return {family,w,d,h,p:{c,r,cx,cz},features:['through bore','corner chamfers','centre lines'],risk:'The bore can look the same from front and back.',build:'Draw both chamfered faces, join them with depth lines, then add the bore.',read:'Locate the bore centre before reading the chamfers.',section:'A–A keeps the bore open at every depth.'};
    }
    if(family==='counterbore'){
      const cornerR=roundStep(Math.min(w,h)*range(rng,.09,.15)); const r=roundStep(Math.min(w,h)*range(rng,.11,.15));
      const cbR=roundStep(Math.min(Math.min(w,h)*.28,r*range(rng,1.55,1.9))); const cbDepth=roundStep(d*range(rng,.22,.38));
      const cx=roundStep(w*range(rng,.40,.60)); const cz=roundStep(h*range(rng,.43,.60));
      return {family,w,d,h,p:{cornerR,r,cbR,cbDepth,cx,cz},features:['rounded outer corners','counterbored through bore','centre lines'],risk:'The larger circular recess only exists near the front face.',build:'Draw the rounded block, then step the larger recess down to the through bore.',read:'The side view shows where the counterbore ends.',section:'A–A shows the larger recess before its shoulder, then the smaller bore.'};
    }
    if(family==='wedge'){
      const hb=roundStep(h*range(rng,.58,.76)); const r=roundStep(Math.min(w,hb)*range(rng,.11,.15)); const cx=roundStep(w*range(rng,.38,.62)); const cz=roundStep(hb*range(rng,.38,.56));
      return {family,w,d,h,p:{hf:h,hb,r,cx,cz,c:.25},features:['sloped top','through bore','unequal front/back'],risk:'Front and rear heights differ; a rectangular model gives the wrong side view.',build:'Draw the unequal end faces, join them with depth lines, then add the slope.',read:'Read the side outline first; it controls the top plane.',section:'Section height changes as A–A moves rearward.'};
    }
    if(family==='countersink'){
      const hb=roundStep(h*range(rng,.58,.76)); const r=roundStep(Math.min(w,hb)*range(rng,.10,.14)); const sinkAngle=90; const requestedDepth=roundStep(d*range(rng,.14,.22));
      const sinkR=roundStep(Math.min(Math.min(w,hb)*.34,r+requestedDepth*Math.tan(sinkAngle*Math.PI/360))); const sinkDepth=roundStep((sinkR-r)/Math.tan(sinkAngle*Math.PI/360));
      const cx=roundStep(w*range(rng,.38,.62)); const cz=roundStep(hb*range(rng,.38,.56));
      return {family,w,d,h,p:{hf:h,hb,r,sinkR,sinkDepth,sinkAngle,cx,cz,c:.25},features:['sloped top','countersunk through bore','front chamfers'],risk:'The mouth tapers before it reaches the pilot bore.',build:'Draw the wedge, then taper the front mouth down to the through bore.',read:'The side view carries the countersink angle and depth.',section:'A–A starts with a larger opening that narrows into the pilot bore.'};
    }
    if(family==='fork'){
      const slotW=roundStep(w*range(rng,.30,.38)); const slotBottom=roundStep(h*range(rng,.38,.48)); const lug=(w-slotW)/2; const r=roundStep(Math.min(lug,h-slotBottom)*range(rng,.18,.24)); const z=roundStep(slotBottom+(h-slotBottom)*.47);
      return {family,w,d,h,p:{slotW,slotBottom,r,z},features:['open fork slot','twin through bores','symmetry axis'],risk:'The slot is open at the top, not a closed pocket.',build:'Draw two U-shaped faces, add the bore circles, then join matching edges.',read:'Use the symmetry line to separate the slot from the two lugs.',section:'A–A repeats the fork profile because the slot runs through the depth.'};
    }
    if(family==='bearing'){
      const baseH=roundStep(h*range(rng,.36,.44)); const bossR=roundStep(Math.min(w*.28,h-baseH)); h=roundStep(baseH+bossR); const bossDepth=roundStep(d*range(rng,.45,.66)); const boreR=roundStep(bossR*range(rng,.34,.43));
      return {family,w,d,h,p:{baseH,bossR,bossDepth,boreR,cx:w/2,cz:baseH},features:['round bearing crown','stepped depth','blind bore'],risk:'The crown only extends across the front part of the depth.',build:'Draw the full-depth base, then add the shorter round front boss and its bore.',read:'The right-side shoulder line shows where the crown stops.',section:'Before the shoulder A–A shows the crown and bore; behind it, only the base remains.'};
    }
    if(family==='blind'){
      const c=roundStep(Math.min(w,h)*range(rng,.06,.11)); const r=roundStep(Math.min(w,h)*range(rng,.13,.18)); const cx=roundStep(w*range(rng,.38,.62)); const cz=roundStep(h*range(rng,.42,.60)); const boreDepth=roundStep(d*range(rng,.42,.68));
      return {family,w,d,h,p:{c,r,cx,cz,boreDepth},features:['blind cylindrical bore','corner chamfers','hidden bore end'],risk:'The circle is not a through hole; the rear face stays closed.',build:'Draw the outer block and a front bore ending at the stated depth.',read:'Use the hidden end line in the side view to find the bore depth.',section:'A–A shows a void before the bore bottom and solid material after it.'};
    }
    if(family==='vertical'){
      const cornerR=roundStep(Math.min(w,h)*range(rng,.10,.16)); const holeR=roundStep(Math.min(w*.13,d*.18)); const inset=roundStep(w*range(rng,.25,.30)); const cy=roundStep(d*.5);
      return {family,w,d,h,p:{cornerR,holeR,x1:inset,x2:w-inset,cy},features:['rounded outer corners','twin vertical through holes','depth-band section change'],risk:'The vertical holes are circles from above, but slots where A–A cuts them.',build:'Draw the rounded block, then drill both holes down through the height.',read:'Use the side view to find the depth band of the vertical holes.',section:'A–A only shows the vertical holes while it crosses their circular footprints.'};
    }
    if(family==='pipe'){
      const diameter=roundStep(Math.min(w,h)*range(rng,.72,.90)); const outerR=roundStep(diameter/2); const wall=Math.max(.25,roundStep(outerR*range(rng,.18,.30))); const boreR=Math.max(.25,roundStep(outerR-wall));
      w=h=outerR*2; d=roundStep(diameter*range(rng,1.4,2.2));
      return {family,w,d,h,p:{cx:outerR,cz:outerR,outerR,boreR,wall},features:['circular outside diameter','constant pipe wall','through bore'],risk:'The section is an annulus, not a solid disc.',build:'Draw the outside cylinder, then carry the bore through the full length.',read:'Compare outside and inside diameters to read wall thickness.',section:'A–A repeats the annular pipe wall through the full length.'};
    }
    if(family==='pipeflange'){
      const tubeD=roundStep(Math.min(w,h)*range(rng,.56,.70)); const pipeR=roundStep(tubeD/2); const wall=Math.max(.25,roundStep(tubeD*range(rng,.10,.15))); const boreR=Math.max(.25,roundStep(pipeR-wall)); const boltR=Math.max(.25,roundStep(tubeD*range(rng,.05,.075))); const edge=.25;
      let flangeR=roundStep(pipeR*range(rng,1.75,2)); while(flangeR-pipeR<2*(boltR+edge)+.25)flangeR+=.25;
      const boltCircleR=roundStep((pipeR+flangeR)/2); const flangeT=Math.max(.5,roundStep(tubeD*range(rng,.22,.35))); const tubeLength=roundStep(tubeD*range(rng,1.25,2)); d=roundStep(flangeT+tubeLength); w=h=flangeR*2; const cx=flangeR,cz=flangeR;
      const bolts=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].map(a=>({cx:cx+boltCircleR*Math.cos(a),cz:cz+boltCircleR*Math.sin(a)}));
      return {family,w,d,h,p:{cx,cz,pipeR,boreR,wall,flangeR,flangeT,boltR,boltCircleR,bolts},features:['front flange','four flange bolt holes','hollow pipe barrel'],risk:'Bolt holes disappear from the section behind the flange shoulder.',build:'Draw the pipe barrel, add the thicker front flange, then drill the centre and bolt pattern.',read:'The side shoulder marks the change from flange to pipe wall.',section:'A–A shows five openings in the flange, then only the pipe bore.'};
    }
    if(family==='crossdrill'){
      const cornerR=roundStep(Math.min(w,h)*range(rng,.08,.14)); const r=roundStep(Math.min(w,h)*range(rng,.10,.14)); const holeR=roundStep(Math.min(d*.14,w*.09)); const cx=roundStep(w*.5),cz=roundStep(h*.54),inset=roundStep(w*.24),cy=roundStep(d*.5);
      return {family,w,d,h,p:{cornerR,r,cx,cz,holeR,x1:inset,x2:w-inset,cy},features:['depth-axis through bore','two vertical through holes','rounded block'],risk:'Both hole axes appear together only inside the vertical-hole depth band.',build:'Draw the rounded manifold, drill the axial passage, then add the two vertical ports.',read:'A circular opening and two section slots can coexist in the same cut.',section:'The axial bore is constant; vertical slots appear only where A–A crosses their footprints.'};
    }
    if(family==='ibeam'){
      const flangeT=Math.max(.5,roundStep(h*range(rng,.12,.18))); const webT=Math.max(.5,roundStep(w*range(rng,.10,.16))); d=roundStep(d*range(rng,.75,1.45));
      return {family,w,d,h,p:{flangeT,webT},features:['top and bottom flanges','central web','open side recesses'],risk:'The recessed sides are outside the material, not internal pockets.',build:'Establish both flange thicknesses, then centre the web between them.',read:'The section is the literal transverse I-profile.',section:'A–A repeats the I-profile through the member length.'};
    }
    if(family==='channel'){
      const flangeT=Math.max(.5,roundStep(h*range(rng,.12,.18))); const webT=Math.max(.5,roundStep(w*range(rng,.10,.16))); d=roundStep(d*range(rng,.75,1.45));
      return {family,w,d,h,p:{flangeT,webT},features:['single web','top and bottom flanges','open channel mouth'],risk:'The channel mouth is exterior space, not a closed rectangular void.',build:'Draw the web first, then extend both flanges to the open side.',read:'Keep the open mouth clear of section hatching.',section:'A–A repeats the open channel profile through the member length.'};
    }
    if(family==='stepped'){
      const hMid=roundStep(h*range(rng,.68,.78)); const hRear=Math.min(hMid-.5,roundStep(h*range(rng,.42,.56))); const s1=roundStep(d*range(rng,.25,.35)); const s2=Math.max(s1+.75,roundStep(d*range(rng,.65,.75)));
      return {family,w,d,h,p:{hFront:h,hMid,hRear,s1,s2},features:['three thickness levels','two shoulders','full-width steps'],risk:'The visible front height does not continue through the whole depth.',build:'Lay out the two shoulder positions, then assign front, middle, and rear heights.',read:'Use the side profile to choose the correct section height.',section:'A–A drops at each shoulder as it moves rearward.'};
    }
    if(family==='flange'){
      const rOuter=roundStep(Math.min(h/2,w*.22)); h=roundStep(rOuter*2); const holeR=roundStep(rOuter*range(rng,.23,.31)); const inset=roundStep(w*range(rng,.27,.32));
      return {family,w,d,h,p:{rOuter,holeR,x1:inset,x2:w-inset,cz:h/2},features:['obround outer form','two through bores','double symmetry'],risk:'Two equal circles can hide the obround proportion.',build:'Draw front and rear obround faces, add two bore circles, then join them with depth lines.',read:'Establish both symmetry axes before placing the holes.',section:'A–A repeats the two open bores and obround outline.'};
    }
    throw new Error(`Unknown part family: ${family}`);
  }

  function rect(w,h){return{kind:'rect',w,h}}
  function chamferRect(w,h,c){return{kind:'chamfer',w,h,c}}
  function roundedRect(w,h,r){return{kind:'roundRect',w,h,r}}
  function polygon(points){return{kind:'polygon',points}}
  function roundTop(w,baseH,r,cx=w/2){return{kind:'roundTop',w,baseH,r,cx}}
  function capsule(w,h){return{kind:'capsule',w,h}}
  function disk(cx,cz,r){return{kind:'disk',cx,cz,r}}
  function iProfile(w,h,flangeT,webT){const x1=(w-webT)/2,x2=(w+webT)/2;return polygon([[0,0],[w,0],[w,flangeT],[x2,flangeT],[x2,h-flangeT],[w,h-flangeT],[w,h],[0,h],[0,h-flangeT],[x1,h-flangeT],[x1,flangeT],[0,flangeT]])}
  function channelProfile(w,h,flangeT,webT){return polygon([[0,0],[w,0],[w,flangeT],[webT,flangeT],[webT,h-flangeT],[w,h-flangeT],[w,h],[0,h]])}
  function shapePoints(s,segments=30){
    if(s.kind==='rect')return[[0,0],[s.w,0],[s.w,s.h],[0,s.h]];
    if(s.kind==='chamfer'){const{w,h,c}=s;return[[c,0],[w-c,0],[w,c],[w,h-c],[w-c,h],[c,h],[0,h-c],[0,c]]}
    if(s.kind==='roundRect'){
      const r=Math.min(s.r,s.w/2,s.h/2),n=Math.max(3,Math.round(segments/4)),pts=[];
      [[s.w-r,r,-Math.PI/2,0],[s.w-r,s.h-r,0,Math.PI/2],[r,s.h-r,Math.PI/2,Math.PI],[r,r,Math.PI,Math.PI*1.5]].forEach(([cx,cz,a0,a1],index)=>{
        for(let i=index?1:0;i<=n;i++){const a=a0+(a1-a0)*i/n;pts.push([cx+r*Math.cos(a),cz+r*Math.sin(a)])}
      });
      return pts;
    }
    if(s.kind==='polygon')return s.points;
    if(s.kind==='roundTop'){
      const pts=[[0,0],[s.w,0],[s.w,s.baseH],[s.cx+s.r,s.baseH]];
      for(let i=1;i<=segments;i++){const a=Math.PI*i/segments;pts.push([s.cx+s.r*Math.cos(a),s.baseH+s.r*Math.sin(a)])}
      pts.push([0,s.baseH]);return pts;
    }
    if(s.kind==='capsule'){
      const r=s.h/2, pts=[];
      for(let i=0;i<=segments/2;i++){const a=-Math.PI/2+Math.PI*i/(segments/2);pts.push([s.w-r+r*Math.cos(a),r+r*Math.sin(a)])}
      for(let i=0;i<=segments/2;i++){const a=Math.PI/2+Math.PI*i/(segments/2);pts.push([r+r*Math.cos(a),r+r*Math.sin(a)])}
      return pts;
    }
    if(s.kind==='disk'){const pts=[];for(let i=0;i<segments;i++){const a=Math.PI*2*i/segments;pts.push([s.cx+s.r*Math.cos(a),s.cz+s.r*Math.sin(a)])}return pts}
    return[];
  }
  function mirrorShape(s,w){return polygon(shapePoints(s).map(([x,z])=>[w-x,z]).reverse())}
  function circle(cx,cz,r,visibility='visible',label='',center=true){return{kind:'circle',cx,cz,r,visibility,label,center}}
  function slot(x1,z1,x2,z2,visibility='visible',center=false){return{kind:'slot',x1,z1,x2,z2,visibility,center}}
  function line(x1,z1,x2,z2,kind='visible'){return{x1,z1,x2,z2,kind}}
  function note(label,x,z,tx,tz){return{label,x,z,tx,tz}}
  function makeSpec(width,height,outer,cutouts=[],lines=[],notes=[]){return{width,height,outer:Array.isArray(outer)?outer:[outer],cutouts,lines,notes}}
  function setDimBounds(spec,x1,x2,z1,z2){spec.dimBounds={x1,x2,z1,z2};return spec}
  function flangeBoltCircles(q,visibility='visible'){return q.bolts.map(b=>circle(b.cx,b.cz,q.boltR,visibility,'',false))}
  function mouthCircles(q,mouthR){return[circle(q.cx,q.cz,mouthR,'visible','',false),circle(q.cx,q.cz,q.r)]}
  function verticalFrontLines(p){const q=p.p,lines=[];[q.x1,q.x2].forEach(cx=>{lines.push(line(cx-q.holeR,0,cx-q.holeR,p.h,'hidden'),line(cx+q.holeR,0,cx+q.holeR,p.h,'hidden'),line(cx,-.2,cx,p.h+.2,'center'))});return lines}
  function verticalSideLines(p){const q=p.p;return[line(q.cy-q.holeR,0,q.cy-q.holeR,p.h,'hidden'),line(q.cy+q.holeR,0,q.cy+q.holeR,p.h,'hidden'),line(q.cy,-.2,q.cy,p.h+.2,'center')]}
  function verticalSlots(p,y){const q=p.p,dy=y-q.cy;if(Math.abs(dy)>=q.holeR)return[];const half=Math.sqrt(q.holeR*q.holeR-dy*dy);return half>.015?[slot(q.x1-half,0,q.x1+half,p.h),slot(q.x2-half,0,q.x2+half,p.h)]:[]}
  function axialOpeningRadius(p,y){const q=p.p;if(p.family==='counterbore')return y<=q.cbDepth?q.cbR:q.r;if(p.family==='countersink')return y<=q.sinkDepth?q.sinkR-(q.sinkR-q.r)*(y/q.sinkDepth):q.r;return q.r}

  function frontSpec(p){const q=p.p;
    if(p.family==='bored')return makeSpec(p.w,p.h,chamferRect(p.w,p.h,q.c),[circle(q.cx,q.cz,q.r,'visible',`Ø${mm(q.r*2)}`)],[],[note(`Ø${mm(q.r*2)}`,q.cx+q.r*.7,q.cz+q.r*.7,p.w*.82,p.h*.86),note(`C${mm(q.c)}`,q.c,p.h-q.c,p.w*.12,p.h*.92)]);
    if(p.family==='counterbore')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),mouthCircles(q,q.cbR));
    if(p.family==='wedge')return makeSpec(p.w,q.hf,chamferRect(p.w,q.hf,q.c),[circle(q.cx,q.cz,q.r,'visible',`Ø${mm(q.r*2)}`)],[],[note(`Ø${mm(q.r*2)}`,q.cx+q.r*.7,q.cz+q.r*.7,p.w*.82,q.hf*.84)]);
    if(p.family==='countersink')return makeSpec(p.w,q.hf,chamferRect(p.w,q.hf,q.c),mouthCircles(q,q.sinkR));
    if(p.family==='fork'){const L=(p.w-q.slotW)/2,R=L+q.slotW;const outer=polygon([[0,0],[p.w,0],[p.w,p.h],[R,p.h],[R,q.slotBottom],[L,q.slotBottom],[L,p.h],[0,p.h]]);const x1=L/2,x2=R+(p.w-R)/2;return makeSpec(p.w,p.h,outer,[circle(x1,q.z,q.r,'visible'),circle(x2,q.z,q.r,'visible')],[line(p.w/2,-.25,p.w/2,p.h+.25,'center')],[note(`2× Ø${mm(q.r*2)}`,x2+q.r*.7,q.z+q.r*.7,p.w*.79,p.h*.88),note(`SLOT ${mm(q.slotW)}`,p.w/2,q.slotBottom,p.w*.5,q.slotBottom-.45)]);}
    if(p.family==='bearing')return makeSpec(p.w,p.h,roundTop(p.w,q.baseH,q.bossR,q.cx),[circle(q.cx,q.cz,q.boreR,'visible',`Ø${mm(q.boreR*2)}`)],[line(q.cx,-.25,q.cx,p.h+.25,'center')],[note(`Ø${mm(q.boreR*2)}`,q.cx+q.boreR*.7,q.cz+q.boreR*.7,p.w*.83,p.h*.84)]);
    if(p.family==='blind')return makeSpec(p.w,p.h,chamferRect(p.w,p.h,q.c),[circle(q.cx,q.cz,q.r,'visible',`Ø${mm(q.r*2)}`)],[],[note(`Ø${mm(q.r*2)} BLIND`,q.cx+q.r*.7,q.cz+q.r*.7,p.w*.78,p.h*.87)]);
    if(p.family==='vertical')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[],verticalFrontLines(p));
    if(p.family==='pipe')return makeSpec(p.w,p.h,disk(q.cx,q.cz,q.outerR),[circle(q.cx,q.cz,q.boreR)],[line(q.cx,-.2,q.cx,p.h+.2,'center'),line(-.2,q.cz,p.w+.2,q.cz,'center')]);
    if(p.family==='pipeflange')return makeSpec(p.w,p.h,disk(q.cx,q.cz,q.flangeR),[circle(q.cx,q.cz,q.boreR),...flangeBoltCircles(q)],[line(q.cx,-.2,q.cx,p.h+.2,'center'),line(-.2,q.cz,p.w+.2,q.cz,'center')]);
    if(p.family==='crossdrill')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[circle(q.cx,q.cz,q.r)],verticalFrontLines(p));
    if(p.family==='ibeam')return makeSpec(p.w,p.h,iProfile(p.w,p.h,q.flangeT,q.webT),[],[line(p.w/2,-.2,p.w/2,p.h+.2,'center')]);
    if(p.family==='channel')return makeSpec(p.w,p.h,channelProfile(p.w,p.h,q.flangeT,q.webT));
    if(p.family==='stepped')return makeSpec(p.w,p.h,rect(p.w,p.h),[],[line(0,q.hMid,p.w,q.hMid,'hidden'),line(0,q.hRear,p.w,q.hRear,'hidden')]);
    if(p.family==='flange')return makeSpec(p.w,p.h,capsule(p.w,p.h),[circle(q.x1,q.cz,q.holeR,'visible'),circle(q.x2,q.cz,q.holeR,'visible')],[line(p.w/2,-.2,p.w/2,p.h+.2,'center'),line(-.2,q.cz,p.w+.2,q.cz,'center')],[note(`2× Ø${mm(q.holeR*2)}`,q.x2+q.holeR*.7,q.cz+q.holeR*.7,p.w*.79,p.h*.87)]);
    throw new Error(`No front view for ${p.family}`);
  }
  function backSpec(p){const q=p.p;
    if(p.family==='counterbore')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[circle(p.w-q.cx,q.cz,q.r,'visible')]);
    if(p.family==='wedge')return makeSpec(p.w,q.hb,chamferRect(p.w,q.hb,q.c),[circle(p.w-q.cx,q.cz,q.r,'visible')]);
    if(p.family==='countersink')return makeSpec(p.w,q.hb,mirrorShape(chamferRect(p.w,q.hb,q.c),p.w),[circle(p.w-q.cx,q.cz,q.r,'visible')]);
    if(p.family==='bearing')return makeSpec(p.w,p.h,roundTop(p.w,q.baseH,q.bossR,q.cx),[circle(q.cx,q.cz,q.boreR,'hidden')],[line(0,q.baseH,p.w,q.baseH,'hidden'),line(q.cx,-.2,q.cx,p.h+.2,'center')]);
    if(p.family==='blind')return makeSpec(p.w,p.h,mirrorShape(chamferRect(p.w,p.h,q.c),p.w),[circle(p.w-q.cx,q.cz,q.r,'hidden')]);
    if(p.family==='vertical')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[],verticalFrontLines(p));
    if(p.family==='pipeflange')return makeSpec(p.w,p.h,[disk(q.cx,q.cz,q.flangeR),disk(q.cx,q.cz,q.pipeR)],[circle(q.cx,q.cz,q.boreR),...flangeBoltCircles(q)],[line(q.cx,-.2,q.cx,p.h+.2,'center'),line(-.2,q.cz,p.w+.2,q.cz,'center')]);
    if(p.family==='crossdrill')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[circle(p.w-q.cx,q.cz,q.r)],verticalFrontLines(p));
    if(p.family==='stepped')return makeSpec(p.w,q.hRear,rect(p.w,q.hRear));
    const s=frontSpec(p);return{...s,outer:s.outer.map(o=>mirrorShape(o,p.w)),cutouts:s.cutouts.map(c=>c.kind==='circle'?{...c,cx:p.w-c.cx}:c),notes:[]};
  }
  function sideSpec(p){const q=p.p;let outer=rect(p.d,p.h),cuts=[],lines=[],notes=[];
    const boreLines=(z,r,x2=p.d,end=false)=>{lines.push(line(0,z-r,x2,z-r,'hidden'),line(0,z+r,x2,z+r,'hidden'),line(0,z,x2,z,'center'));if(end)lines.push(line(x2,z-r,x2,z+r,'hidden'))};
    const steppedBoreLines=(z,r,mouthR,depth,end=p.d)=>{lines.push(line(0,z-mouthR,depth,z-mouthR,'hidden'),line(0,z+mouthR,depth,z+mouthR,'hidden'),line(depth,z-mouthR,depth,z-r,'hidden'),line(depth,z+mouthR,depth,z+r,'hidden'),line(depth,z-r,end,z-r,'hidden'),line(depth,z+r,end,z+r,'hidden'),line(0,z,end,z,'center'))};
    const taperBoreLines=(z,r,mouthR,depth,end=p.d)=>{lines.push(line(0,z-mouthR,depth,z-r,'hidden'),line(0,z+mouthR,depth,z+r,'hidden'),line(depth,z-r,end,z-r,'hidden'),line(depth,z+r,end,z+r,'hidden'),line(0,z,end,z,'center'))};
    if(p.family==='counterbore'){steppedBoreLines(q.cz,q.r,q.cbR,q.cbDepth);}
    else if(p.family==='wedge'){outer=polygon([[0,0],[p.d,0],[p.d,q.hb],[0,q.hf]]);boreLines(q.cz,q.r);const ang=Math.atan2(q.hf-q.hb,p.d)*180/Math.PI;notes.push(note(`SLOPE ${deg(ang)}`,p.d*.55,(q.hf+q.hb)/2,p.d*.75,p.h*.93));}
    else if(p.family==='countersink'){outer=polygon([[0,0],[p.d,0],[p.d,q.hb],[0,q.hf]]);taperBoreLines(q.cz,q.r,q.sinkR,q.sinkDepth);}
    else if(p.family==='fork'){boreLines(q.z,q.r);lines.push(line(0,q.slotBottom,p.d,q.slotBottom,'hidden'));}
    else if(p.family==='bearing'){outer=polygon([[0,0],[p.d,0],[p.d,q.baseH],[q.bossDepth,q.baseH],[q.bossDepth,p.h],[0,p.h]]);boreLines(q.cz,q.boreR,q.bossDepth,true);notes.push(note(`BOSS ${mm(q.bossDepth)} DEEP`,q.bossDepth,p.h*.72,p.d*.64,p.h*.91));}
    else if(p.family==='blind'){boreLines(q.cz,q.r,q.boreDepth,true);notes.push(note(`DEPTH ${mm(q.boreDepth)}`,q.boreDepth,q.cz+q.r,p.d*.7,p.h*.88));}
    else if(p.family==='vertical'){lines.push(...verticalSideLines(p));}
    else if(p.family==='pipe'){boreLines(q.cz,q.boreR);}
    else if(p.family==='pipeflange'){outer=polygon([[0,0],[q.flangeT,0],[q.flangeT,q.cz-q.pipeR],[p.d,q.cz-q.pipeR],[p.d,q.cz+q.pipeR],[q.flangeT,q.cz+q.pipeR],[q.flangeT,p.h],[0,p.h]]);boreLines(q.cz,q.boreR);const levels=[];q.bolts.forEach(b=>{if(!levels.some(z=>Math.abs(z-b.cz)<.01))levels.push(b.cz)});levels.forEach(z=>boreLines(z,q.boltR,q.flangeT,true));}
    else if(p.family==='crossdrill'){boreLines(q.cz,q.r);lines.push(...verticalSideLines(p));}
    else if(p.family==='ibeam'||p.family==='channel'){lines.push(line(0,q.flangeT,p.d,q.flangeT,'visible'),line(0,p.h-q.flangeT,p.d,p.h-q.flangeT,'visible'));}
    else if(p.family==='stepped'){outer=polygon([[0,0],[p.d,0],[p.d,q.hRear],[q.s2,q.hRear],[q.s2,q.hMid],[q.s1,q.hMid],[q.s1,q.hFront],[0,q.hFront]]);}
    else if(p.family==='flange'){boreLines(q.cz,q.holeR);}
    else if(p.family==='bored')boreLines(q.cz,q.r);
    else throw new Error(`No side view for ${p.family}`);
    return makeSpec(p.d,p.h,outer,cuts,lines,notes);
  }
  function sectionSpec(p,y){const q=p.p;
    if(p.family==='counterbore')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[circle(q.cx,q.cz,axialOpeningRadius(p,y),'visible')]);
    if(p.family==='wedge'){const hh=q.hf+(q.hb-q.hf)*(y/p.d);return makeSpec(p.w,Math.max(q.hf,q.hb),chamferRect(p.w,hh,Math.min(q.c,hh/2)),[circle(q.cx,q.cz,q.r,'visible')]);}
    if(p.family==='countersink'){const hh=q.hf+(q.hb-q.hf)*(y/p.d);return makeSpec(p.w,Math.max(q.hf,q.hb),chamferRect(p.w,hh,Math.min(q.c,hh/2)),[circle(q.cx,q.cz,axialOpeningRadius(p,y),'visible')]);}
    if(p.family==='bearing'){return y<=q.bossDepth?makeSpec(p.w,p.h,roundTop(p.w,q.baseH,q.bossR,q.cx),[circle(q.cx,q.cz,q.boreR,'visible')],[line(q.cx,-.2,q.cx,p.h+.2,'center')]):makeSpec(p.w,p.h,rect(p.w,q.baseH),[],[line(q.cx,-.2,q.cx,p.h+.2,'center')]);}
    if(p.family==='blind')return makeSpec(p.w,p.h,chamferRect(p.w,p.h,q.c),y<=q.boreDepth?[circle(q.cx,q.cz,q.r,'visible')]:[]);
    if(p.family==='vertical')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),verticalSlots(p,y));
    if(p.family==='pipeflange'){if(y<=q.flangeT)return frontSpec(p);return setDimBounds(makeSpec(p.w,p.h,disk(q.cx,q.cz,q.pipeR),[circle(q.cx,q.cz,q.boreR)]),q.cx-q.pipeR,q.cx+q.pipeR,q.cz-q.pipeR,q.cz+q.pipeR);}
    if(p.family==='crossdrill')return makeSpec(p.w,p.h,roundedRect(p.w,p.h,q.cornerR),[circle(q.cx,q.cz,q.r),...verticalSlots(p,y)]);
    if(p.family==='stepped'){const hh=y<=q.s1?q.hFront:y<=q.s2?q.hMid:q.hRear;return setDimBounds(makeSpec(p.w,p.h,rect(p.w,hh)),0,p.w,0,hh);}
    return frontSpec(p);
  }
  function viewSpec(p,type){const y=p.d*state.sectionPct/100;if(type==='front')return frontSpec(p);if(type==='back')return backSpec(p);if(type==='side')return sideSpec(p);return sectionSpec(p,y)}

  function drawShapePath(shape,X,Y){const pts=shapePoints(shape);return pts.length?`M ${pts.map(([x,z])=>`${X(x)} ${Y(z)}`).join(' L ')} Z`:''}
  function renderView(svg,type){
    clear(svg);const p=state.part,spec=viewSpec(p,type),W=420,H=286,padL=62,padR=28,padT=35,padB=48;const scale=Math.min((W-padL-padR)/spec.width,(H-padT-padB)/spec.height),ox=padL+(W-padL-padR-spec.width*scale)/2,oy=padT+(H-padT-padB-spec.height*scale)/2;const X=x=>ox+x*scale,Y=z=>oy+(spec.height-z)*scale;
    const defs=make('defs'),pat=make('pattern',{id:`hatch-${type}`,width:7,height:7,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});pat.appendChild(make('line',{x1:0,y1:0,x2:0,y2:7,stroke:'currentColor','stroke-opacity':.38,'stroke-width':1}));defs.appendChild(pat);svg.appendChild(defs);
    const g=make('g',{'stroke-linecap':'square','stroke-linejoin':'miter'});svg.appendChild(g);const dimMode=$('#dimMode').value;
    const showHidden=$('#showHidden')?.checked??true,showCenters=$('#showCenters')?.checked??true,showHatch=$('#showHatch')?.checked??true;
    if(dimMode==='full'){for(let x=0;x<=Math.ceil(spec.width);x++)g.appendChild(make('line',{x1:X(x),y1:Y(0),x2:X(x),y2:Y(spec.height),stroke:'currentColor','stroke-opacity':.09,'stroke-width':.65}));for(let z=0;z<=Math.ceil(spec.height);z++)g.appendChild(make('line',{x1:X(0),y1:Y(z),x2:X(spec.width),y2:Y(z),stroke:'currentColor','stroke-opacity':.09,'stroke-width':.65}));}
    spec.outer.forEach(o=>g.appendChild(make('path',{d:drawShapePath(o,X,Y),fill:type==='section'?(showHatch?`url(#hatch-${type})`:'none'):'currentColor','fill-opacity':type==='section'?(showHatch?1:0):.035,stroke:'currentColor','stroke-width':2.15}))); 
    spec.cutouts.forEach(c=>{const visible=c.visibility!=='hidden',show=visible||showHidden;if(!show)return;
      if(c.kind==='circle'){g.appendChild(make('circle',{cx:X(c.cx),cy:Y(c.cz),r:c.r*scale,fill:visible?'var(--paper)':'none',stroke:'currentColor','stroke-width':visible?2:1.05,'stroke-dasharray':visible?'none':'6 4'}));if(showCenters&&c.center!==false){g.appendChild(make('line',{x1:X(c.cx-c.r*1.5),y1:Y(c.cz),x2:X(c.cx+c.r*1.5),y2:Y(c.cz),stroke:'currentColor','stroke-width':.85,'stroke-opacity':.66,'stroke-dasharray':'10 4 2 4'}));g.appendChild(make('line',{x1:X(c.cx),y1:Y(c.cz-c.r*1.5),x2:X(c.cx),y2:Y(c.cz+c.r*1.5),stroke:'currentColor','stroke-width':.85,'stroke-opacity':.66,'stroke-dasharray':'10 4 2 4'}));}}
      if(c.kind==='slot'){const x=Math.min(X(c.x1),X(c.x2)),y=Math.min(Y(c.z1),Y(c.z2)),width=Math.abs(X(c.x2)-X(c.x1)),height=Math.abs(Y(c.z2)-Y(c.z1));g.appendChild(make('rect',{x,y,width,height,fill:visible?'var(--paper)':'none',stroke:'currentColor','stroke-width':visible?2:1.05,'stroke-dasharray':visible?'none':'6 4'}));if(showCenters&&c.center){const cx=(c.x1+c.x2)/2;g.appendChild(make('line',{x1:X(cx),y1:Y(c.z1)-8,x2:X(cx),y2:Y(c.z2)+8,stroke:'currentColor','stroke-width':.85,'stroke-opacity':.66,'stroke-dasharray':'10 4 2 4'}));}}
    });
    spec.lines.forEach(l=>{if(l.kind==='hidden'&&!showHidden)return;if(l.kind==='center'&&!showCenters)return;const attrs={x1:X(l.x1),y1:Y(l.z1),x2:X(l.x2),y2:Y(l.z2),stroke:'currentColor','stroke-width':l.kind==='visible'?1.5:l.kind==='hidden'?1.05:.85,'stroke-opacity':l.kind==='center'?.68:.9};if(l.kind==='hidden')attrs['stroke-dasharray']='6 4';if(l.kind==='center')attrs['stroke-dasharray']='11 4 2 4';g.appendChild(make('line',attrs));});
    if(type==='side'){const cutX=X(p.d*state.sectionPct/100);g.appendChild(make('line',{x1:cutX,y1:Y(spec.height)+7,x2:cutX,y2:Y(0)-7,stroke:'currentColor','stroke-width':1.1,'stroke-dasharray':'12 4 2 4'}));text(svg,cutX-8,Y(spec.height)-11,'A',{'font-weight':'700'});text(svg,cutX-8,Y(0)+21,'A',{'font-weight':'700'});}
    const allowNotes=dimMode==='full';if(allowNotes)spec.notes.forEach(n=>{g.appendChild(make('line',{x1:X(n.x),y1:Y(n.z),x2:X(n.tx),y2:Y(n.tz),stroke:'currentColor','stroke-width':.8}));text(svg,X(n.tx),Y(n.tz)-4,n.label,{'font-size':9,'text-anchor':n.tx>spec.width*.6?'end':'start','font-weight':'700'});});
    if(dimMode!=='none')drawOverallDims(svg,g,spec,X,Y,type);
    if(type==='section')text(svg,W-25,H-12,`A–A @ ${mm(p.d*state.sectionPct/100)} mm FROM FRONT`,{'text-anchor':'end','font-size':9});
  }
  function drawOverallDims(svg,g,spec,X,Y,type){const b=spec.dimBounds||{x1:0,x2:spec.width,z1:0,z2:spec.height},yD=Y(b.z1)+27;g.appendChild(make('line',{x1:X(b.x1),y1:yD,x2:X(b.x2),y2:yD,stroke:'currentColor','stroke-width':.9}));g.appendChild(make('line',{x1:X(b.x1),y1:yD-5,x2:X(b.x1),y2:yD+5,stroke:'currentColor'}));g.appendChild(make('line',{x1:X(b.x2),y1:yD-5,x2:X(b.x2),y2:yD+5,stroke:'currentColor'}));text(svg,(X(b.x1)+X(b.x2))/2,yD-5,`${mm(b.x2-b.x1)} mm`,{'text-anchor':'middle'});const xD=X(b.x1)-28;g.appendChild(make('line',{x1:xD,y1:Y(b.z2),x2:xD,y2:Y(b.z1),stroke:'currentColor','stroke-width':.9}));g.appendChild(make('line',{x1:xD-5,y1:Y(b.z2),x2:xD+5,y2:Y(b.z2),stroke:'currentColor'}));g.appendChild(make('line',{x1:xD-5,y1:Y(b.z1),x2:xD+5,y2:Y(b.z1),stroke:'currentColor'}));const t=text(svg,xD-7,(Y(b.z1)+Y(b.z2))/2,`${mm(b.z2-b.z1)} mm`,{'text-anchor':'middle'});t.setAttribute('transform',`rotate(-90 ${xD-7} ${(Y(b.z1)+Y(b.z2))/2})`);}

  function isoFrame(p){
    const W=520,H=370,padX=30,padTop=48,padBottom=24;
    const projectedWidth=(p.w+p.d)*.78;
    const projectedHeight=(p.w+p.d)*.38+p.h*.78;
    const s=Math.min(42,(W-padX*2)/projectedWidth,(H-padTop-padBottom)/projectedHeight);
    const sx=s*.78,sy=s*.38,sz=s*.78;
    const minX=-p.d*sx,maxX=p.w*sx,minY=-p.h*sz,maxY=(p.w+p.d)*sy;
    const ox=padX+((W-padX*2)-(maxX-minX))/2-minX;
    const oy=padTop+((H-padTop-padBottom)-(maxY-minY))/2-minY;
    return{sx,sy,sz,ox,oy};
  }
  function isoPoint(p,x,y,z){const f=isoFrame(p);return[f.ox+(x-y)*f.sx,f.oy+(x+y)*f.sy-z*f.sz]}
  function isoPoly(svg,pts,fill,opacity=.18,dash=''){const el=make('polygon',{points:pts.map(v=>v.join(',')).join(' '),fill,stroke:'currentColor','stroke-width':1.1,'fill-opacity':opacity,'stroke-opacity':.78});if(dash)el.setAttribute('stroke-dasharray',dash);svg.appendChild(el)}
  function extrudeIso(svg,p,shape,y0,y1,opacity=.16){const pts=shapePoints(shape,34),front=pts.map(([x,z])=>isoPoint(p,x,y0,z)),back=pts.map(([x,z])=>isoPoint(p,x,y1,z));isoPoly(svg,back,'var(--accent)',opacity*.55);for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length,facet=shape.kind==='disk'?opacity*.78:opacity*(.62+(i%3)*.18);isoPoly(svg,[front[i],front[j],back[j],back[i]],'var(--accent)',facet);}isoPoly(svg,front,'var(--accent)',opacity*1.35);}
  function loftIso(svg,p,frontShape,backShape){const a=shapePoints(frontShape,4),b=shapePoints(backShape,4),fa=a.map(([x,z])=>isoPoint(p,x,0,z)),bb=b.map(([x,z])=>isoPoint(p,x,p.d,z));isoPoly(svg,bb,'var(--accent)',.08);for(let i=0;i<a.length;i++){const j=(i+1)%a.length;isoPoly(svg,[fa[i],fa[j],bb[j],bb[i]],'var(--accent)',.13+(i%2)*.05)}isoPoly(svg,fa,'var(--accent)',.22)}
  function steppedIso(svg,p){const q=p.p,P=(x,y,z)=>isoPoint(p,x,y,z),fill='var(--accent)';const side=x=>[[x,0,0],[x,p.d,0],[x,p.d,q.hRear],[x,q.s2,q.hRear],[x,q.s2,q.hMid],[x,q.s1,q.hMid],[x,q.s1,q.hFront],[x,0,q.hFront]].map(v=>P(...v));isoPoly(svg,[P(0,p.d,0),P(p.w,p.d,0),P(p.w,p.d,q.hRear),P(0,p.d,q.hRear)],fill,.08);isoPoly(svg,side(0),fill,.11);isoPoly(svg,side(p.w),fill,.15);isoPoly(svg,[P(0,0,0),P(p.w,0,0),P(p.w,p.d,0),P(0,p.d,0)],fill,.09);[[0,q.s1,q.hFront],[q.s1,q.s2,q.hMid],[q.s2,p.d,q.hRear]].forEach(([a,b,z])=>isoPoly(svg,[P(0,a,z),P(p.w,a,z),P(p.w,b,z),P(0,b,z)],fill,.18));isoPoly(svg,[P(0,q.s1,q.hMid),P(p.w,q.s1,q.hMid),P(p.w,q.s1,q.hFront),P(0,q.s1,q.hFront)],fill,.2);isoPoly(svg,[P(0,q.s2,q.hRear),P(p.w,q.s2,q.hRear),P(p.w,q.s2,q.hMid),P(0,q.s2,q.hMid)],fill,.18);isoPoly(svg,[P(0,0,0),P(p.w,0,0),P(p.w,0,q.hFront),P(0,0,q.hFront)],fill,.22);}
  function isoCircle(svg,p,cx,y,cz,r,hidden=false,fillOpacity=hidden?0:.9,fill='var(--paper)'){const pts=[];for(let i=0;i<40;i++){const a=Math.PI*2*i/40;pts.push(isoPoint(p,cx+r*Math.cos(a),y,cz+r*Math.sin(a)))}const el=make('polygon',{points:pts.map(v=>v.join(',')).join(' '),fill,'fill-opacity':fillOpacity,stroke:'currentColor','stroke-width':1.25,'stroke-opacity':hidden?.52:1,'stroke-dasharray':hidden?'5 4':'none'});svg.appendChild(el)}
  function isoTopCirclePoints(p,cx,cy,z,r){const pts=[];for(let i=0;i<40;i++){const a=Math.PI*2*i/40;pts.push(isoPoint(p,cx+r*Math.cos(a),cy+r*Math.sin(a),z))}return pts}
  function isoTopCircle(svg,p,cx,cy,z,r,hidden=false,fillOpacity=hidden?0:.9,fill='var(--paper)'){const pts=isoTopCirclePoints(p,cx,cy,z,r),el=make('polygon',{points:pts.map(v=>v.join(',')).join(' '),fill,'fill-opacity':fillOpacity,stroke:'currentColor','stroke-width':1.25,'stroke-opacity':hidden?.52:1,'stroke-dasharray':hidden?'5 4':'none'});svg.appendChild(el);return pts}
  function isoBoreGenerators(svg,p,cx,cz,r0,y0,r1,y1,dash='',opacity=.64){const f=isoFrame(p),tangent=Math.atan2(-f.sz,2*f.sy);[tangent,tangent+Math.PI].forEach(a=>{const start=isoPoint(p,cx+r0*Math.cos(a),y0,cz+r0*Math.sin(a)),end=isoPoint(p,cx+r1*Math.cos(a),y1,cz+r1*Math.sin(a)),attrs={x1:start[0],y1:start[1],x2:end[0],y2:end[1],stroke:'currentColor','stroke-width':1.1,'stroke-opacity':opacity};if(dash)attrs['stroke-dasharray']=dash;svg.appendChild(make('line',attrs));});}
  function isoCounterbore(svg,p,cx,cz,r,mouthR,depth){isoCircle(svg,p,cx,p.d,cz,r,true);isoBoreGenerators(svg,p,cx,cz,r,depth,r,p.d,'4 3');isoBoreGenerators(svg,p,cx,cz,mouthR,0,mouthR,depth,'',.72);isoCircle(svg,p,cx,0,cz,mouthR);isoCircle(svg,p,cx,depth,cz,mouthR,false,0);isoCircle(svg,p,cx,depth,cz,r,false,0);}
  function isoCountersink(svg,p,cx,cz,r,mouthR,depth){isoCircle(svg,p,cx,p.d,cz,r,true);isoBoreGenerators(svg,p,cx,cz,r,depth,r,p.d,'4 3');isoBoreGenerators(svg,p,cx,cz,mouthR,0,r,depth,'',.72);isoCircle(svg,p,cx,0,cz,mouthR);isoCircle(svg,p,cx,depth,cz,r,false,0);}
  function isoVerticalBore(svg,p,cx,cy,r){const top=isoTopCirclePoints(p,cx,cy,p.h,r),bottom=isoTopCirclePoints(p,cx,cy,0,r),edges=[top.reduce((best,pt,index)=>pt[0]<top[best][0]?index:best,0),top.reduce((best,pt,index)=>pt[0]>top[best][0]?index:best,0)];isoTopCircle(svg,p,cx,cy,0,r,true);edges.forEach(index=>{const a=top[index],b=bottom[index];svg.appendChild(make('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'currentColor','stroke-width':1.1,'stroke-opacity':.64,'stroke-dasharray':'4 3'}));});isoTopCircle(svg,p,cx,cy,p.h,r);}
  function isoThroughBore(svg,p,cx,cz,r,yStart=0,yEnd=p.d){const f=isoFrame(p),tangent=Math.atan2(-f.sz,2*f.sy);isoCircle(svg,p,cx,yEnd,cz,r,true);[tangent,tangent+Math.PI].forEach(a=>{const front=isoPoint(p,cx+r*Math.cos(a),yStart,cz+r*Math.sin(a)),rear=isoPoint(p,cx+r*Math.cos(a),yEnd,cz+r*Math.sin(a));svg.appendChild(make('line',{x1:front[0],y1:front[1],x2:rear[0],y2:rear[1],stroke:'currentColor','stroke-width':1.1,'stroke-opacity':.64,'stroke-dasharray':'4 3'}));});isoCircle(svg,p,cx,yStart,cz,r)}
  function isoThroughBores(p){const q=p.p;if(p.family==='bored'||p.family==='wedge'||p.family==='crossdrill')return[{cx:q.cx,cz:q.cz,r:q.r}];if(p.family==='pipe'||p.family==='pipeflange')return[{cx:q.cx,cz:q.cz,r:q.boreR}];if(p.family==='fork'){const L=(p.w-q.slotW)/2,R=L+q.slotW;return[{cx:L/2,cz:q.z,r:q.r},{cx:R+(p.w-R)/2,cz:q.z,r:q.r}]}if(p.family==='flange')return[{cx:q.x1,cz:q.cz,r:q.holeR},{cx:q.x2,cz:q.cz,r:q.holeR}];return[]}
  function isoLimitedBore(svg,p,cx,cz,r,yEnd){const f=isoFrame(p),tangent=Math.atan2(-f.sz,2*f.sy);isoCircle(svg,p,cx,yEnd,cz,r,false,.18,'var(--accent)');[tangent,tangent+Math.PI].forEach(a=>{const front=isoPoint(p,cx+r*Math.cos(a),0,cz+r*Math.sin(a)),end=isoPoint(p,cx+r*Math.cos(a),yEnd,cz+r*Math.sin(a));svg.appendChild(make('line',{x1:front[0],y1:front[1],x2:end[0],y2:end[1],stroke:'currentColor','stroke-width':1.1,'stroke-opacity':.64}));});isoCircle(svg,p,cx,0,cz,r)}
  function isoLimitedBores(p){const q=p.p;if(p.family==='bearing')return[{cx:q.cx,cz:q.cz,r:q.boreR,yEnd:q.bossDepth}];if(p.family==='blind')return[{cx:q.cx,cz:q.cz,r:q.r,yEnd:q.boreDepth}];return[]}
  function isoPlaneAperture(svg,p,cx,y,cz,r){const pts=[];for(let i=0;i<40;i++){const a=Math.PI*2*i/40;pts.push(isoPoint(p,cx+r*Math.cos(a),y,cz+r*Math.sin(a)))}svg.appendChild(make('polygon',{points:pts.map(v=>v.join(',')).join(' '),fill:'var(--paper)','fill-opacity':.96,stroke:'var(--section-plane,#c6632f)','stroke-width':1.25,'stroke-dasharray':'5 3'}))}
  function isoPlaneSlot(svg,p,y,x1,z1,x2,z2){const pts=[isoPoint(p,x1,y,z1),isoPoint(p,x2,y,z1),isoPoint(p,x2,y,z2),isoPoint(p,x1,y,z2)];svg.appendChild(make('polygon',{points:pts.map(v=>v.join(',')).join(' '),fill:'var(--paper)','fill-opacity':.96,stroke:'var(--section-plane,#c6632f)','stroke-width':1.25,'stroke-dasharray':'5 3'}))}
  function isoSectionPlane(svg,p,y,shape){const pts=shapePoints(shape,34).map(([x,z])=>isoPoint(p,x,y,z));svg.appendChild(make('polygon',{points:pts.map(v=>v.join(',')).join(' '),fill:'var(--section-plane,#c6632f)','fill-opacity':.13,stroke:'var(--section-plane,#c6632f)','stroke-width':1.7,'stroke-dasharray':'9 5'}));}
  function isoPlaneCutout(svg,p,y,cutout){if(cutout.kind==='circle')isoPlaneAperture(svg,p,cutout.cx,y,cutout.cz,cutout.r);if(cutout.kind==='slot')isoPlaneSlot(svg,p,y,cutout.x1,cutout.z1,cutout.x2,cutout.z2)}
  function renderIso(){const svg=$('#isoView');clear(svg);const p=state.part,q=p.p;
    if(p.family==='wedge'||p.family==='countersink')loftIso(svg,p,chamferRect(p.w,q.hf,q.c),chamferRect(p.w,q.hb,q.c));
    else if(p.family==='pipeflange'){extrudeIso(svg,p,disk(q.cx,q.cz,q.pipeR),q.flangeT,p.d,.13);extrudeIso(svg,p,disk(q.cx,q.cz,q.flangeR),0,q.flangeT,.18);}
    else if(p.family==='stepped')steppedIso(svg,p);
    else if(p.family==='bearing'){extrudeIso(svg,p,rect(p.w,q.baseH),0,p.d,.13);extrudeIso(svg,p,roundTop(p.w,q.baseH,q.bossR,q.cx),0,q.bossDepth,.18);}
    else {extrudeIso(svg,p,frontSpec(p).outer[0],0,p.d,.16);}
    const throughBores=isoThroughBores(p);throughBores.forEach(bore=>isoThroughBore(svg,p,bore.cx,bore.cz,bore.r));
    if(p.family==='counterbore')isoCounterbore(svg,p,q.cx,q.cz,q.r,q.cbR,q.cbDepth);
    if(p.family==='countersink')isoCountersink(svg,p,q.cx,q.cz,q.r,q.sinkR,q.sinkDepth);
    const limitedBores=isoLimitedBores(p);limitedBores.forEach(bore=>isoLimitedBore(svg,p,bore.cx,bore.cz,bore.r,bore.yEnd));
    if(p.family==='pipeflange')q.bolts.forEach(b=>isoThroughBore(svg,p,b.cx,b.cz,q.boltR,0,q.flangeT));
    if(p.family==='vertical'||p.family==='crossdrill')[q.x1,q.x2].forEach(cx=>isoVerticalBore(svg,p,cx,q.cy,q.holeR));
    const yCut=p.d*state.sectionPct/100;
    const planeSpec=sectionSpec(p,yCut);planeSpec.outer.forEach(shape=>isoSectionPlane(svg,p,yCut,shape));planeSpec.cutouts.forEach(cutout=>isoPlaneCutout(svg,p,yCut,cutout));
    text(svg,22,28,'CUTTING PLANE',{'font-size':11,'font-weight':'700'});
    text(svg,22,45,`A–A @ ${mm(yCut)} mm FROM FRONT`,{'font-size':9,'font-weight':'700',fill:'var(--section-plane,#c6632f)'});
  }

  function generate(){const difficulty=$('#difficulty').value;let family=$('#family').value;const seed=Math.floor(Math.random()*999999999),rng=seeded(seed);if(family==='random')family=pick(rng,familyIds);state.seed=seed;state.part=createPart(family,difficulty,rng);state.sectionPct=50;if(family==='counterbore')state.sectionPct=Math.round((state.part.p.cbDepth/state.part.d)*100*.6);if(family==='countersink')state.sectionPct=Math.round((state.part.p.sinkDepth/state.part.d)*100*.55);if(family==='bearing')state.sectionPct=Math.round((state.part.p.bossDepth/state.part.d)*100*.82);if(family==='blind')state.sectionPct=Math.round((state.part.p.boreDepth/state.part.d)*100*.82);if(family==='vertical'||family==='crossdrill')state.sectionPct=Math.round((state.part.p.cy/state.part.d)*100);if(family==='pipeflange')state.sectionPct=Math.round((state.part.p.flangeT/state.part.d)*100*.65);$('#sectionDepth').value=state.sectionPct;const id='SL-'+String(seed%10000).padStart(4,'0');
    $('#drawingTitle').textContent=`SECTION LAB / ${id}`;$('#tbDrawing').textContent=id;rerender();renderIso();dispatch('sectionlab:generated');}
  function rerender(){if(!state.part)return;['front','side','back','section'].forEach(v=>renderView($('#'+v+'View'),v));}

  $('#generateBtn').addEventListener('click',generate);['showHidden','showCenters','showHatch'].forEach(id=>$('#'+id)?.addEventListener('change',rerender));$('#dimMode').addEventListener('change',rerender);
  $('#sectionDepth').addEventListener('input',e=>{state.sectionPct=Number(e.target.value);renderView($('#sideView'),'side');renderView($('#sectionView'),'section');renderIso();dispatch('sectionlab:sectionchange');});
  $('#printBtn').addEventListener('click',()=>window.print());
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
  function exportCard(){const views=['front','side','back','section'],placements=[[30,105],[530,105],[30,460],[530,460]];let blocks='';views.forEach((v,i)=>{const node=$('#'+v+'View').cloneNode(true);node.setAttribute('x',placements[i][0]);node.setAttribute('y',placements[i][1]);node.setAttribute('width',460);node.setAttribute('height',315);blocks+=`<g><rect x="${placements[i][0]}" y="${placements[i][1]}" width="460" height="315" fill="white" stroke="#111"/><text x="${placements[i][0]+10}" y="${placements[i][1]+18}" font-family="monospace" font-size="12" font-weight="700">${v==='side'?'RIGHT SIDE':v==='section'?'SECTION A–A':v.toUpperCase()}</text>${node.outerHTML}</g>`});const id=$('#tbDrawing').textContent,p=state.part;const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="820" viewBox="0 0 1050 820"><rect width="1050" height="820" fill="white"/><style>:root{--paper:#fff;--accent:#1f5d72}svg{color:#111}text{fill:#111}</style><text x="30" y="42" font-family="monospace" font-size="24" font-weight="700">SECTION LAB / ${esc(id)}</text><text x="30" y="67" font-family="monospace" font-size="11">SECTION STUDY · ${esc(familyNames[p.family])} · UNIT ${unit()} mm</text><line x1="30" y1="82" x2="1020" y2="82" stroke="#111" stroke-width="2"/>${blocks}<line x1="30" y1="792" x2="1020" y2="792" stroke="#111"/><text x="30" y="810" font-family="monospace" font-size="10">STUDY SHEET · SECTION A–A PARALLEL TO FRONT · NOT FOR MANUFACTURE</text></svg>`;const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${id.toLowerCase()}-section-study.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);showToast('SVG downloaded')}
  $('#downloadBtn').addEventListener('click',exportCard);function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
  window.SectionLabCore={state,familyNames,familyIds,baseUnit:BASE_UNIT,generate,rerender,renderIso,renderView,setSectionPct(value){state.sectionPct=Number(value);$('#sectionDepth').value=state.sectionPct;renderView($('#sideView'),'side');renderView($('#sectionView'),'section');renderIso();dispatch('sectionlab:sectionchange')}};
  generate();
})();
