import { isAlive, isConscious, isCombatCapable, isActiveThreat, canBeTargeted, isTreating } from "./actor-state.js?v=11e-combat-authority-team-response-20260731";
import { moveActorToward, stopActor, isImmobileCasualty } from "./actor-motion.js?v=11e-combat-authority-team-response-20260731";
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const shortestAngle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

const CONFIG={
  magazineSize:20,
  reloadDuration:2.7,
  range:980,
  preferredMinRange:260,
  preferredMaxRange:610,
  contactMemorySeconds:18,
  burstMin:2,
  burstMax:4,
  shotInterval:.19,
  settleDuration:.42,
  suppressionRadius:82,
  playerSuppressionRadius:96,
  suppressionDecay:8,
  actorHitSuppression:38,
  nearMissSuppression:18
};

function segmentCircleHit(origin,end,circle){
  const dx=end.x-origin.x,dy=end.y-origin.y;
  const fx=origin.x-circle.x,fy=origin.y-circle.y;
  const a=dx*dx+dy*dy;
  const b=2*(fx*dx+fy*dy);
  const c=fx*fx+fy*fy-circle.radius*circle.radius;
  const discriminant=b*b-4*a*c;
  if(discriminant<0)return null;
  const root=Math.sqrt(discriminant);
  const values=[(-b-root)/(2*a),(-b+root)/(2*a)].filter(t=>t>=0&&t<=1).sort((x,y)=>x-y);
  const t=values[0];
  return Number.isFinite(t)?{t,x:origin.x+dx*t,y:origin.y+dy*t}:null;
}

function pointSegmentDistance(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const lengthSq=dx*dx+dy*dy;
  if(lengthSq<=.0001)return distance(point,a);
  const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/lengthSq,0,1);
  return Math.hypot(point.x-(a.x+dx*t),point.y-(a.y+dy*t));
}

function facingFromAngle(angle){
  const x=Math.cos(angle),y=Math.sin(angle);
  return Math.abs(x)>Math.abs(y)?(x>=0?"right":"left"):(y>=0?"down":"up");
}

export class AICombatSystem{
  constructor(game){
    this.game=game;
    this.playerThreatenedUntil=0;
    this.lastPlayerShotAt=-999;
    this.activeShooters=0;
  }

  ensureActor(actor){
    if(!actor.operationId||!actor.factionId)return;
    actor.ammoInMagazine ??= CONFIG.magazineSize;
    actor.magazineSize ??= CONFIG.magazineSize;
    actor.reloading ??= false;
    actor.reloadProgress ??= 0;
    actor.aimReadiness ??= 0;
    actor.combatAimAngle ??= Number.isFinite(actor.lookAngle)?actor.lookAngle:0;
    actor.fireCooldown ??= 0;
    actor.burstRemaining ??= 0;
    actor.burstPause ??= 0;
    actor.suppression ??= 0;
    actor.moraleState ??= "steady";
    actor.combatHits ??= 0;
    actor.threatenedByPlayerUntil ??= 0;
    actor.lastKnownEnemyPosition ??= null;
    actor.contactMemoryUntil ??= 0;
  }

  onPlayerShot(origin,end,result){
    this.lastPlayerShotAt=this.game.clockMinutes;
    for(const actor of this.game.actors){
      if(!actor.operationId||!isAlive(actor))continue;
      this.ensureActor(actor);
      const missDistance=pointSegmentDistance(actor,origin,end);
      if(result.actor===actor){
        actor.suppression=clamp(actor.suppression+CONFIG.actorHitSuppression,0,100);
        actor.threatenedByPlayerUntil=performance.now()/1000+18;
        actor.currentTask="Under fire from Mara";
        const shotDistance=Math.hypot(origin.x-actor.x,origin.y-actor.y);
        this.game.wounds?.applyGunshot?.(actor,result.point,{source:this.game.operator,distance:shotDistance});
      }else if(missDistance<CONFIG.suppressionRadius){
        const amount=CONFIG.nearMissSuppression*(1-missDistance/CONFIG.suppressionRadius);
        actor.suppression=clamp(actor.suppression+amount,0,100);
        actor.threatenedByPlayerUntil=performance.now()/1000+12;
      }
    }
  }

