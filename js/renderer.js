import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js?v=11a-combat-sandbox-cover-pose-hotfix-20260731";
import { drawOperator } from "./presentation/operator-renderer.js?v=11a-combat-sandbox-cover-pose-hotfix-20260731";
import { drawWorldEntity } from "./presentation/world-entity-renderer.js?v=11a-combat-sandbox-cover-pose-hotfix-20260731";
import { findEntity } from "./world-entities.js?v=11a-combat-sandbox-cover-pose-hotfix-20260731";

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
    ctx.scale(this.camera.zoom,this.camera.zoom);
    ctx.translate(-this.camera.x,-this.camera.y);this.#drawGround(ctx,game);this.#drawRoad(ctx,game.map.road);this.#drawTrail(ctx,game.map.trail);this.#drawBrush(ctx,game.map.brush);this.#drawExtraction(ctx,game.map.extraction);this.#drawSiteGround(ctx,game.map.site);this.#drawCulvert(ctx,game);this.#drawShed(ctx,game.map.shed);this.#drawOperationEvidence(ctx,game);this.#drawEncounterZones(ctx,game);this.#drawWildlife(ctx,game);this.#drawDepthSortedActors(ctx,game);this.#drawCombatWorld(ctx,game);this.#drawMapBorder(ctx);
  }finally{
    ctx.restore();
  }
  this.#drawPlayerVisionConeScreen(ctx,game);
  this.#drawInteractionPromptScreen(ctx,game);
  this.#drawCombatAimScreen(ctx,game);
  this.#drawSuppressionScreen(ctx,game);
  this.#drawWoundScreen(ctx,game);
  if(game.weather==="Rain"||game.weather==="Heavy Rain")this.#drawRain(ctx,w,h,game.weather==="Heavy Rain"?1.65:1);
  this.#drawEnvironmentOverlay(ctx,w,h,game);
 }
 #drawPlayerVisionConeScreen(ctx,game){
  const cone=game.perception?.getPlayerCone?.();if(!cone)return;
  const screen=this.camera.worldToScreen(cone.x,cone.y);
  const x=screen.x,y=screen.y;
  const angle=cone.lookAngle??0,half=cone.angle*Math.PI/360;
  ctx.save();
  try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   const gradient=ctx.createRadialGradient(x,y,18*this.camera.zoom,x,y,cone.range*this.camera.zoom);
   gradient.addColorStop(0,"rgba(255,255,245,.055)");
   gradient.addColorStop(.5,"rgba(255,255,245,.03)");
   gradient.addColorStop(1,"rgba(255,255,245,0)");
   ctx.fillStyle=gradient;
   ctx.beginPath();ctx.moveTo(x,y);
   ctx.arc(x,y,cone.range*this.camera.zoom,angle-half,angle+half);
   ctx.closePath();ctx.fill();
  }finally{ctx.restore();}
 }


 #drawInteractionPromptScreen(ctx,game){
  const target=game.interaction?.getTarget?.(),action=game.interaction?.activeAction;if(!target||!action)return;
  const isActor=target.type==="actor";
  const worldX=target.x+(target.width??0)/2+(isActor?48:0);
  const worldY=target.y-(isActor?72:18);
  const screen=this.camera.worldToScreen(worldX,worldY);
  const x=Math.max(34,Math.min(this.canvas.clientWidth-34,screen.x));
  const y=Math.max(78,Math.min(this.canvas.clientHeight-90,screen.y));
  const compactLabels={
    assess_casualty:"Assess",
    treat_casualty:"Treat",
    give_water:"Water",
    assist:"Help",
    drag_casualty:"Drag",
    talk:"Talk"
  };
  const label=isActor?(compactLabels[action.id]??action.label):action.label;
  ctx.save();try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   ctx.font='750 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   const width=Math.max(44,ctx.measureText(label).width+18);
   ctx.fillStyle='rgba(18,27,22,.82)';ctx.beginPath();ctx.roundRect(x-width/2,y-11,width,22,10);ctx.fill();
   ctx.strokeStyle='rgba(229,154,71,.62)';ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle=action.disabled?'rgba(240,239,228,.55)':'#f0efe4';ctx.fillText(label,x,y);
  }finally{ctx.restore();}
 }

 #drawTrail(ctx,trail){ctx.save();ctx.strokeStyle="rgba(112,97,70,.42)";ctx.lineWidth=86;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);for(const p of trail.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.strokeStyle="rgba(188,169,126,.22)";ctx.lineWidth=58;ctx.stroke();ctx.restore();}
 #drawCulvert(ctx,game){const c=game.map.culvert,water=findEntity(game.entities,"culvert_water_01");ctx.save();ctx.fillStyle=game.weather==="Rain"?"rgba(67,102,108,.72)":"rgba(76,113,116,.62)";const grow=water?.depth==="rising"?38:0;ctx.beginPath();ctx.roundRect(c.water.x-grow,c.water.y-grow/2,c.water.width+grow*2,c.water.height+grow,45);ctx.fill();ctx.strokeStyle="rgba(210,225,213,.22)";ctx.lineWidth=3;for(let y=c.water.y+24;y<c.water.y+c.water.height;y+=35){ctx.beginPath();ctx.moveTo(c.water.x+25,y);ctx.quadraticCurveTo(c.water.x+180,y-10,c.water.x+320,y);ctx.quadraticCurveTo(c.water.x+460,y+10,c.water.x+c.water.width-25,y);ctx.stroke();}ctx.fillStyle="#66685d";ctx.fillRect(c.x,c.y,180,80);ctx.fillRect(c.x,c.y+c.height-80,180,80);ctx.fillStyle="#353d38";ctx.beginPath();ctx.arc(c.x+180,c.y+c.height/2,92,-Math.PI/2,Math.PI/2);ctx.lineTo(c.x+180,c.y+c.height/2-92);ctx.fill();ctx.fillStyle="rgba(35,43,38,.75)";ctx.font="700 22px system-ui";ctx.fillText("NORTH CULVERT",c.x-80,c.y-28);ctx.restore();}

 #drawSuppressionScreen(ctx,game){
  const suppression=game.combat?.suppression??0;
  if(suppression<=1)return;
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
  const strength=Math.min(1,suppression/100);
  ctx.save();
  try{
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    const gradient=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.22,w*.5,h*.5,Math.max(w,h)*.72);
    gradient.addColorStop(0,"rgba(14,18,17,0)");
    gradient.addColorStop(.62,`rgba(18,20,18,${strength*.08})`);
    gradient.addColorStop(1,`rgba(8,10,9,${strength*.48})`);
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    if(Number.isFinite(game.combat.suppressionDirection)){
      const angle=game.combat.suppressionDirection;
      const x=w*.5-Math.cos(angle)*Math.min(w,h)*.38;
      const y=h*.5-Math.sin(angle)*Math.min(w,h)*.38;
      ctx.strokeStyle=`rgba(226,92,64,${strength*.75})`;
      ctx.lineWidth=4;ctx.lineCap="round";
      ctx.beginPath();ctx.arc(x,y,20,-.7,.7);ctx.stroke();
    }
  }finally{ctx.restore();}
 }

 #drawWoundScreen(ctx,game){
  const medical=game.operator.medical;if(!medical||medical.condition==="healthy")return;
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
  const bloodLoss=Math.max(0,1-medical.blood/100);
  const shock=Math.min(1,medical.shock/100);
  ctx.save();try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   const gradient=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.28,w*.5,h*.5,Math.max(w,h)*.72);
   gradient.addColorStop(0,"rgba(91,20,20,0)");
   gradient.addColorStop(1,`rgba(90,18,20,${Math.min(.42,bloodLoss*.34+shock*.18)})`);
   ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
   if(medical.condition==="critical"||medical.unconscious){
    ctx.fillStyle=`rgba(230,225,205,${.05+Math.sin(performance.now()*.004)*.025})`;ctx.fillRect(0,0,w,h);
   }
  }finally{ctx.restore();}
 }

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
        if(actor.condition==="bleeding"||((actor.medical?.bleedingRate??0)>.05)){
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
          this.#drawAICombatIndicator(ctx,actor);
          this.#drawCasualtyState(ctx,actor);
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
  if(["dead","downed","dragged","crawl"].includes(actor.workPose)){
    // Dedicated pose families are drawn by operator-renderer. Never squash or
    // rotate the standing model to fake a casualty.
  }else if(actor.workPose==="medical"){ctx.translate(0,9);ctx.rotate(Math.sin(phase*3)*.012);}
  else if(actor.workPose==="kneel"){ctx.translate(0,8);ctx.rotate(Math.sin(phase*1.8)*.018);}
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

 #drawCasualtyState(ctx,actor){
  const medical=actor.medical;if(!medical||medical.condition==="healthy")return;
  ctx.save();
  try{
    const x=actor.x,y=actor.y-98;
    const state=medical.dead?"DEAD":medical.unconscious?"UNCONSCIOUS":medical.condition.toUpperCase();
    const color=medical.dead?"#747873":medical.unconscious?"#b9b6a9":medical.condition==="critical"?"#d94f42":medical.condition==="serious"?"#df8c3d":"#d5bc58";
    ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle="rgba(18,25,21,.88)";
    const width=Math.max(58,ctx.measureText(state).width+18);
    ctx.beginPath();ctx.roundRect(x-width/2,y-8,width,16,8);ctx.fill();
    ctx.fillStyle=color;ctx.fillText(state,x,y);
    if(medical.bleedingRate>.05&&!medical.dead){
      ctx.fillStyle="#b84138";
      ctx.beginPath();ctx.arc(actor.x+13,actor.y+22,3+Math.sin((actor.workPhase??0)*4)*.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(actor.x+13,actor.y+25);ctx.lineTo(actor.x+10,actor.y+32);ctx.lineTo(actor.x+16,actor.y+32);ctx.closePath();ctx.fill();
    }
    if(medical.unconscious&&!medical.dead){
      ctx.strokeStyle="rgba(220,225,211,.55)";ctx.lineWidth=2;
      const breath=8+Math.sin(performance.now()*.003)*2;
      ctx.beginPath();ctx.arc(actor.x,actor.y+18,breath,0,Math.PI);ctx.stroke();
    }
    if(actor.beingDragged){
      ctx.fillStyle="#e59a47";ctx.font="800 8px system-ui";ctx.fillText("DRAGGED",actor.x,actor.y+48);
    }
  }finally{ctx.restore();}
 }

 #drawAICombatIndicator(ctx,actor){
  if(!actor.operationId)return;
  const medical=actor.medical;
  if(medical&&medical.condition!=="healthy"){
    ctx.save();
    ctx.font="700 10px system-ui";ctx.textAlign="center";
    ctx.fillStyle=medical.condition==="critical"||medical.unconscious?"#ff8b72":"#d7a47d";
    ctx.fillText(`${medical.condition.toUpperCase()} · ${Math.round(medical.blood)}%`,actor.x,actor.y-96);
    ctx.restore();
  }
  ctx.save();
  try{
    const x=actor.x,y=actor.y-82;
    if(actor.medicalAction){
      const action=actor.medicalAction;
      ctx.fillStyle="rgba(18,27,22,.9)";
      ctx.beginPath();ctx.roundRect(x-27,y-5,54,10,5);ctx.fill();
      ctx.fillStyle="#8fc29b";
      ctx.beginPath();ctx.roundRect(x-25,y-3,50*Math.max(0,Math.min(1,action.progress??0)),6,3);ctx.fill();
      ctx.fillStyle="#dce7db";ctx.font="700 9px system-ui";ctx.textAlign="center";
      ctx.fillText("AID",x,y-10);
    }
    if(actor.reloading){
      ctx.fillStyle="rgba(18,27,22,.88)";
      ctx.beginPath();ctx.roundRect(x-24,y-5,48,10,5);ctx.fill();
      ctx.fillStyle="#e59a47";
      ctx.beginPath();ctx.roundRect(x-22,y-3,44*Math.max(0,Math.min(1,actor.reloadProgress??0)),6,3);ctx.fill();
    }
    if(actor.medicalAction&&actor.medicalInventory){
      const count=Object.values(actor.medicalInventory).reduce((sum,value)=>sum+value,0);
      ctx.fillStyle="#dce7db";ctx.font="600 8px system-ui";ctx.textAlign="center";
      ctx.fillText(`${count} MED`,x,y+18);
    }
    const state=actor.moraleState;
    if(state&&state!=="steady"){
      const color=state==="breaking"?"#d95745":state==="pinned"?"#e59a47":"#d8c55a";
      ctx.strokeStyle=color;
      ctx.globalAlpha=.65;
      ctx.lineWidth=2;
      const pulse=2*Math.sin((actor.workPhase??0)*6);
      ctx.beginPath();ctx.arc(actor.x,actor.y+18,23+pulse,0,Math.PI*2);ctx.stroke();
      if(state==="pinned"){
        ctx.fillStyle=color;ctx.globalAlpha=.8;
        ctx.fillRect(actor.x-12,actor.y+31,24,3);
      }
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
  const mirror=combat.pointingLeft?-1:1;
  const stockLength=15,receiverLength=24,barrelLength=34;
  // Keep both states near chest/shoulder height. Low ready tips the muzzle;
  // active aim lifts the stock and rear hand toward the eye line.
  const shoulderBack=3*(1-readiness);
  const shoulderLift=4*(1-readiness)-5*readiness;
  const shoulderX=operator.x-Math.cos(angle)*shoulderBack+Math.cos(angle+Math.PI/2)*2;
  const shoulderY=operator.y-Math.sin(angle)*shoulderBack+Math.sin(angle+Math.PI/2)*2+shoulderLift;
  const handReach=17+readiness*10;
  const localPitch=(1-readiness)*.055*mirror;

  ctx.save();
  try{
   ctx.translate(shoulderX,shoulderY);
   ctx.rotate(angle);
   ctx.scale(1,mirror);
   ctx.rotate(localPitch);
   ctx.translate(-3*(1-readiness),1.5*(1-readiness)-2*readiness);
   ctx.fillStyle="#503f31";
   ctx.beginPath();ctx.roundRect(-10,-5,stockLength+10,10,4);ctx.fill();
   ctx.fillStyle="#252d2a";
   ctx.beginPath();ctx.roundRect(stockLength-4,-5,receiverLength,10,3);ctx.fill();
   ctx.beginPath();ctx.roundRect(stockLength+receiverLength-6,-2.5,barrelLength,5,2.5);ctx.fill();
   ctx.beginPath();ctx.roundRect(stockLength+7,3,7,9,2);ctx.fill();
   ctx.fillStyle="#c3a58e";
   ctx.beginPath();ctx.roundRect(-1,-4,10,8,4);ctx.fill();
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
  const combat=game.combat;if(!combat?.weaponAvailable||!combat.aiming)return;
  const angle=combat.aimAngle??0;
  const trace=combat.aimTrace;
  const end=trace?.point??combat.reticle;
  const targetScreen=this.camera.worldToScreen(end.x,end.y);
  const targetX=targetScreen.x,targetY=targetScreen.y;
  const muzzle=combat.muzzle;
  const muzzleScreen=this.camera.worldToScreen(muzzle.x,muzzle.y);
  const startX=muzzleScreen.x,startY=muzzleScreen.y;
  const distance=Math.max(1,Math.hypot(end.x-muzzle.x,end.y-muzzle.y));
  const spread=combat.currentSpread??.04;
  const bracketGap=16+Math.tan(spread)*Math.min(distance,340);
  const targetKind=combat.getAimTargetKind(trace?.actor);
  const lineColor=targetKind==="hostile"
    ?"rgba(239,86,64,.88)"
    :targetKind==="contact"
      ?"rgba(245,190,64,.88)"
      :targetKind==="friendly"
        ?"rgba(160,199,204,.76)"
        :"rgba(246,246,231,.46)";

  ctx.save();
  try{
   ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
   if(combat.aimingLineVisible){
    ctx.strokeStyle=lineColor;ctx.lineWidth=1.35;
    ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(targetX,targetY);ctx.stroke();ctx.setLineDash([]);
   }
   if(!combat.reloading){
    ctx.translate(targetX,targetY);
    ctx.strokeStyle=targetKind==="clear"?"rgba(250,250,237,.88)":lineColor;
    ctx.fillStyle=lineColor;
    ctx.lineWidth=2.2;ctx.lineCap="round";ctx.lineJoin="round";
    const gap=Math.max(8,bracketGap*.54),halfHeight=12,hook=6;
    ctx.beginPath();
    ctx.moveTo(-gap-hook,-halfHeight);ctx.lineTo(-gap,-halfHeight);ctx.lineTo(-gap,halfHeight);ctx.lineTo(-gap-hook,halfHeight);
    ctx.moveTo(gap+hook,-halfHeight);ctx.lineTo(gap,-halfHeight);ctx.lineTo(gap,halfHeight);ctx.lineTo(gap+hook,halfHeight);
    ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,trace?.actor?4.8:3.2,0,Math.PI*2);ctx.fill();
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
