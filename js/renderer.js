import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js?v=092-combat-controls-refactor-20260730";
import { drawOperator } from "./presentation/operator-renderer.js?v=092-combat-controls-refactor-20260730";
import { drawWorldEntity } from "./presentation/world-entity-renderer.js?v=092-combat-controls-refactor-20260730";
import { findEntity } from "./world-entities.js?v=092-combat-controls-refactor-20260730";

export class Renderer{
 constructor(canvas,camera){this.canvas=canvas;this.context=canvas.getContext("2d",{alpha:false});this.camera=camera;this.dpr=1;this.lastOperatorRenderError=null;}
 resize(){const rect=this.canvas.getBoundingClientRect();this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.round(rect.width*this.dpr));this.canvas.height=Math.max(1,Math.round(rect.height*this.dpr));this.context.setTransform(this.dpr,0,0,this.dpr,0,0);this.camera.resize(rect.width,rect.height);}
 render(game){
  this._currentGame=game;
  const ctx=this.context,w=this.canvas.clientWidth,h=this.canvas.clientHeight;
  ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation="source-over";
  ctx.setLineDash([]);
  ctx.clearRect(0,0,w,h);
  ctx.save();
  try{
    ctx.translate(-Math.round(this.camera.x),-Math.round(this.camera.y));this.#drawGround(ctx,game);this.#drawRoad(ctx,game.map.road);this.#drawTrail(ctx,game.map.trail);this.#drawBrush(ctx,game.map.brush);this.#drawExtraction(ctx,game.map.extraction);this.#drawSiteGround(ctx,game.map.site);this.#drawCulvert(ctx,game);this.#drawShed(ctx,game.map.shed);this.#drawOperationEvidence(ctx,game);this.#drawEncounterZones(ctx,game);this.#drawWildlife(ctx,game);this.#drawDepthSortedActors(ctx,game);this.#drawCombatWorld(ctx,game);this.#drawMapBorder(ctx);
  }finally{
    ctx.restore();
  }
  this.#drawPlayerVisionConeScreen(ctx,game);
  this.#drawCombatAimScreen(ctx,game);
  if(game.weather==="Rain"||game.weather==="Heavy Rain")this.#drawRain(ctx,w,h,game.weather==="Heavy Rain"?1.65:1);
  this.#drawEnvironmentOverlay(ctx,w,h,game);
 }
 #drawPlayerVisionConeScreen(ctx,game){
  const cone=game.perception?.getPlayerCone?.();if(!cone)return;
  const x=cone.x-this.camera.x,y=cone.y-this.camera.y;
  const angle=cone.lookAngle??0,half=cone.angle*Math.PI/360;
  ctx.save();
  try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   const gradient=ctx.createRadialGradient(x,y,18,x,y,cone.range);
   gradient.addColorStop(0,"rgba(255,255,245,.055)");
   gradient.addColorStop(.5,"rgba(255,255,245,.03)");
   gradient.addColorStop(1,"rgba(255,255,245,0)");
   ctx.fillStyle=gradient;
   ctx.beginPath();ctx.moveTo(x,y);
   ctx.arc(x,y,cone.range,angle-half,angle+half);
   ctx.closePath();ctx.fill();
  }finally{ctx.restore();}
 }


 #drawTrail(ctx,trail){ctx.save();ctx.strokeStyle="rgba(112,97,70,.42)";ctx.lineWidth=86;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);for(const p of trail.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.strokeStyle="rgba(188,169,126,.22)";ctx.lineWidth=58;ctx.stroke();ctx.restore();}
 #drawCulvert(ctx,game){const c=game.map.culvert,water=findEntity(game.entities,"culvert_water_01");ctx.save();ctx.fillStyle=game.weather==="Rain"?"rgba(67,102,108,.72)":"rgba(76,113,116,.62)";const grow=water?.depth==="rising"?38:0;ctx.beginPath();ctx.roundRect(c.water.x-grow,c.water.y-grow/2,c.water.width+grow*2,c.water.height+grow,45);ctx.fill();ctx.strokeStyle="rgba(210,225,213,.22)";ctx.lineWidth=3;for(let y=c.water.y+24;y<c.water.y+c.water.height;y+=35){ctx.beginPath();ctx.moveTo(c.water.x+25,y);ctx.quadraticCurveTo(c.water.x+180,y-10,c.water.x+320,y);ctx.quadraticCurveTo(c.water.x+460,y+10,c.water.x+c.water.width-25,y);ctx.stroke();}ctx.fillStyle="#66685d";ctx.fillRect(c.x,c.y,180,80);ctx.fillRect(c.x,c.y+c.height-80,180,80);ctx.fillStyle="#353d38";ctx.beginPath();ctx.arc(c.x+180,c.y+c.height/2,92,-Math.PI/2,Math.PI/2);ctx.lineTo(c.x+180,c.y+c.height/2-92);ctx.fill();ctx.fillStyle="rgba(35,43,38,.75)";ctx.font="700 22px system-ui";ctx.fillText("NORTH CULVERT",c.x-80,c.y-28);ctx.restore();}
 #drawRain(ctx,w,h,intensity=1){ctx.save();try{ctx.strokeStyle=`rgba(215,225,220,${.28+.08*Math.min(1,intensity-1)})`;ctx.lineWidth=1.4;const t=performance.now()*.22,count=Math.round(95*intensity);for(let i=0;i<count;i++){const x=(i*73+t)%w,y=(i*127+t*1.7)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+18);ctx.stroke();}}finally{ctx.restore();}}

 #drawEnvironmentOverlay(ctx,w,h,game){
  const light=game.getLightLevel?.()??1;
  ctx.save();
  try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   const hour=game.getHour?.()??12;
   if(hour>=18&&hour<20){ctx.fillStyle=`rgba(145,78,45,${(20-hour)*.07})`;ctx.fillRect(0,0,w,h);}
   if(game.weather==="Cloudy") {ctx.fillStyle="rgba(79,94,94,.10)";ctx.fillRect(0,0,w,h);}
   else if(game.weather==="Fog") {ctx.fillStyle="rgba(184,193,183,.12)";ctx.fillRect(0,0,w,h);}
   else if(game.weather==="Rain") {ctx.fillStyle="rgba(43,64,72,.16)";ctx.fillRect(0,0,w,h);}
   else if(game.weather==="Heavy Rain") {ctx.fillStyle="rgba(27,45,55,.27)";ctx.fillRect(0,0,w,h);}
   const darkness=Math.max(0,1-light);
   if(darkness>0.02){ctx.fillStyle=`rgba(9,20,32,${Math.min(.64,darkness*.62)})`;ctx.fillRect(0,0,w,h);}
  }finally{ctx.restore();}
 }
 #drawWildlife(ctx,game){ctx.save();for(const bird of game.wildlife){ctx.globalAlpha=game.weather==="Fog"?.22:.45;ctx.fillStyle="#d7d0a6";ctx.beginPath();ctx.ellipse(bird.x,bird.y,3.4,1.8,Math.sin(bird.phase)*.5,0,Math.PI*2);ctx.fill();}ctx.restore();}
 #drawDepthSortedActors(ctx,game){
  const targetedId=game.interaction.targetId;
  const entries=game.map.obstacles.map(o=>({
    y:o.y+o.radius*.5,
    id:`obstacle:${o.type}`,
    draw:()=>o.type==="tree"?this.#drawTree(ctx,o):this.#drawRock(ctx,o)
  }));

  for(const entity of game.entities){
    if(entity.revealed===false||entity.type==="hazard")continue;
    if(entity.type==="item"&&entity.locationType!=="world"&&entity.locationType!=="stored")continue;
    entries.push({
      y:entity.groundY,
      id:`entity:${entity.id}`,
      draw:()=>drawWorldEntity(ctx,entity,{targeted:entity.id===targetedId})
    });
  }

  for(const actor of game.actors){
    const renderActor=actor.seated?{...actor,y:actor.y+10,vx:0,vy:0}:actor;
    entries.push({
      y:actor.groundY-1,
      id:`actor:${actor.id}`,
      draw:()=>{
        if(actor.condition==="bleeding"){
          ctx.save();
          try{
            ctx.fillStyle="rgba(111,45,40,.52)";
            ctx.beginPath();
            ctx.ellipse(actor.x+8,actor.y+31,13,6,-.2,0,Math.PI*2);
            ctx.fill();
          }finally{
            ctx.restore();
          }
        }

        ctx.save();
        try{
          if(actor.condition==="bleeding"||actor.condition==="injured"){
            ctx.translate(actor.x,actor.y);
            ctx.rotate(-.08);
            ctx.translate(-actor.x,-actor.y);
          }
          this.#applyWorkPose(ctx,actor);
          drawOperator(ctx,renderActor,null);
          this.#drawWorkAccessory(ctx,actor);
          this.#drawEncounterIndicator(ctx,actor);
        }catch(error){
          console.error("Fieldwork actor render failed",{actorId:actor.id,kitId:actor.kitId,error});
          this.#drawActorFallback(ctx,actor);
        }finally{
          ctx.restore();
        }
      }
    });
  }

  game.operator.backpackLoadRatio=game.inventory.getUsedPips()/game.backpack.capacityPips;
  const carried=game.getHeldItem();
  entries.push({
    y:game.operator.y+game.operator.radius,
    id:`operator:${game.operator.id}`,
    draw:()=>this.#drawPlayer(ctx,game.operator,carried)
  });

  entries.sort((a,b)=>a.y-b.y);
  for(const entry of entries){
    try{
      entry.draw();
    }catch(error){
      console.error("Fieldwork draw entry failed",{entryId:entry.id,error});
    }
  }
 }

 #applyWorkPose(ctx,actor){
  const phase=actor.workPhase??0;
  ctx.translate(actor.x,actor.y);
  if(actor.workPose==="kneel"){ctx.translate(0,8);ctx.rotate(Math.sin(phase*1.8)*.018);}
  else if(actor.workPose==="inspect"){ctx.rotate(Math.sin(phase*2.2)*.035);ctx.translate(0,2);}
  else if(actor.workPose==="sort"){ctx.translate(0,Math.sin(phase*5)*1.8);}
  else if(actor.workPose==="brace"){ctx.translate(actor.facing==="left"?-4:4,3);ctx.rotate((actor.facing==="left"?-1:1)*.055);}
  else if(actor.workPose==="binoculars"){ctx.translate(0,-2);}
  else if(actor.workPose==="set_down"){ctx.translate(0,Math.min(7,actor.waitTime*2));}
  ctx.translate(-actor.x,-actor.y);
 }

 #drawWorkAccessory(ctx,actor){
  const prop=actor.workProp;if(!prop)return;
  const x=actor.x,y=actor.y,side=actor.facing==="left"?-1:1;
  ctx.save();
  try{
   if(prop==="tool_crate"||prop==="medical_crate"||prop==="salvage"){
    const carrying=actor.workPose==="carry";
    const px=carrying?x+side*25:x+side*34,py=carrying?y+4:y+28;
    ctx.fillStyle=prop==="medical_crate"?"#8b5b43":prop==="salvage"?"#454744":"#8b744d";
    ctx.strokeStyle="#29312c";ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(px-16,py-11,32,22,4);ctx.fill();ctx.stroke();
    if(prop==="medical_crate"){ctx.fillStyle="#d9c7a3";ctx.fillRect(px-2,py-7,4,14);ctx.fillRect(px-7,py-2,14,4);}
   }else if(prop==="toolbox"){
    ctx.fillStyle="#6f5a3e";ctx.strokeStyle="#28312b";ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x+side*31-15,y+23,30,15,4);ctx.fill();ctx.stroke();ctx.strokeRect(x+side*31-7,y+17,14,7);
   }else if(prop==="rope"){
    ctx.strokeStyle="#b19862";ctx.lineWidth=5;ctx.beginPath();ctx.arc(x+side*30,y+18,13,0,Math.PI*2);ctx.stroke();
   }else if(prop==="medical_bag"){
    ctx.fillStyle="#694a3d";ctx.beginPath();ctx.roundRect(x+side*28-13,y+19,26,19,5);ctx.fill();ctx.fillStyle="#d6c2a1";ctx.fillRect(x+side*28-2,y+22,4,12);ctx.fillRect(x+side*28-6,y+26,12,4);
   }else if(prop==="blanket"||prop==="supply_stack"){
    ctx.fillStyle=prop==="blanket"?"#83624c":"#77684e";ctx.beginPath();ctx.roundRect(x+side*30-17,y+22,34,14,4);ctx.fill();
   }else if(prop==="radio"){
    ctx.fillStyle="#303b35";ctx.strokeStyle="#e08f42";ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x+side*30-14,y+18,28,20,4);ctx.fill();ctx.stroke();ctx.fillStyle="#e08f42";ctx.fillRect(x+side*30-8,y+31,16,3);
   }else if(prop==="binoculars"){
    ctx.fillStyle="#262c29";ctx.beginPath();ctx.arc(x-6,y-25,7,0,Math.PI*2);ctx.arc(x+6,y-25,7,0,Math.PI*2);ctx.fill();ctx.fillRect(x-6,y-29,12,8);
   }
  }finally{ctx.restore();}
 }

 #drawOperationEvidence(ctx,game){
  const ops=game.operations;if(!ops?.started)return;
  const state=ops.worldState??{};
  ctx.save();
  try{
   if(state.northlineStaged){
    ctx.fillStyle="#d5a94f";for(const [x,y] of [[3470,875],[3525,875],[3580,875]]){ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#6f5a3e";ctx.beginPath();ctx.roundRect(3440,910,42,22,5);ctx.fill();
   }
   const debris=findEntity(game.entities,"culvert_debris_01");
   if(debris?.cleared){
    ctx.strokeStyle="#b59b64";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(3660,860);ctx.lineTo(3815,930);ctx.stroke();
    ctx.fillStyle="#5b4a33";ctx.beginPath();ctx.roundRect(3680,1040,130,20,8);ctx.fill();
   }
   if(state.communeDelivered){
    for(const [x,y,c] of [[2465,1240,"#8b5b43"],[2505,1243,"#65714f"],[2540,1237,"#6d4d42"]]){ctx.fillStyle=c;ctx.beginPath();ctx.roundRect(x,y,30,22,4);ctx.fill();}
   }
   if(state.freelancerRecovered){
    ctx.strokeStyle="rgba(40,47,43,.55)";ctx.lineWidth=3;ctx.setLineDash([5,7]);ctx.strokeRect(3955,735,65,44);ctx.setLineDash([]);
   }
  }finally{ctx.restore();}
 }


 #drawEncounterIndicator(ctx,actor){
  const perception=actor===undefined?null:null;
  const state=actor.encounterState;
  const knowledge=this._currentGame?.perception?.getKnowledgePresentation?.(actor);
  const relay=this._currentGame?.perception?.getRelayPresentation?.(actor.id);
  if((!state||state==="unaware"||state==="disengaging")&&!knowledge&&!relay)return;

  ctx.save();
  try{
   const level=knowledge?.level;
   const color=level==="identified"?"#d95745":level==="located"?"#e39a42":"#d8c55a";
   const y=actor.y-66;

   if(relay){
    ctx.fillStyle="#e0c763";
    const spacing=8;
    for(let i=0;i<relay.dots;i++){ctx.beginPath();ctx.arc(actor.x+(i-(relay.dots-1)/2)*spacing,y,3,0,Math.PI*2);ctx.fill();}
    return;
   }

   if(level==="suspected"&&knowledge?.certainty<35){
    ctx.font="800 18px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle="#e0c763";ctx.fillText("!",actor.x,y);
    return;
   }

   ctx.fillStyle=color;ctx.strokeStyle="#1d2822";ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(actor.x,y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
   if(state==="challenging"||state==="blocking"||state==="threatening"){
    ctx.strokeStyle=color;ctx.globalAlpha=.55;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(actor.x,y,9+Math.sin((actor.workPhase??0)*4)*1.5,0,Math.PI*2);ctx.stroke();
   }
  }finally{ctx.restore();}
 }

 #drawEncounterZones(ctx,game){
  const encounters=game.encounters?.encounters;if(!encounters)return;
  ctx.save();
  try{
   for(const encounter of encounters.values()){
    if(!["challenging","blocking","threatening"].includes(encounter.state))continue;
    const actors=[...encounter.participantIds].map(id=>game.actors.find(actor=>actor.id===id)).filter(Boolean);
    if(!actors.length)continue;
    const x=actors.reduce((s,a)=>s+a.x,0)/actors.length;
    const y=actors.reduce((s,a)=>s+a.y,0)/actors.length;
    ctx.strokeStyle=encounter.state==="threatening"?"rgba(197,70,58,.55)":"rgba(220,143,66,.38)";
    ctx.lineWidth=3;ctx.setLineDash([9,10]);ctx.beginPath();ctx.arc(x,y,92,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
   }
  }finally{ctx.restore();}
 }


 #drawActorFallback(ctx,actor){
  ctx.save();
  try{
    ctx.fillStyle="#d8b25a";
    ctx.strokeStyle="#18211c";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(actor.x,actor.y,18,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }finally{
    ctx.restore();
  }
 }

 #drawPlayer(ctx,operator,carried){
  try{
    const combat=this._currentGame?.combat;
    const renderOperator=combat&&!carried?{...operator,carriedItemInstanceId:"combat-weapon-hidden"}:operator;
    if(combat&&!carried&&combat.pointsBehindOperator)this.#drawCombatWeapon(ctx,operator,combat);
    drawOperator(ctx,renderOperator,carried);
    if(combat&&!carried&&!combat.pointsBehindOperator)this.#drawCombatWeapon(ctx,operator,combat);
    this.lastOperatorRenderError=null;
  }catch(error){
    this.lastOperatorRenderError=String(error?.message||error);
    console.error("Fieldwork operator render failed",{operatorId:operator.id,kitId:operator.kitId,error});
    ctx.save();
    try{
      ctx.fillStyle="#e9a13f";
      ctx.strokeStyle="#18211c";
      ctx.lineWidth=4;
      ctx.beginPath();
      ctx.arc(operator.x,operator.y,22,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle="#18211c";
      ctx.font="700 14px system-ui";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText("M",operator.x,operator.y);
    }finally{
      ctx.restore();
    }
  }
 }

 #drawCombatWeapon(ctx,operator,combat){
  const readiness=combat.aimReadiness??0;
  const angle=combat.weaponAngle??operator.lookAngle??0;
  const shoulderX=operator.x+Math.cos(angle+Math.PI/2)*2;
  const shoulderY=operator.y+Math.sin(angle+Math.PI/2)*2-1;
  const stockLength=15,receiverLength=24,barrelLength=34;
  const handReach=18+readiness*7;
  const mirror=combat.pointingLeft?-1:1;

  ctx.save();
  try{
   ctx.translate(shoulderX,shoulderY);
   ctx.rotate(angle);
   ctx.scale(1,mirror);
   ctx.translate(-4*(1-readiness),5*(1-readiness));

   ctx.fillStyle="#503f31";
   ctx.beginPath();ctx.roundRect(-10,-5,stockLength+10,10,4);ctx.fill();

   ctx.fillStyle="#252d2a";
   ctx.beginPath();ctx.roundRect(stockLength-4,-5,receiverLength,10,3);ctx.fill();
   ctx.beginPath();ctx.roundRect(stockLength+receiverLength-6,-2.5,barrelLength,5,2.5);ctx.fill();

   // Grip/magazine always hangs on the same physical underside after mirroring.
   ctx.beginPath();ctx.roundRect(stockLength+7,3,7,9,2);ctx.fill();

   ctx.fillStyle="#c3a58e";
   ctx.beginPath();ctx.roundRect(1,-4,10,8,4);ctx.fill();
   ctx.beginPath();ctx.roundRect(handReach,-4,10,8,4);ctx.fill();
  }finally{ctx.restore();}
 }

 #drawCombatWorld(ctx,game){
  const combat=game.combat;if(!combat)return;
  ctx.save();
  try{
   for(const decal of combat.decals){
    const alpha=Math.min(.55,decal.life/3*.55);
    ctx.globalAlpha=alpha;
    ctx.strokeStyle="#30362f";ctx.lineWidth=3;
    ctx.translate(decal.x,decal.y);ctx.rotate(decal.angle);
    ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(5,3);ctx.moveTo(-4,4);ctx.lineTo(4,-4);ctx.stroke();
    ctx.rotate(-decal.angle);ctx.translate(-decal.x,-decal.y);
   }
   ctx.globalAlpha=1;
   for(const effect of combat.effects){
    const t=effect.life/effect.maxLife;
    if(effect.type==="tracer"){
     ctx.strokeStyle=`rgba(255,213,89,${.25+.7*t})`;ctx.lineWidth=1.4+1.2*t;
     ctx.beginPath();ctx.moveTo(effect.x1,effect.y1);ctx.lineTo(effect.x2,effect.y2);ctx.stroke();
    }else if(effect.type==="muzzle"){
     ctx.save();ctx.translate(effect.x,effect.y);ctx.rotate(effect.angle);
     ctx.fillStyle=`rgba(255,224,88,${t})`;ctx.beginPath();
     for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?6:15*t;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
     ctx.closePath();ctx.fill();ctx.restore();
    }else if(effect.type==="hit"){
     ctx.save();ctx.translate(effect.x,effect.y);ctx.strokeStyle=`rgba(130,54,39,${t})`;ctx.lineWidth=3;
     for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(a)*2,Math.sin(a)*2);ctx.lineTo(Math.cos(a)*12*t,Math.sin(a)*12*t);ctx.stroke();}
     ctx.restore();
    }
   }
  }finally{ctx.restore();}
 }

 #drawCombatAimScreen(ctx,game){
  const combat=game.combat;if(!combat?.aiming)return;
  const x=game.operator.x-this.camera.x,y=game.operator.y-this.camera.y;
  const angle=combat.weaponAngle??0;
  const distance=combat.reticleDistance??300;
  const spread=combat.currentSpread??.04;
  const targetX=x+Math.cos(angle)*distance,targetY=y+Math.sin(angle)*distance;
  const bracketGap=16+Math.tan(spread)*distance;
  ctx.save();
  try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   if(combat.aimingLineVisible){
    const muzzle=combat.muzzle;
    ctx.strokeStyle="rgba(246,246,231,.46)";ctx.lineWidth=1.15;
    ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(muzzle.x-this.camera.x,muzzle.y-this.camera.y);ctx.lineTo(targetX,targetY);ctx.stroke();ctx.setLineDash([]);
   }
   if(!combat.reloading){
    ctx.translate(targetX,targetY);ctx.rotate(angle);
    ctx.strokeStyle="rgba(250,250,237,.82)";ctx.lineWidth=2.2;ctx.lineCap="round";
    const height=15;
    ctx.beginPath();
    ctx.moveTo(-bracketGap,-height);ctx.lineTo(-bracketGap-8,-height);ctx.lineTo(-bracketGap-8,height);ctx.lineTo(-bracketGap,height);
    ctx.moveTo(bracketGap,-height);ctx.lineTo(bracketGap+8,-height);ctx.lineTo(bracketGap+8,height);ctx.lineTo(bracketGap,height);
    ctx.stroke();
   }
  }finally{ctx.restore();}
 }

 #drawGround(ctx,game){ctx.fillStyle=game.weather==="Fog"?"#7d8878":game.weather==="Cloudy"?"#6f7b68":game.weather==="Rain"?"#59685a":"#758467";ctx.fillRect(0,0,MAP_WIDTH,MAP_HEIGHT);ctx.fillStyle="rgba(49,62,48,.09)";for(let y=30;y<MAP_HEIGHT;y+=70)for(let x=20+((y/70)%2)*24;x<MAP_WIDTH;x+=86){ctx.beginPath();ctx.ellipse(x,y,3,8,.3,0,Math.PI*2);ctx.fill();}}
 #drawRoad(ctx,road){const xs=road.map(p=>p.x),ys=road.map(p=>p.y);ctx.fillStyle="#8b8068";ctx.fillRect(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)-Math.min(...ys));ctx.strokeStyle="rgba(46,42,34,.22)";ctx.lineWidth=6;ctx.setLineDash([24,34]);ctx.beginPath();ctx.moveTo(0,800);ctx.lineTo(2600,800);ctx.stroke();ctx.setLineDash([]);}
 #drawBrush(ctx,brush){for(const p of brush){ctx.fillStyle="rgba(47,77,50,.38)";for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=p.radius*(.45+i%3*.16);ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r*.55,p.y+Math.sin(a)*r*.45,32+i%4*5,0,Math.PI*2);ctx.fill();}}}
 #drawExtraction(ctx,e){ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle="rgba(222,158,75,.13)";ctx.strokeStyle="rgba(235,176,96,.68)";ctx.lineWidth=5;ctx.setLineDash([14,12]);ctx.beginPath();ctx.arc(0,0,e.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="rgba(31,40,34,.9)";ctx.fillRect(-44,-18,88,36);ctx.fillStyle="#e4d5b8";ctx.font="700 16px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("RETURN",0,0);ctx.restore();}
 #drawSiteGround(ctx,site){ctx.fillStyle="rgba(119,105,77,.2)";ctx.beginPath();ctx.roundRect(660,340,1420,1000,80);ctx.fill();ctx.fillStyle="rgba(86,79,62,.18)";ctx.beginPath();ctx.roundRect(site.workArea.x-40,site.workArea.y-30,site.workArea.width+80,site.workArea.height+90,28);ctx.fill();ctx.fillStyle="rgba(38,46,39,.72)";ctx.font="700 18px system-ui";ctx.textAlign="left";ctx.fillText("OLD MAINTENANCE PULL-OFF",1140,350);}
 #drawShed(ctx,s){ctx.fillStyle="rgba(26,31,27,.24)";ctx.fillRect(s.x+16,s.y+18,s.width,s.height);ctx.fillStyle="#5e6255";ctx.fillRect(s.x,s.y,s.width,s.height);ctx.fillStyle="#373d35";const t=s.wallThickness;ctx.fillRect(s.x,s.y,s.width,t);ctx.fillRect(s.x,s.y,t,s.height);ctx.fillRect(s.x+s.width-t,s.y,t,s.height);ctx.fillRect(s.x,s.y+s.height-t,s.doorGap.start,t);ctx.fillRect(s.x+s.doorGap.start+s.doorGap.width,s.y+s.height-t,s.width-s.doorGap.start-s.doorGap.width,t);ctx.fillStyle="#817459";ctx.fillRect(s.x+52,s.y+62,s.width-104,s.height-118);}
 #drawTree(ctx,t){ctx.fillStyle="rgba(20,28,22,.24)";ctx.beginPath();ctx.ellipse(t.x+12,t.y+15,t.radius*.95,t.radius*.65,.2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#384b38";ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,Math.PI*2);ctx.fill();ctx.fillStyle="#52644b";ctx.beginPath();ctx.arc(t.x-t.radius*.2,t.y-t.radius*.22,t.radius*.7,0,Math.PI*2);ctx.fill();}
 #drawRock(ctx,r){ctx.fillStyle="rgba(24,29,25,.24)";ctx.beginPath();ctx.ellipse(r.x+8,r.y+10,r.radius,r.radius*.7,.1,0,Math.PI*2);ctx.fill();ctx.fillStyle="#686b61";ctx.beginPath();ctx.ellipse(r.x,r.y,r.radius,r.radius*.75,-.15,0,Math.PI*2);ctx.fill();}
 #drawMapBorder(ctx){ctx.strokeStyle="rgba(20,27,23,.5)";ctx.lineWidth=14;ctx.strokeRect(0,0,MAP_WIDTH,MAP_HEIGHT);}
}