  getEncounterTarget(actor){
    const encounter=this.game.encounters?.getActorEncounter?.(actor.id);
    if(!encounter||(!encounter.combatEngaged&&encounter.state!=="threatening"))return null;
    const candidates=[this.game.operator,...this.game.actors].filter(candidate=>
      candidate&&candidate.id!==actor.id&&candidate.factionId!==actor.factionId&&canBeTargeted(candidate)
    );
    let best=null;
    for(const candidate of candidates){
      const sameEncounter=candidate.id===this.game.operator.id
        ?encounter.participantIds?.has?.("player")
        :encounter.participantIds?.has?.(candidate.id);
      const known=this.game.perception?.getDetection?.(actor.id,candidate.id);
      const shared=this.game.perception?.getTeamContact?.(actor.teamId,candidate.teamId??candidate.factionId);
      if(!sameEncounter&&!known&&!shared)continue;
      const d=distance(actor,candidate);
      const score=d+(candidate.suppression??0)*-.4+(candidate.medical?.condition==="wounded"?30:0);
      if(!best||score<best.score)best={candidate,score};
    }
    return best?.candidate??null;
  }

  getTarget(actor){
    const now=performance.now()/1000;
    let target=null;
    if(actor.threatenedByPlayerUntil>now&&actor.factionId!=="commune"&&canBeTargeted(this.game.operator)){
      target=this.game.operator;
    }else{
      target=this.getEncounterTarget(actor);
    }
    if(target){
      actor.lastKnownEnemyPosition={x:target.x,y:target.y};
      actor.contactMemoryUntil=now+CONFIG.contactMemorySeconds;
    }
    return target;
  }

  hasFriendlyInLine(actor,target,origin,end){
    for(const friendly of this.game.actors){
      if(friendly.id===actor.id||friendly.id===target.id||friendly.factionId!==actor.factionId||!isAlive(friendly))continue;
      const hit=segmentCircleHit(origin,end,{x:friendly.x,y:friendly.y,radius:(friendly.radius??18)+6});
      if(hit)return true;
    }
    return false;
  }

  resolveShot(actor,origin,end,target){
    let nearest={t:1,point:{...end},actor:null,obstacle:null};
    for(const candidate of [this.game.operator,...this.game.actors]){
      if(candidate.id===actor.id||!canBeTargeted(candidate))continue;
      const hit=segmentCircleHit(origin,end,{x:candidate.x,y:candidate.y,radius:candidate.radius??18});
      if(hit&&hit.t<nearest.t)nearest={t:hit.t,point:{x:hit.x,y:hit.y},actor:candidate,obstacle:null};
    }
    for(const obstacle of this.game.map.obstacles??[]){
      const hit=segmentCircleHit(origin,end,{x:obstacle.x,y:obstacle.y,radius:(obstacle.radius??25)*.8});
      if(hit&&hit.t<nearest.t)nearest={t:hit.t,point:{x:hit.x,y:hit.y},actor:null,obstacle};
    }
    return nearest;
  }

  addSuppressionAt(point,shooter,target){
    const player=this.game.operator;
    const playerDistance=distance(player,point);
    if(playerDistance<CONFIG.playerSuppressionRadius){
      const amount=22*(1-playerDistance/CONFIG.playerSuppressionRadius);
      this.game.combat.addSuppression(amount,angleTo(point,player));
    }
    for(const actor of this.game.actors){
      if(actor.id===shooter.id||!isAlive(actor))continue;
      const d=distance(actor,point);
      if(d<CONFIG.suppressionRadius){
        this.ensureActor(actor);
        actor.suppression=clamp(actor.suppression+14*(1-d/CONFIG.suppressionRadius),0,100);
      }
    }
  }

  fire(actor,target){
    if(actor.ammoInMagazine<=0){
      actor.reloading=true;
      actor.reloadProgress=0;
      actor.burstRemaining=0;
      return;
    }

    const targetDistance=distance(actor,target);
    const suppressionPenalty=(actor.suppression??0)/100;
    const moralePenalty=actor.moraleState==="pinned"?.08:actor.moraleState==="pressured"?.035:0;
    const baseSpread=.025+targetDistance/9000+suppressionPenalty*.12+moralePenalty;
    const deviation=(Math.random()+Math.random()-1)*baseSpread;
    const shotAngle=actor.combatAimAngle+deviation;
    const origin={
      x:actor.x+Math.cos(actor.combatAimAngle)*44,
      y:actor.y+Math.sin(actor.combatAimAngle)*44
    };
    const intended={
      x:origin.x+Math.cos(shotAngle)*CONFIG.range,
      y:origin.y+Math.sin(shotAngle)*CONFIG.range
    };

    if(this.hasFriendlyInLine(actor,target,origin,intended)){
      actor.burstRemaining=0;
      actor.burstPause=.65;
      return;
    }

    const result=this.resolveShot(actor,origin,intended,target);
    const end=result.point;
    actor.ammoInMagazine--;
    this.game.encounters?.markViolence?.(actor,target);
    actor.fireCooldown=CONFIG.shotInterval*(1+suppressionPenalty*.9);
    actor.burstRemaining=Math.max(0,actor.burstRemaining-1);

    this.game.combat.effects.push({type:"muzzle",x:origin.x,y:origin.y,angle:shotAngle,life:.085,maxLife:.085,source:"ai"});
    this.game.combat.effects.push({type:"tracer",x1:origin.x,y1:origin.y,x2:end.x,y2:end.y,life:.13,maxLife:.13,source:"ai"});
    if(result.actor){
      this.game.combat.effects.push({type:"hit",x:end.x,y:end.y,life:.16,maxLife:.16,source:"ai"});
      if(result.actor.id===this.game.operator.id){
        this.game.combat.addSuppression(34,angleTo(origin,this.game.operator));
        this.game.wounds?.applyGunshot?.(this.game.operator,end,{source:actor,distance:targetDistance});
      }else{
        this.ensureActor(result.actor);
        result.actor.suppression=clamp(result.actor.suppression+36,0,100);
        this.game.wounds?.applyGunshot?.(result.actor,end,{source:actor,distance:targetDistance});
      }
    }else{
      this.game.combat.decals.push({type:"impact",x:end.x,y:end.y,angle:Math.random()*Math.PI,life:46,maxLife:46});
    }
    this.addSuppressionAt(end,actor,target);

    if(actor.ammoInMagazine<=0){
      actor.reloading=true;
      actor.reloadProgress=0;
      actor.burstRemaining=0;
    }else if(actor.burstRemaining<=0){
      actor.burstPause=.55+Math.random()*.85+(actor.suppression/100)*.9;
    }
  }

