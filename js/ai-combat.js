const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const shortestAngle=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

const CONFIG={
  magazineSize:20,
  reloadDuration:2.7,
  range:820,
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
  }

  onPlayerShot(origin,end,result){
    this.lastPlayerShotAt=this.game.clockMinutes;
    for(const actor of this.game.actors){
      if(!actor.operationId||actor.condition==="incapacitated")continue;
      this.ensureActor(actor);
      const missDistance=pointSegmentDistance(actor,origin,end);
      if(result.actor===actor){
        actor.suppression=clamp(actor.suppression+CONFIG.actorHitSuppression,0,100);
        actor.combatHits++;
        actor.threatenedByPlayerUntil=performance.now()/1000+18;
        actor.currentTask="Under fire from Mara";
        if(actor.combatHits>=3){
          actor.condition="incapacitated";
          actor.currentAction="Incapacitated";
          actor.workPose="kneel";
          actor.vx=0;actor.vy=0;
          this.game.pushMessage(`${actor.name} is down`,2.1);
        }
      }else if(missDistance<CONFIG.suppressionRadius){
        const amount=CONFIG.nearMissSuppression*(1-missDistance/CONFIG.suppressionRadius);
        actor.suppression=clamp(actor.suppression+amount,0,100);
        actor.threatenedByPlayerUntil=performance.now()/1000+12;
      }
    }
  }

  getEncounterTarget(actor){
    const encounter=this.game.encounters?.getActorEncounter?.(actor.id);
    if(!encounter||encounter.state!=="threatening")return null;
    let nearest=null,nearestDistance=Infinity;
    for(const id of encounter.participantIds??[]){
      const candidate=this.game.actors.find(a=>a.id===id);
      if(!candidate||candidate.id===actor.id||candidate.factionId===actor.factionId||candidate.condition==="incapacitated")continue;
      const d=distance(actor,candidate);
      if(d<nearestDistance){nearest=candidate;nearestDistance=d;}
    }
    return nearest;
  }

  getTarget(actor){
    const now=performance.now()/1000;
    if(actor.threatenedByPlayerUntil>now&&actor.factionId!=="commune"){
      return this.game.operator;
    }
    return this.getEncounterTarget(actor);
  }

  hasFriendlyInLine(actor,target,origin,end){
    for(const friendly of this.game.actors){
      if(friendly.id===actor.id||friendly.id===target.id||friendly.factionId!==actor.factionId||friendly.condition==="incapacitated")continue;
      const hit=segmentCircleHit(origin,end,{x:friendly.x,y:friendly.y,radius:(friendly.radius??18)+6});
      if(hit)return true;
    }
    return false;
  }

  resolveShot(actor,origin,end,target){
    let nearest={t:1,point:{...end},actor:null,obstacle:null};
    for(const candidate of [this.game.operator,...this.game.actors]){
      if(candidate.id===actor.id||candidate.condition==="incapacitated")continue;
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
      if(actor.id===shooter.id||actor.condition==="incapacitated")continue;
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
    actor.fireCooldown=CONFIG.shotInterval*(1+suppressionPenalty*.9);
    actor.burstRemaining=Math.max(0,actor.burstRemaining-1);

    this.game.combat.effects.push({type:"muzzle",x:origin.x,y:origin.y,angle:shotAngle,life:.085,maxLife:.085,source:"ai"});
    this.game.combat.effects.push({type:"tracer",x1:origin.x,y1:origin.y,x2:end.x,y2:end.y,life:.13,maxLife:.13,source:"ai"});
    if(result.actor){
      this.game.combat.effects.push({type:"hit",x:end.x,y:end.y,life:.16,maxLife:.16,source:"ai"});
      if(result.actor.id===this.game.operator.id){
        this.game.combat.addSuppression(34,angleTo(origin,this.game.operator));
        this.game.pushMessage("Incoming fire",1.05);
      }else{
        this.ensureActor(result.actor);
        result.actor.suppression=clamp(result.actor.suppression+36,0,100);
        result.actor.combatHits=(result.actor.combatHits??0)+1;
        if(result.actor.combatHits>=3){
          result.actor.condition="incapacitated";
          result.actor.currentAction="Incapacitated";
          result.actor.workPose="kneel";
        }
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
    this.updateMorale(actor,delta);
    if(actor.condition==="incapacitated"){
      actor.vx=0;actor.vy=0;actor.operationPausedByEncounter=true;
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

    const target=this.getTarget(actor);
    if(!target){
      actor.aimReadiness=Math.max(0,actor.aimReadiness-delta*3.5);
      if(actor.moraleState==="steady"&&!actor.encounterId)actor.operationPausedByEncounter=false;
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
    actor.aimReadiness=clamp(actor.aimReadiness+delta*(actor.moraleState==="pinned"?.75:2.4),0,1);

    if(actor.moraleState==="breaking"){
      const dx=actor.x-target.x,dy=actor.y-target.y,d=Math.max(1,Math.hypot(dx,dy));
      actor.x+=dx/d*actor.moveSpeed*.42*delta;
      actor.y+=dy/d*actor.moveSpeed*.42*delta;
      actor.groundY=actor.y+actor.radius;
      return;
    }

    if(actor.moraleState==="pinned"){
      actor.vx=0;actor.vy=0;
      return;
    }

    if(actor.aimReadiness<.72||actor.fireCooldown>0||actor.burstPause>0)return;
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
