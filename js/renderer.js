import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";
import { drawOperator } from "./presentation/operator-renderer.js";
import { drawWorldEntity } from "./presentation/world-entity-renderer.js";
import { findEntity } from "./world-entities.js";

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
    ctx.translate(-this.camera.x,-this.camera.y);
    this.#drawGround(ctx,game);
    if(game.map.sandboxLayout){
      this.#drawBehaviorLabGround(ctx,game);
      this.#drawRoad(ctx,game.map.road);
      this.#drawBloodDecals(ctx,game);
      this.#drawBrush(ctx,game.map.brush);
      this.#drawLiveOperationAssets(ctx,game);
      this.#drawAIV2ObservationWorld(ctx,game);
    }else{
      this.#drawRoad(ctx,game.map.road);
      this.#drawTrail(ctx,game.map.trail);
      this.#drawBloodDecals(ctx,game);
      this.#drawBrush(ctx,game.map.brush);
      this.#drawExtraction(ctx,game.map.extraction);
      this.#drawSiteGround(ctx,game.map.site);
      this.#drawCulvert(ctx,game);
      this.#drawShed(ctx,game.map.shed);
      this.#drawOperationEvidence(ctx,game);
      if(game.debugEncounterZones)this.#drawEncounterZones(ctx,game);
      this.#drawWildlife(ctx,game);
    }
    this.#drawDepthSortedActors(ctx,game);
    this.#drawCombatWorld(ctx,game);
    this.#drawMapBorder(ctx);
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

 #drawBloodDecals(ctx,game){
  for(const decal of game.bloodDecals??[]){
    ctx.save();
    ctx.globalAlpha=decal.alpha??.25;
    ctx.fillStyle="#6f3030";
    ctx.beginPath();
    ctx.ellipse(decal.x,decal.y,decal.radius??7,(decal.radius??7)*.55,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
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
          this.#drawAIV2ActorIndicator(ctx,actor);
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
    const bagX=x+side*30,bagY=y+25;
    ctx.fillStyle="#694a3d";ctx.beginPath();ctx.roundRect(bagX-13,bagY-9,26,19,5);ctx.fill();
    ctx.fillStyle="#d6c2a1";ctx.fillRect(bagX-2,bagY-6,4,12);ctx.fillRect(bagX-6,bagY-2,12,4);
    const item=actor.workMedicalItem;
    if(item){
      const itemX=x+side*15,itemY=y+4;
      if(item==="tourniquet"){
        ctx.strokeStyle="#252b28";ctx.lineWidth=5;ctx.beginPath();ctx.arc(itemX,itemY,9,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle="#df9846";ctx.lineWidth=2;ctx.beginPath();ctx.arc(itemX,itemY,9,0,Math.PI*1.4);ctx.stroke();
      }else if(item==="painkillers"){
        ctx.fillStyle="#8b775e";ctx.beginPath();ctx.roundRect(itemX-7,itemY-5,14,10,4);ctx.fill();
        ctx.fillStyle="#d8c38f";ctx.fillRect(itemX-4,itemY-1,8,2);
      }else{
        ctx.fillStyle=item==="pressure_dressing"?"#d3c8ad":"#e1ddcf";
        ctx.beginPath();ctx.roundRect(itemX-10,itemY-5,20,10,4);ctx.fill();
        ctx.strokeStyle="#9c5f56";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(itemX-7,itemY);ctx.lineTo(itemX+7,itemY);ctx.stroke();
      }
    }
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



 #drawLiveOperationAssets(ctx,game){
  if(game.scenarioMode!=="live"||!game.livingSandbox)return;
  const summary=game.livingSandbox.summary?.();if(!summary)return;
  const activeStatuses=new Set(["proposed","deployed","returning","interrupted"]);
  const operations=summary.operations.filter(operation=>activeStatuses.has(operation.status)||(operation.cargoPackages??[]).some(item=>item.status==="dropped"));
  if(!operations.length)return;
  const factionAccent={northline:"#8fae83",commune:"#d6bb68",freelancers:"#df8c4e"};
  const resourceAccent={medical:"#c96f69",technical:"#83a98a",food:"#d3b260",fuel:"#b88b55"};
  ctx.save();
  try{
   for(const operation of operations){
    const accent=factionAccent[operation.factionId]??"#d7c379";
    if(operation.contestedByOperationId){
     const rival=summary.operations.find(item=>item.id===operation.contestedByOperationId);
     if(rival){
      ctx.strokeStyle="rgba(220,103,66,.38)";ctx.lineWidth=3;ctx.setLineDash([16,10]);
      ctx.beginPath();ctx.arc(operation.objectivePoint.x,operation.objectivePoint.y,430,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="rgba(20,26,22,.86)";ctx.beginPath();ctx.roundRect(operation.objectivePoint.x-78,operation.objectivePoint.y-486,156,22,10);ctx.fill();
      ctx.fillStyle="#df805a";ctx.font="850 7px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("CONTESTED ACTIVE WORKSITE",operation.objectivePoint.x,operation.objectivePoint.y-475);
     }
    }
    const survey=operation.surveyPoints??[];
    if(survey.length){
     ctx.strokeStyle=`${accent}66`;ctx.lineWidth=3;ctx.setLineDash([12,9]);ctx.beginPath();
     for(let index=0;index<survey.length;index+=1){const point=survey[index];if(index===0)ctx.moveTo(point.x,point.y);else ctx.lineTo(point.x,point.y);}ctx.stroke();ctx.setLineDash([]);
     for(const point of survey){
      const recorded=point.status==="recorded";
      ctx.fillStyle=recorded?accent:"rgba(18,27,22,.88)";ctx.strokeStyle=accent;ctx.lineWidth=2.2;
      ctx.beginPath();ctx.arc(point.x,point.y,recorded?10:15,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle="rgba(18,27,22,.86)";ctx.beginPath();ctx.roundRect(point.x-43,point.y+21,86,18,9);ctx.fill();
      ctx.fillStyle=accent;ctx.font="800 6.5px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(`${point.index+1}/${survey.length} ${recorded?"RECORDED":"SURVEY"}`,point.x,point.y+30);
     }
    }
    for(const item of operation.cargoPackages??[]){
     if(item.status==="returned")continue;
     const holder=item.holderActorId?game.actors.find(actor=>actor.id===item.holderActorId):null;
     const x=holder?holder.x+22:item.x,y=holder?holder.y-43:item.y;
     if(!Number.isFinite(x)||!Number.isFinite(y))continue;
     const itemAccent=resourceAccent[item.resourceType]??accent;
     if(item.status==="dropped"){
      ctx.strokeStyle="rgba(226,112,75,.72)";ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
     }
     ctx.fillStyle="rgba(18,24,21,.32)";ctx.beginPath();ctx.ellipse(x+4,y+12,19,7,0,0,Math.PI*2);ctx.fill();
     ctx.fillStyle=itemAccent;ctx.beginPath();ctx.roundRect(x-15,y-12,30,24,5);ctx.fill();
     ctx.strokeStyle="rgba(26,34,29,.78)";ctx.lineWidth=2;ctx.stroke();
     ctx.fillStyle="#202721";ctx.font="900 8px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(item.units??1),x,y);
     if(!holder){ctx.fillStyle="rgba(18,27,22,.86)";ctx.beginPath();ctx.roundRect(x-38,y+18,76,17,8);ctx.fill();ctx.fillStyle=itemAccent;ctx.font="800 6px system-ui";ctx.fillText(`${String(item.resourceType??"cargo").toUpperCase()} · ${String(item.status).toUpperCase()}`,x,y+26.5);}
    }
   }
  }finally{ctx.restore();}
 }

 #drawAIV2ObservationWorld(ctx,game){
  if(game.aiRuntimeMode!=="v2")return;
  const observers=game.actors.filter(actor=>actor.aiV2Debug?.activeActions?.includes("ObserveSector")&&actor.aiV2Observation?.sector);
  const readyActors=game.actors.filter(actor=>actor.aiV2Debug?.activeActions?.includes("HoldReady")&&actor.aiV2HoldReady?.focus);
  const repositioningActors=game.actors.filter(actor=>actor.aiV2Debug?.activeActions?.includes("RepositionForResponsibility")&&actor.aiV2Debug?.reposition?.destination);
  const withdrawingActors=game.actors.filter(actor=>actor.aiV2Debug?.activeActions?.includes("WithdrawToRoute")&&actor.aiV2Debug?.withdrawal?.destination);
  const recoveryActors=game.actors.filter(actor=>actor.aiV2Debug?.recovery&&actor.aiV2Debug?.activeActions?.some(type=>["ApproachCasualty","AssessCasualty","DragCasualty","StabilizeCasualty"].includes(type)));
  const evacuationActors=game.actors.filter(actor=>actor.aiV2Debug?.evacuation&&actor.aiV2Debug?.activeActions?.some(type=>["SelectEvacuationRoute","AdvanceRouteSecurity","EvacuateCasualty","ReassessEvacuationCasualty","TransferCasualty"].includes(type)));
  const evacuationRoutes=game.aiV2?.evacuationRoutes?.summary?.()??[];
  const reports=(game.aiV2?.teamKnowledge?.summary?.()??[]).map(teamEntry=>({
   ...teamEntry,
   reports:game.aiV2?.teamKnowledge?.getTeamContacts?.(teamEntry.teamId)??teamEntry.reports
  }));
  const encounters=game.aiV2?.teamEncounters?.summary?.()??[];
  const responses=game.aiV2?.teamResponses?.summary?.()??[];
  const procedures=game.aiV2?.teamProcedures?.summary?.()??[];
  const directedWarnings=game.aiV2?.heardCommunications?.summary?.()??{incoming:[],outgoing:[]};
  const outcomes=game.aiV2?.encounterOutcomes?.summary?.()??[];
  const casualtyReports=game.aiV2?.casualtyKnowledge?.summary?.()??[];
  const responseByTeam=new Map(responses.map(response=>[response.teamId,response]));
  const procedureByTeam=new Map(procedures.map(procedure=>[procedure.teamId,procedure]));
  if(!observers.length&&!readyActors.length&&!repositioningActors.length&&!withdrawingActors.length&&!recoveryActors.length&&!evacuationActors.length&&!evacuationRoutes.length&&!reports.length&&!casualtyReports.length&&!encounters.length&&!responses.length&&!procedures.length&&!directedWarnings.incoming.length&&!outcomes.length)return;
  const activeZone=game.map?.sandboxLayout?.zones?.find(zone=>zone.id===game.sandboxFixtureId);
  ctx.save();
  try{
   if(activeZone){ctx.beginPath();ctx.rect(activeZone.x,activeZone.y,activeZone.width,activeZone.height);ctx.clip();}

   for(const routeEntry of evacuationRoutes){
    const route=routeEntry.route;
    const mission=game.aiV2?.teamMissions?.get?.(routeEntry.teamId);
    const waypoints=route?.waypoints??[];
    const origin=mission?.recoveryPlan?.recoveryPoint;
    if(!origin||!waypoints.length)continue;
    const procedure=procedureByTeam.get(routeEntry.teamId);
    const activeLeg=Math.max(0,Number(procedure?.evacuation?.currentLegIndex??0));
    const points=[origin,...waypoints];
    ctx.strokeStyle="rgba(157,183,111,.34)";ctx.lineWidth=2.2;ctx.setLineDash([10,9]);
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const point of points.slice(1))ctx.lineTo(point.x,point.y);ctx.stroke();ctx.setLineDash([]);
    const legStart=points[Math.min(activeLeg,points.length-2)];
    const legEnd=points[Math.min(activeLeg+1,points.length-1)];
    if(legStart&&legEnd){
     ctx.strokeStyle="rgba(157,183,111,.92)";ctx.lineWidth=3.4;ctx.setLineDash([14,7]);
     ctx.beginPath();ctx.moveTo(legStart.x,legStart.y);ctx.lineTo(legEnd.x,legEnd.y);ctx.stroke();ctx.setLineDash([]);
    }
    for(let index=0;index<waypoints.length;index+=1){
     const waypoint=waypoints[index];
     const reached=index<activeLeg||procedure?.phase?.id==="safe_return";
     ctx.fillStyle=reached?"rgba(157,183,111,.88)":"rgba(18,27,22,.90)";
     ctx.strokeStyle="#9db76f";ctx.lineWidth=2;
     ctx.beginPath();ctx.arc(waypoint.x,waypoint.y,reached?10:13,0,Math.PI*2);ctx.fill();ctx.stroke();
     ctx.fillStyle="rgba(18,27,22,.90)";ctx.beginPath();ctx.roundRect(waypoint.x-55,waypoint.y+20,110,18,9);ctx.fill();
     ctx.fillStyle="#9db76f";ctx.font="800 6.5px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
     ctx.fillText(`${index+1}/${waypoints.length} ${String(waypoint.label??"EVACUATION WAYPOINT").toUpperCase()}`,waypoint.x,waypoint.y+29);
    }
    const labelPoint=waypoints[0];
    ctx.fillStyle="rgba(18,27,22,.90)";ctx.beginPath();ctx.roundRect(labelPoint.x-65,labelPoint.y-46,130,18,9);ctx.fill();
    ctx.fillStyle="#9db76f";ctx.font="850 7px system-ui";ctx.fillText(String(route.label??"SELECTED ROUTE").toUpperCase(),labelPoint.x,labelPoint.y-37);
   }

   for(const speaker of game.actors){
    const communication=speaker.aiV2Debug?.communication;
    if(!["transmitting","transmitting_update","issuing_warning","reporting_casualty"].includes(communication?.status))continue;
    const warningLine=communication.status==="issuing_warning";
    ctx.strokeStyle=warningLine?"rgba(232,154,71,.74)":"rgba(235,205,128,.38)";ctx.lineWidth=warningLine?3:2;ctx.setLineDash(warningLine?[12,7]:[5,9]);
    for(const recipientId of communication.recipientIds??[]){
     const recipient=game.actors.find(actor=>actor.id===recipientId);if(!recipient)continue;
     ctx.beginPath();ctx.moveTo(speaker.x,speaker.y-18);ctx.lineTo(recipient.x,recipient.y-18);ctx.stroke();
    }
    if(warningLine&&communication.targetPoint){
     ctx.beginPath();ctx.moveTo(speaker.x,speaker.y-18);ctx.lineTo(communication.targetPoint.x,communication.targetPoint.y);ctx.stroke();
     ctx.beginPath();ctx.arc(communication.targetPoint.x,communication.targetPoint.y,28,0,Math.PI*2);ctx.stroke();
    }
    ctx.setLineDash([]);
   }

   for(const actor of observers){
    const sector=actor.aiV2Observation.sector;
    const roleId=actor.aiV2Debug?.procedureRole?.roleId??"authored_observer";
    const isPrimary=roleId==="primary_observer"||roleId==="concealed_observer"||roleId==="authored_observer";
    const angle=Number.isFinite(actor.lookAngle)?actor.lookAngle:Math.atan2(sector.y-actor.y,sector.x-actor.x);
    const half=(sector.fieldOfViewDegrees??72)*Math.PI/360;
    const radius=Math.min(isPrimary?1080:820,sector.maximumRange??1180);
    const contact=actor.aiV2Debug?.personalKnowledge;
    const active=Boolean(contact?.currentlyVisible);
    const base=actor.factionId==="commune"?"157,183,111":"221,174,88";
    ctx.fillStyle=active?`rgba(${base},.055)`:isPrimary?`rgba(${base},.030)`:`rgba(${base},.020)`;
    ctx.strokeStyle=active?`rgba(${base},.34)`:isPrimary?`rgba(${base},.20)`:`rgba(${base},.14)`;
    ctx.lineWidth=isPrimary?2:1.5;
    ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.arc(actor.x,actor.y,radius,angle-half,angle+half);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=isPrimary?"rgba(237,226,180,.30)":"rgba(220,226,205,.20)";ctx.lineWidth=isPrimary?2:1.5;ctx.setLineDash([11,13]);
    ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(sector.x,sector.y);ctx.stroke();ctx.setLineDash([]);
    if(contact?.approximatePosition){
     const position=contact.approximatePosition;
     ctx.strokeStyle=contact.currentlyVisible?"rgba(231,156,70,.86)":"rgba(218,195,110,.55)";
     ctx.lineWidth=3;ctx.setLineDash(contact.currentlyVisible?[]:[8,8]);
     ctx.beginPath();ctx.arc(position.x,position.y,18,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
     ctx.fillStyle="rgba(24,31,27,.78)";ctx.beginPath();ctx.roundRect(position.x-31,position.y-43,62,18,9);ctx.fill();
     ctx.fillStyle=contact.currentlyVisible?"#e59a47":"#d8c56a";ctx.font="800 8px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
     ctx.fillText("PERSONAL",position.x,position.y-34);
    }
   }

   for(const actor of readyActors){
    const focus=actor.aiV2HoldReady.focus;
    const angle=Math.atan2(focus.y-actor.y,focus.x-actor.x);
    const endX=actor.x+Math.cos(angle)*115,endY=actor.y+Math.sin(angle)*115;
    const accent=actor.factionId==="commune"?"rgba(157,183,111,.42)":"rgba(221,174,88,.42)";
    ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.setLineDash([5,8]);
    ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(endX,endY);ctx.stroke();ctx.setLineDash([]);
   }

   for(const actor of repositioningActors){
    const move=actor.aiV2Debug.reposition;
    const destination=move.destination;
    const accent=actor.factionId==="commune"?"rgba(157,183,111,.88)":"rgba(221,174,88,.88)";
    ctx.strokeStyle=accent;ctx.lineWidth=2.4;ctx.setLineDash([8,8]);
    ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(destination.x,destination.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(destination.x,destination.y,17,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(destination.x-7,destination.y);ctx.lineTo(destination.x+7,destination.y);ctx.moveTo(destination.x,destination.y-7);ctx.lineTo(destination.x,destination.y+7);ctx.stroke();
   }

   for(const actor of withdrawingActors){
    const move=actor.aiV2Debug.withdrawal;
    const destination=move.destination;
    const accent="rgba(157,183,111,.94)";
    ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.setLineDash([13,8]);
    ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(destination.x,destination.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(destination.x,destination.y,20,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="rgba(18,27,22,.84)";ctx.beginPath();ctx.roundRect(destination.x-43,destination.y+27,86,18,9);ctx.fill();
    ctx.fillStyle="#9db76f";ctx.font="800 7px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("WITHDRAWAL ROUTE",destination.x,destination.y+36);
   }


   for(const actor of recoveryActors){
    const recovery=actor.aiV2Debug.recovery;
    const destination=recovery?.destination;
    if(destination){
     ctx.strokeStyle="rgba(157,183,111,.92)";ctx.lineWidth=recovery.actionType==="DragCasualty"?3.2:2.4;ctx.setLineDash(recovery.actionType==="DragCasualty"?[12,7]:[7,8]);
     ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(destination.x,destination.y);ctx.stroke();ctx.setLineDash([]);
     ctx.beginPath();ctx.arc(destination.x,destination.y,recovery.actionType==="DragCasualty"?23:17,0,Math.PI*2);ctx.stroke();
    }
    const casualty=game.actors.find(candidate=>candidate.id===recovery?.casualtyId);
    if(casualty&&recovery.actionType==="DragCasualty"){
     ctx.strokeStyle="rgba(238,226,196,.42)";ctx.lineWidth=2;ctx.setLineDash([4,6]);
     ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(casualty.x,casualty.y);ctx.stroke();ctx.setLineDash([]);
    }
   }

   for(const actor of evacuationActors){
    const evacuation=actor.aiV2Debug.evacuation;
    const destination=evacuation?.destination;
    if(destination){
     const transporting=evacuation.actionType==="EvacuateCasualty";
     ctx.strokeStyle=transporting?"rgba(157,183,111,.98)":"rgba(157,183,111,.78)";
     ctx.lineWidth=transporting?3.6:2.5;ctx.setLineDash(transporting?[14,6]:[7,8]);
     ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(destination.x,destination.y);ctx.stroke();ctx.setLineDash([]);
     ctx.beginPath();ctx.arc(destination.x,destination.y,transporting?24:18,0,Math.PI*2);ctx.stroke();
    }
    const casualty=game.actors.find(candidate=>candidate.id===evacuation?.casualtyId);
    if(casualty&&["EvacuateCasualty","ReassessEvacuationCasualty","TransferCasualty"].includes(evacuation.actionType)){
     ctx.strokeStyle="rgba(238,226,196,.48)";ctx.lineWidth=2.2;ctx.setLineDash([4,6]);
     ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(casualty.x,casualty.y);ctx.stroke();ctx.setLineDash([]);
    }
   }

   for(const teamEntry of casualtyReports)for(const report of teamEntry.casualties??[]){
    const position=report.approximatePosition;if(!position)continue;
    const stabilized=Number(report.assessment?.bleeding??99)<=.05&&Boolean(report.assessment);
    const accent=stabilized?"#9db76f":"#e89a47";
    ctx.strokeStyle=accent;ctx.lineWidth=2.5;ctx.setLineDash([5,6]);
    ctx.beginPath();ctx.arc(position.x,position.y,31,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="rgba(18,27,22,.89)";ctx.beginPath();ctx.roundRect(position.x-52,position.y+39,104,20,10);ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=1.2;ctx.stroke();
    ctx.fillStyle=accent;ctx.font="850 7px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(stabilized?"CASUALTY STABILIZED":"FRIENDLY CASUALTY",position.x,position.y+49);
   }

   for(const teamEntry of reports)for(const report of teamEntry.reports){
    const position=report.approximatePosition;if(!position)continue;
    if(report.reportKind==="activity_update"&&report.previousApproximatePosition){
     ctx.strokeStyle="rgba(236,220,157,.48)";ctx.lineWidth=2;ctx.setLineDash([6,8]);
     ctx.beginPath();ctx.moveTo(report.previousApproximatePosition.x,report.previousApproximatePosition.y);ctx.lineTo(position.x,position.y);ctx.stroke();ctx.setLineDash([]);
     const angle=Math.atan2(position.y-report.previousApproximatePosition.y,position.x-report.previousApproximatePosition.x);
     ctx.beginPath();ctx.moveTo(position.x,position.y);ctx.lineTo(position.x-Math.cos(angle-.5)*12,position.y-Math.sin(angle-.5)*12);ctx.moveTo(position.x,position.y);ctx.lineTo(position.x-Math.cos(angle+.5)*12,position.y-Math.sin(angle+.5)*12);ctx.stroke();
    }
    const source=game.actors.find(actor=>actor.id===report.sourceActorId);
    const color=source?.factionId==="commune"?"rgba(157,183,111,.82)":"rgba(221,174,88,.82)";
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash([7,7]);
    ctx.beginPath();ctx.rect(position.x-27,position.y-27,54,54);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="rgba(24,31,27,.80)";ctx.beginPath();ctx.roundRect(position.x-38,position.y+34,76,18,9);ctx.fill();
    ctx.fillStyle=color;ctx.font="800 8px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(report.reportKind==="activity_update"?"TEAM UPDATE":"TEAM REPORT",position.x,position.y+43);
    if(report.reportKind==="activity_update"&&report.activity){
     ctx.fillStyle="rgba(229,226,196,.72)";ctx.font="750 6.5px system-ui";
     ctx.fillText(String(report.activityLabel??report.activity).toUpperCase(),position.x,position.y+55);
    }
   }

   for(const entry of directedWarnings.incoming){
    const warning=entry.warning;if(!warning?.targetPoint)continue;
    const p=warning.targetPoint;
    ctx.fillStyle="rgba(18,27,22,.90)";ctx.beginPath();ctx.roundRect(p.x-58,p.y-62,116,20,10);ctx.fill();
    ctx.strokeStyle="#e89a47";ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="#e89a47";ctx.font="850 7px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("WARNING HEARD",p.x,p.y-52);
    ctx.fillStyle="rgba(238,226,196,.72)";ctx.font="650 6px system-ui";
    ctx.fillText("STOP AND IDENTIFY",p.x,p.y-38);
   }

   for(const teamEntry of outcomes){
    const outcome=teamEntry.outcomes?.[0];
    if(!outcome)continue;
    const mission=game.aiV2?.teamMissions?.get?.(teamEntry.teamId);
    let point=null,title="ENCOUNTER ENDED",detail="WITHDREW WITHOUT VIOLENCE";
    if(outcome.kind==="casualty_stabilized"){
     point=mission?.recoveryPlan?.recoveryPoint;
     title="STABILIZED · CRITICAL";
     detail=outcome.followUp==="evacuation_required"?"EVACUATION REQUIRED":"IMMEDIATE BLEEDING CONTROLLED";
    }else if(outcome.kind==="casualty_evacuated_alive"){
     const selectedRoute=evacuationRoutes.find(entry=>entry.teamId===teamEntry.teamId)?.route;
     point=selectedRoute?.waypoints?.at?.(-1)??mission?.evacuationPlan?.routeOptions?.[0]?.waypoints?.at?.(-1)??null;
     title="SAFE RETURN";
     detail="EVACUATED ALIVE · CONTINUED CARE";
    }else point=mission?.withdrawalPlan?.exitPoint;
    if(!point)continue;
    ctx.fillStyle="rgba(18,27,22,.91)";ctx.beginPath();ctx.roundRect(point.x-70,point.y-68,140,34,11);ctx.fill();
    ctx.strokeStyle="#9db76f";ctx.lineWidth=1.6;ctx.stroke();
    ctx.fillStyle="#9db76f";ctx.font="850 8px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(title,point.x,point.y-57);
    ctx.fillStyle="rgba(238,226,196,.72)";ctx.font="700 6.5px system-ui";
    ctx.fillText(detail,point.x,point.y-44);
   }

   for(const teamEntry of encounters)for(const encounter of teamEntry.hypotheses){
    const position=encounter.approximatePosition;if(!position)continue;
    const source=game.actors.find(actor=>actor.teamId===teamEntry.teamId);
    const baseColor=source?.factionId==="commune"?"#9db76f":"#ddae58";
    const state=encounter.state??"possible";
    const label=encounter.subjectKind==="friendly_casualty"?(state==="stale"?"CASUALTY RESOLVED":"FRIENDLY CASUALTY"):state==="potentially_incompatible"?"POSSIBLE CONFLICT":state==="relevant"?"MISSION RELEVANT":state==="stale"?"STALE ENCOUNTER":"POSSIBLE ENCOUNTER";
    const accent=state==="stale"?"rgba(213,205,157,.58)":baseColor;
    ctx.fillStyle="rgba(18,27,22,.87)";ctx.beginPath();ctx.roundRect(position.x-50,position.y+58,100,18,9);ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=1.25;ctx.stroke();
    ctx.fillStyle=accent;ctx.font="800 7px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(label,position.x,position.y+67);
    const response=responseByTeam.get(teamEntry.teamId)??null;
    let responseY=82;
    if(encounter.activity){
     ctx.fillStyle="rgba(229,226,196,.68)";ctx.font="750 6px system-ui";
     ctx.fillText(`ACTIVITY ${String(encounter.activityLabel??encounter.activity).toUpperCase()}`,position.x,position.y+82);
     ctx.fillText(`INTENT ${String(encounter.intentHypothesis?.label??encounter.intent??"UNKNOWN").toUpperCase()}`,position.x,position.y+92);
     responseY=104;
    }
    ctx.fillStyle=response?accent:"rgba(224,226,205,.60)";ctx.font="800 6.5px system-ui";
    ctx.fillText(response?response.selected.label.toUpperCase():"NO RESPONSE SELECTED",position.x,position.y+responseY);
    if(response){
     const procedure=procedureByTeam.get(teamEntry.teamId)??null;
     ctx.fillStyle="rgba(224,226,205,.55)";ctx.font="700 6px system-ui";
     if(procedure){
      ctx.fillText(`PROCEDURE ${procedure.label.toUpperCase()}`,position.x,position.y+responseY+12);
      ctx.fillText(`PHASE ${procedure.phase.label.toUpperCase()}`,position.x,position.y+responseY+22);
     }else ctx.fillText(`DECISION ${Math.round(response.selected.score*100)} · NO PROCEDURE`,position.x,position.y+responseY+12);
    }
   }
  }finally{ctx.restore();}
 }

 #drawAIV2ActorIndicator(ctx,actor){
  if(this._currentGame?.aiRuntimeMode!=="v2")return;
  const debug=actor.aiV2Debug;
  const observing=debug?.activeActions?.includes("ObserveSector");
  const holding=debug?.activeActions?.includes("HoldReady");
  const repositioning=debug?.activeActions?.includes("RepositionForResponsibility");
  const withdrawing=debug?.activeActions?.includes("WithdrawToRoute");
  const reportingCasualty=debug?.activeActions?.includes("ReportCasualty")&&debug?.communication?.status==="reporting_casualty";
  const approachingCasualty=debug?.activeActions?.includes("ApproachCasualty");
  const assessingCasualty=debug?.activeActions?.includes("AssessCasualty");
  const draggingCasualty=debug?.activeActions?.includes("DragCasualty");
  const stabilizingCasualty=debug?.activeActions?.includes("StabilizeCasualty");
  const selectingEvacuationRoute=debug?.activeActions?.includes("SelectEvacuationRoute");
  const securingEvacuationRoute=debug?.activeActions?.includes("AdvanceRouteSecurity");
  const evacuatingCasualty=debug?.activeActions?.includes("EvacuateCasualty");
  const reassessingEvacuation=debug?.activeActions?.includes("ReassessEvacuationCasualty");
  const transferringCasualty=debug?.activeActions?.includes("TransferCasualty");
  const safeReturnFresh=debug?.evacuation?.status==="safe_return"&&((this._currentGame?.aiV2?.elapsed??0)-(actor.aiV2Evacuation?.completedAt??0)<=5.5);
  const recoveryFresh=debug?.recovery?.status==="stabilized"&&((this._currentGame?.aiV2?.elapsed??0)-(actor.aiV2Recovery?.completedAt??0)<=5.5);
  const contact=debug?.personalKnowledge;
  const received=debug?.receivedKnowledge;
  const reportingUpdate=debug?.activeActions?.includes("ReportContactUpdate")&&debug?.communication?.status==="transmitting_update";
  const reporting=debug?.activeActions?.includes("ReportContact")&&debug?.communication?.status==="transmitting";
  const issuingWarning=debug?.activeActions?.includes("IssueWarning")&&debug?.communication?.status==="issuing_warning";
  const heardWarning=debug?.heardWarning;
  const warningFresh=heardWarning&&((this._currentGame?.aiV2?.elapsed??0)-(heardWarning.heardAt??0)<=5.5);
  const procedureRole=debug?.procedureRole;
  const showAction=Boolean(observing||holding||repositioning||withdrawing||reporting||reportingUpdate||reportingCasualty||approachingCasualty||assessingCasualty||draggingCasualty||stabilizingCasualty||selectingEvacuationRoute||securingEvacuationRoute||evacuatingCasualty||reassessingEvacuation||transferringCasualty||safeReturnFresh||recoveryFresh||issuingWarning||warningFresh||received);
  if(!showAction&&!procedureRole)return;
  const x=actor.x,y=actor.y-108;
  let title="UNASSIGNED",status="NO ACTION",footer="",accent="rgba(235,234,213,.58)";
  if(reportingCasualty){
   title="REPORT CASUALTY";status=`VOICE ${debug.communication.recipientIds?.length??0} · ${Math.round((debug.communication.progress??0)*100)}%`;footer="TEAM RECOVERY";accent="#e89a47";
  }else if(approachingCasualty){
   title="APPROACH";status=`MOVING ${Math.round((debug.recovery?.progress??0)*100)}%`;footer="REACH CASUALTY";accent="#9db76f";
  }else if(assessingCasualty){
   title="ASSESS";status=`CHECKING ${Math.round((debug.recovery?.progress??0)*100)}%`;footer="CONDITION & MOBILITY";accent="#9db76f";
  }else if(draggingCasualty){
   title="DRAG";status=`MOVING ${Math.round((debug.recovery?.progress??0)*100)}%`;footer="TO RECOVERY POINT";accent="#9db76f";
  }else if(stabilizingCasualty){
   title="STABILIZE";status=`TREATING ${Math.round((debug.recovery?.progress??0)*100)}%`;footer=String(debug.recovery?.treatmentType??"PRESSURE DRESSING").replaceAll("_"," ").toUpperCase();accent="#9db76f";
  }else if(selectingEvacuationRoute){
   title="ASSESS ROUTES";status=`COMPARING ${Math.round((debug.evacuation?.progress??0)*100)}%`;footer="WORLD AFFORDANCES";accent="#9db76f";
  }else if(securingEvacuationRoute){
   title="SECURE ROUTE";status=`LEG ${(debug.evacuation?.legIndex??0)+1} · ${Math.round((debug.evacuation?.progress??0)*100)}%`;footer=(debug.evacuation?.waypointLabel??"FORWARD WAYPOINT").toUpperCase();accent="#9db76f";
  }else if(evacuatingCasualty){
   title="EVACUATE";status=`LEG ${(debug.evacuation?.legIndex??0)+1} · ${Math.round((debug.evacuation?.progress??0)*100)}%`;footer=(debug.evacuation?.routeLabel??"SELECTED ROUTE").toUpperCase();accent="#9db76f";
  }else if(reassessingEvacuation){
   title="REASSESS";status=`CASUALTY ${Math.round((debug.evacuation?.progress??0)*100)}%`;footer="STABILITY CHECKPOINT";accent="#9db76f";
  }else if(transferringCasualty){
   title="TRANSFER";status=`HANDOFF ${Math.round((debug.evacuation?.progress??0)*100)}%`;footer="CONTINUED CARE";accent="#9db76f";
  }else if(safeReturnFresh){
   title="SAFE RETURN";status="CASUALTY EVACUATED";footer="CONTINUED CARE REQUIRED";accent="#9db76f";
  }else if(recoveryFresh){
   title="STABILIZED";status="BLEEDING CONTROLLED";footer="EVACUATION REQUIRED";accent="#9db76f";
  }else if(issuingWarning){
   title="ISSUE WARNING";status=`VOICE ${debug.communication.recipientIds?.length??0} · ${Math.round((debug.communication.progress??0)*100)}%`;footer="STOP AND IDENTIFY";accent="#e89a47";
  }else if(warningFresh){
   title="WARNING HEARD";status="STOP AND IDENTIFY";footer="NO REPLY SELECTED";accent="#e89a47";
  }else if(reportingUpdate){
   title="UPDATE";status=`${String(debug.communication.activity??"ACTIVITY").replaceAll("_"," ").toUpperCase()} · ${Math.round((debug.communication.progress??0)*100)}%`;footer="REPORTING CHANGE";accent="#e6c46f";
  }else if(reporting){
   title="REPORT";status=`VOICE ${debug.communication.recipientIds?.length??0} · ${Math.round((debug.communication.progress??0)*100)}%`;footer="SHARING";accent="#e6c46f";
  }else if(withdrawing){
   title="WITHDRAW";status=`MOVING ${Math.round((debug.withdrawal?.progress??0)*100)}%`;footer=(debug.withdrawal?.roleLabel??"STAGED WITHDRAWAL").toUpperCase();accent="#9db76f";
  }else if(repositioning){
   title="REPOSITION";status=`MOVING ${Math.round((debug.reposition?.progress??0)*100)}%`;footer=(debug.reposition?.roleLabel??"POSITION REQUIREMENT").toUpperCase();accent=actor.factionId==="commune"?"#9db76f":"#ddae58";
  }else if(holding){
   title="HOLD READY";status=(debug.attentionSector??"READY SECTOR").toUpperCase();footer=procedureRole?.label?.toUpperCase()??"AVAILABLE";accent=actor.factionId==="commune"?"#9db76f":"#ddae58";
  }else if(observing){
   title="OBSERVE";status=contact?`${contact.currentlyVisible?"VISIBLE":"MEMORY"} ${Math.round(contact.confidence)}%`:"SCANNING";
   const activity=contact?.activityRevision>0?(contact.activityLabel??contact.activity):null;
   footer=(activity??debug.attentionSector??procedureRole?.label??"WATCHING").toUpperCase();accent=contact?.currentlyVisible?"#e8a051":actor.factionId==="commune"?"#9db76f":"#ddae58";
  }else if(received){
   title=received.reportKind==="activity_update"?"UPDATED":"RECEIVED";status=received.reportKind==="activity_update"?`${String(received.activityLabel??received.activity??"ACTIVITY").toUpperCase()} ${Math.round(received.confidence)}%`:`REPORT ${Math.round(received.confidence)}%`;footer=`FROM ${(received.sourceName??"TEAM").split(" ")[0].toUpperCase()}`;accent="#9db76f";
  }
  ctx.save();
  try{
   ctx.textAlign="center";ctx.textBaseline="middle";
   if(showAction){
    ctx.font="800 9px system-ui";
    const panelWidth=Math.max(84,Math.min(132,ctx.measureText(title).width+30));
    ctx.fillStyle="rgba(18,27,22,.88)";ctx.beginPath();ctx.roundRect(x-panelWidth/2,y-10,panelWidth,20,10);ctx.fill();
    ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="#f0e5c8";ctx.fillText(title,x,y);
    ctx.fillStyle=accent;ctx.font="750 7.5px system-ui";ctx.fillText(status,x,y+16);
    ctx.fillStyle="rgba(220,226,205,.62)";ctx.font="650 6.5px system-ui";ctx.fillText(footer,x,y+27);
   }
   if(procedureRole){
    const roleAccent=actor.factionId==="commune"?"#9db76f":"#ddae58";
    const label=procedureRole.label.toUpperCase();ctx.font="800 7px system-ui";
    const width=Math.max(58,Math.min(112,ctx.measureText(label).width+18));const roleY=actor.y+58;
    ctx.fillStyle="rgba(18,27,22,.88)";ctx.beginPath();ctx.roundRect(actor.x-width/2,roleY-8,width,16,8);ctx.fill();
    ctx.strokeStyle=roleAccent;ctx.lineWidth=1.1;ctx.stroke();ctx.fillStyle=roleAccent;ctx.fillText(label,actor.x,roleY);
   }
  }finally{ctx.restore();}
 }

 #drawEncounterIndicator(ctx,actor){
  if(actor.medical?.dead||actor.medical?.unconscious||actor.medical?.condition==="critical")return;
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
  const medical=actor.medical;if(!medical||medical.condition==="healthy"||medical.dead)return;
  ctx.save();
  try{
    if(!medical.unconscious){
      const x=actor.x,y=actor.y-92;
      const state=medical.condition.toUpperCase();
      const color=medical.condition==="critical"?"#d94f42":medical.condition==="serious"?"#df8c3d":"#d5bc58";
      ctx.font="800 8px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillStyle="rgba(18,25,21,.82)";
      const width=Math.max(48,ctx.measureText(state).width+14);
      ctx.beginPath();ctx.roundRect(x-width/2,y-7,width,14,7);ctx.fill();
      ctx.fillStyle=color;ctx.fillText(state,x,y);
    }
    if(medical.bleedingRate>.05){
      ctx.fillStyle="#b84138";
      ctx.beginPath();ctx.arc(actor.x+13,actor.y+22,3+Math.sin((actor.workPhase??0)*4)*.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(actor.x+13,actor.y+25);ctx.lineTo(actor.x+10,actor.y+32);ctx.lineTo(actor.x+16,actor.y+32);ctx.closePath();ctx.fill();
    }
    if(medical.unconscious){
      ctx.strokeStyle="rgba(220,225,211,.5)";ctx.lineWidth=2;
      const breath=7+Math.sin(performance.now()*.003)*1.5;
      ctx.beginPath();ctx.arc(actor.x,actor.y+18,breath,0,Math.PI);ctx.stroke();
    }
  }finally{ctx.restore();}
 }

 #drawAICombatIndicator(ctx,actor){
  if(!actor.operationId)return;
  const medical=actor.medical;
  if(medical?.dead||medical?.unconscious)return;
  ctx.save();
  try{
    const x=actor.x,y=actor.y-82;
    if(actor.medicalAction?.phase==="treat"){
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
    const game=this._currentGame;
    const combat=game?.combat;
    const showCombatWeapon=Boolean(combat?.weaponAvailable)&&!carried;
    const renderOperator=showCombatWeapon?{...operator,carriedItemInstanceId:"combat-weapon-hidden"}:operator;
    if(showCombatWeapon&&combat.pointsBehindOperator)this.#drawCombatWeapon(ctx,operator,combat);
    drawOperator(ctx,renderOperator,carried);
    if(showCombatWeapon&&!combat.pointsBehindOperator)this.#drawCombatWeapon(ctx,operator,combat);
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
 #drawBehaviorLabGround(ctx,game){
  const layout=game.map.sandboxLayout;
  if(!layout)return;
  const activeId=game.sandboxFixtureId??game.sandboxFixture?.id;
  ctx.save();
  try{
   ctx.fillStyle="rgba(24,31,27,.17)";
   ctx.beginPath();ctx.roundRect(layout.controlWalk.x,layout.controlWalk.y,layout.controlWalk.width,layout.controlWalk.height,34);ctx.fill();
   ctx.strokeStyle="rgba(229,154,71,.34)";ctx.lineWidth=3;ctx.setLineDash([18,18]);
   ctx.strokeRect(layout.controlWalk.x+14,layout.controlWalk.y+14,layout.controlWalk.width-28,layout.controlWalk.height-28);ctx.setLineDash([]);
   ctx.fillStyle="rgba(238,235,214,.76)";ctx.font="800 24px system-ui";ctx.textAlign="left";
   ctx.fillText(layout.name.toUpperCase(),layout.controlWalk.x+34,layout.controlWalk.y+58);
   ctx.fillStyle="rgba(238,235,214,.5)";ctx.font="650 15px system-ui";
   ctx.fillText(layout.subtitle,layout.controlWalk.x+36,layout.controlWalk.y+86);

   for(const zone of layout.zones){
    const active=zone.id===activeId;
    ctx.fillStyle=active?"rgba(229,154,71,.10)":"rgba(22,31,26,.055)";
    ctx.beginPath();ctx.roundRect(zone.x,zone.y,zone.width,zone.height,28);ctx.fill();
    ctx.strokeStyle=active?"rgba(229,154,71,.72)":"rgba(224,227,207,.20)";
    ctx.lineWidth=active?5:2;ctx.setLineDash(active?[]:[16,18]);
    ctx.strokeRect(zone.x,zone.y,zone.width,zone.height);ctx.setLineDash([]);

    ctx.fillStyle=active?"rgba(229,154,71,.94)":"rgba(231,232,214,.54)";
    ctx.beginPath();ctx.arc(zone.x+44,zone.y+44,24,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=active?"#233028":"rgba(31,40,34,.86)";ctx.font="850 15px system-ui";ctx.textAlign="center";
    ctx.fillText(zone.index,zone.x+44,zone.y+50);
    ctx.textAlign="left";ctx.fillStyle=active?"rgba(247,234,204,.94)":"rgba(239,239,221,.63)";ctx.font="800 18px system-ui";
    ctx.fillText(zone.name,zone.x+78,zone.y+50);

    ctx.strokeStyle="rgba(235,237,217,.13)";ctx.lineWidth=2;ctx.setLineDash([12,18]);
    ctx.beginPath();ctx.moveTo(zone.x+zone.width/2,zone.y+105);ctx.lineTo(zone.x+zone.width/2,zone.y+zone.height-28);ctx.stroke();ctx.setLineDash([]);
   }

   ctx.strokeStyle="rgba(54,66,57,.34)";ctx.lineWidth=3;ctx.setLineDash([22,18]);
   ctx.beginPath();ctx.moveTo(80,layout.northLine.y);ctx.lineTo(4320,layout.northLine.y);ctx.stroke();
   ctx.beginPath();ctx.moveTo(80,layout.southLine.y);ctx.lineTo(4320,layout.southLine.y);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle="rgba(32,42,35,.58)";ctx.font="750 13px system-ui";ctx.textAlign="right";
   ctx.fillText(layout.northLine.label,4310,layout.northLine.y-10);
   ctx.fillText(layout.southLine.label,4310,layout.southLine.y-10);

   const factionColor={northline:"rgba(103,130,151,.64)",commune:"rgba(128,145,91,.68)",freelancers:"rgba(151,112,76,.66)"};
   for(const team of game.sandboxFixture?.teams??[]){
    for(const actor of team.actors){
     ctx.fillStyle=factionColor[team.factionId]??"rgba(230,230,210,.5)";
     ctx.beginPath();ctx.arc(actor.x,actor.y+28,25,0,Math.PI*2);ctx.fill();
     ctx.strokeStyle="rgba(245,242,221,.34)";ctx.lineWidth=2;ctx.stroke();
    }
   }
  }finally{ctx.restore();}
 }
 #drawRoad(ctx,road){const xs=road.map(p=>p.x),ys=road.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);ctx.fillStyle="#8b8068";ctx.fillRect(minX,minY,maxX-minX,maxY-minY);ctx.strokeStyle="rgba(46,42,34,.22)";ctx.lineWidth=6;ctx.setLineDash([24,34]);ctx.beginPath();ctx.moveTo(minX,(minY+maxY)/2);ctx.lineTo(maxX,(minY+maxY)/2);ctx.stroke();ctx.setLineDash([]);}
 #drawBrush(ctx,brush){for(const p of brush){ctx.fillStyle="rgba(47,77,50,.38)";for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=p.radius*(.45+i%3*.16);ctx.beginPath();ctx.arc(p.x+Math.cos(a)*r*.55,p.y+Math.sin(a)*r*.45,32+i%4*5,0,Math.PI*2);ctx.fill();}}}
 #drawExtraction(ctx,e){ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle="rgba(222,158,75,.13)";ctx.strokeStyle="rgba(235,176,96,.68)";ctx.lineWidth=5;ctx.setLineDash([14,12]);ctx.beginPath();ctx.arc(0,0,e.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="rgba(31,40,34,.9)";ctx.fillRect(-44,-18,88,36);ctx.fillStyle="#e4d5b8";ctx.font="700 16px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("RETURN",0,0);ctx.restore();}
 #drawSiteGround(ctx,site){ctx.fillStyle="rgba(119,105,77,.2)";ctx.beginPath();ctx.roundRect(660,340,1420,1000,80);ctx.fill();ctx.fillStyle="rgba(86,79,62,.18)";ctx.beginPath();ctx.roundRect(site.workArea.x-40,site.workArea.y-30,site.workArea.width+80,site.workArea.height+90,28);ctx.fill();ctx.fillStyle="rgba(38,46,39,.72)";ctx.font="700 18px system-ui";ctx.textAlign="left";ctx.fillText("OLD MAINTENANCE PULL-OFF",1140,350);}
 #drawShed(ctx,s){ctx.fillStyle="rgba(26,31,27,.24)";ctx.fillRect(s.x+16,s.y+18,s.width,s.height);ctx.fillStyle="#5e6255";ctx.fillRect(s.x,s.y,s.width,s.height);ctx.fillStyle="#373d35";const t=s.wallThickness;ctx.fillRect(s.x,s.y,s.width,t);ctx.fillRect(s.x,s.y,t,s.height);ctx.fillRect(s.x+s.width-t,s.y,t,s.height);ctx.fillRect(s.x,s.y+s.height-t,s.doorGap.start,t);ctx.fillRect(s.x+s.doorGap.start+s.doorGap.width,s.y+s.height-t,s.width-s.doorGap.start-s.doorGap.width,t);ctx.fillStyle="#817459";ctx.fillRect(s.x+52,s.y+62,s.width-104,s.height-118);}
 #drawTree(ctx,t){ctx.fillStyle="rgba(20,28,22,.24)";ctx.beginPath();ctx.ellipse(t.x+12,t.y+15,t.radius*.95,t.radius*.65,.2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#384b38";ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,Math.PI*2);ctx.fill();ctx.fillStyle="#52644b";ctx.beginPath();ctx.arc(t.x-t.radius*.2,t.y-t.radius*.22,t.radius*.7,0,Math.PI*2);ctx.fill();}
 #drawRock(ctx,r){ctx.fillStyle="rgba(24,29,25,.24)";ctx.beginPath();ctx.ellipse(r.x+8,r.y+10,r.radius,r.radius*.7,.1,0,Math.PI*2);ctx.fill();ctx.fillStyle="#686b61";ctx.beginPath();ctx.ellipse(r.x,r.y,r.radius,r.radius*.75,-.15,0,Math.PI*2);ctx.fill();}
 #drawMapBorder(ctx){ctx.strokeStyle="rgba(20,27,23,.5)";ctx.lineWidth=14;ctx.strokeRect(0,0,MAP_WIDTH,MAP_HEIGHT);}
}