  updateMorale(actor,delta){
    actor.suppression=clamp((actor.suppression??0)-CONFIG.suppressionDecay*delta,0,100);
    const previous=actor.moraleState;
    actor.moraleState=actor.suppression>=78?"breaking":actor.suppression>=55?"pinned":actor.suppression>=25?"pressured":"steady";
    if(actor.moraleState!==previous){
      if(actor.moraleState==="pinned")this.game.pushMessage(`${actor.name} is pinned`,1.45);
      actor.moralePulse=1;
    }
    actor.moralePulse=Math.max(0,(actor.moralePulse??0)-delta*2);
  }

  updateActor(actor,delta){
    this.ensureActor(actor);
    if(actor.actionLock?.allowsCombat===false){
      actor.fireCooldown=0;actor.burstRemaining=0;actor.aimReadiness=0;
      return;
    }
    this.updateMorale(actor,delta);
    if(actor.medicalAction){
      actor.vx=0;actor.vy=0;actor.burstRemaining=0;actor.fireHeld=false;
      return;
    }
    if(isImmobileCasualty(actor)||actor.beingDragged){
      stopActor(actor,actor.medical?.dead?"dead":"downed");
      actor.operationPausedByEncounter=true;
      return;
    }

    actor.fireCooldown=Math.max(0,(actor.fireCooldown??0)-delta);
    actor.burstPause=Math.max(0,(actor.burstPause??0)-delta);

    if(actor.reloading){
      actor.operationPausedByEncounter=true;
      actor.workPose="brace";
      actor.reloadProgress=clamp(actor.reloadProgress+delta/CONFIG.reloadDuration,0,1);
      if(actor.reloadProgress>=1){
        actor.reloading=false;
        actor.reloadProgress=0;
        actor.ammoInMagazine=actor.magazineSize;
      }
      return;
    }

    const support=actor.supportAssignment;
    if(support&&(support.until??0)>performance.now()/1000&&!this.getTarget(actor)){
      const d=Math.hypot(support.destination.x-actor.x,support.destination.y-actor.y);
      if(d>70){
        moveActorToward(actor,support.destination,delta,{
          game:this.game,speedMultiplier:1.05,arrivalRadius:55,
          task:support.plan==="support"?"Reinforcing friendly team":"Moving to support flank",pose:"walk"
        });
        actor.locomotionMode="run";
        return;
      }
    }

    const target=this.getTarget(actor);
    if(!target){
      actor.aimReadiness=Math.max(0,actor.aimReadiness-delta*2.2);
      const now=performance.now()/1000;
      if(actor.lastKnownEnemyPosition&&actor.contactMemoryUntil>now){
        const memory=actor.lastKnownEnemyPosition;
        actor.operationPausedByEncounter=true;
        actor.currentTask="Searching last known position";
        actor.currentAction="Searching for contact";
        actor.workPose="scan";
        const desired=angleTo(actor,memory);
        actor.combatAimAngle+=shortestAngle(actor.combatAimAngle,desired)*(1-Math.exp(-delta*3.5));
        actor.lookAngle=actor.combatAimAngle;
        const d=Math.hypot(memory.x-actor.x,memory.y-actor.y);
        if(d>360)moveActorToward(actor,memory,delta,{game:this.game,speedMultiplier:.16,arrivalRadius:350,task:"Searching last known position",pose:"walk"});
      }else{
        actor.lastKnownEnemyPosition=null;
        if(actor.moraleState==="steady"&&!actor.encounterId)actor.operationPausedByEncounter=false;
      }
      return;
    }

    actor.operationPausedByEncounter=true;
    actor.currentTask=actor.moraleState==="breaking"?"Breaking contact":actor.moraleState==="pinned"?"Pinned by fire":"Engaging contact";
    actor.currentAction=actor.currentTask;
    actor.workPose=actor.moraleState==="breaking"?"walk":"brace";

    const desired=angleTo(actor,target);
    actor.combatAimAngle+=shortestAngle(actor.combatAimAngle,desired)*(1-Math.exp(-delta*(actor.moraleState==="pinned"?4:8)));
    actor.lookAngle=actor.combatAimAngle;
    actor.facing=facingFromAngle(actor.combatAimAngle);
    const targetDistance=distance(actor,target);
    actor.aimReadiness=clamp(actor.aimReadiness+delta*(actor.moraleState==="pinned"?.75:2.4),0,1);
    const now=performance.now()/1000;
    const plan=(actor.tacticalPlanUntil??0)>now?actor.tacticalPlan:"hold";
    const slot=(actor.tacticalSlotUntil??0)>now?actor.tacticalSlot:null;
    let repositioning=false;
    if(slot&&actor.moraleState!=="pinned"&&actor.moraleState!=="breaking"){
      const slotDistance=Math.hypot(slot.x-actor.x,slot.y-actor.y);
      if(slotDistance>82){
        const urgent=plan==="withdraw"||plan==="flank_left"||plan==="flank_right";
        moveActorToward(actor,slot,delta,{
          game:this.game,
          speedMultiplier:urgent?1.05:.64,
          arrivalRadius:60,
          task:plan==="withdraw"?"Falling back to rally line":
            plan.startsWith("flank")?"Moving to flank position":
            plan==="push"?"Advancing the firing line":"Taking firing position",
          pose:"walk"
        });
        actor.locomotionMode=urgent?"run":"jog";
        actor.aimReadiness=Math.max(.35,actor.aimReadiness-delta*.28);
        repositioning=true;
      }
    }

    // The squad slot is the normal movement authority. Only emergency
    // distance correction and morale can override it.
    if(actor.moraleState!=="pinned"&&actor.moraleState!=="breaking"&&!repositioning){
      if(plan==="withdraw"||targetDistance<285){
        const fallback=actor.tacticalRallyPoint??{
          x:actor.x-Math.cos(desired)*(plan==="withdraw"?260:120),
          y:actor.y-Math.sin(desired)*(plan==="withdraw"?260:120)
        };
        moveActorToward(actor,fallback,delta,{
          game:this.game,speedMultiplier:plan==="withdraw"?1.25:.72,
          arrivalRadius:28,
          task:plan==="withdraw"?"Withdrawing to rally point":"Opening distance",
          pose:"walk"
        });
        actor.currentTask=plan==="withdraw"?"Withdrawing to rally point":"Opening distance";
        repositioning=true;
      }
    }

    if(actor.moraleState==="breaking"){
      const dx=actor.x-target.x,dy=actor.y-target.y,d=Math.max(1,Math.hypot(dx,dy));
      const retreat={x:actor.x+dx/d*180,y:actor.y+dy/d*180};
      moveActorToward(actor,retreat,delta,{game:this.game,speedMultiplier:.42,arrivalRadius:12,task:"Breaking contact",pose:"walk"});
      return;
    }

    if(actor.moraleState==="pinned"){
      const cover=this.game.encounters?.findCover?.(actor,target);
      if(cover)moveActorToward(actor,cover,delta,{game:this.game,speedMultiplier:1.2,arrivalRadius:18,task:"Crawling into cover",pose:"walk"});
      else{actor.vx=0;actor.vy=0;}
      return;
    }

    const requiredReadiness=repositioning?.86:.72;
    if(targetDistance>CONFIG.range||actor.aimReadiness<requiredReadiness||actor.fireCooldown>0||actor.burstPause>0)return;
    if(actor.burstRemaining<=0){
      actor.burstRemaining=CONFIG.burstMin+Math.floor(Math.random()*(CONFIG.burstMax-CONFIG.burstMin+1));
    }
    this.fire(actor,target);
  }

  update(delta){
    this.activeShooters=0;
    for(const actor of this.game.actors){
      if(!actor.operationId||!actor.factionId)continue;
      this.updateActor(actor,delta);
      if(actor.burstRemaining>0||actor.reloading||actor.aimReadiness>.7)this.activeShooters++;
    }
  }
}
