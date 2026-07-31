import { moveActorToward, stopActor, isImmobileCasualty } from "./actor-motion.js?v=10c-casualty-states-aid-movement-20260731";
const RELATIONSHIPS = {
  "commune:northline": -22,
  "commune:freelancers": -34,
  "freelancers:northline": -48
};

const STATE_ORDER = ["unaware","aware","watchful","challenging","blocking","threatening","disengaging"];

function pairKey(a,b){return [a,b].sort().join(":");}
function relation(a,b){return a===b?100:(RELATIONSHIPS[pairKey(a,b)]??-15);}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function faceToward(actor,target){
  const dx=target.x-actor.x,dy=target.y-actor.y;
  actor.facing=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
}
function opposite(f){return f==="left"?"right":f==="right"?"left":f==="up"?"down":"up";}

function groupActors(actors){
  const groups=new Map();
  for(const actor of actors){
    if(!actor.factionId||!actor.operationId)continue;
    const key=actor.teamId??actor.factionId;
    if(!groups.has(key))groups.set(key,{id:key,factionId:actor.factionId,actors:[]});
    groups.get(key).actors.push(actor);
  }
  return [...groups.values()];
}

function center(group){
  const count=Math.max(1,group.actors.length);
  return {
    x:group.actors.reduce((sum,a)=>sum+a.x,0)/count,
    y:group.actors.reduce((sum,a)=>sum+a.y,0)/count
  };
}

function nearestPair(a,b){
  let best=null;
  for(const actorA of a.actors)for(const actorB of b.actors){
    const d=distance(actorA,actorB);
    if(!best||d<best.distance)best={actorA,actorB,distance:d};
  }
  return best;
}

export class FactionEncounterSystem{
  constructor(game){
    this.game=game;
    this.encounters=new Map();
    this.dispositions=new Map();
    this.activeCount=0;
  }


  getDisposition(key){
    if(!this.dispositions.has(key))this.dispositions.set(key,{level:"clear",score:0,quietTime:0,lastReason:null});
    return this.dispositions.get(key);
  }

  raiseDisposition(key,reason,severity=1){
    const disposition=this.getDisposition(key);
    disposition.score=Math.min(100,disposition.score+severity);
    disposition.lastReason=reason;
    disposition.quietTime=0;
    disposition.level=disposition.score>=70?"hostile":disposition.score>=38?"contested":disposition.score>=12?"wary":"observed";
    return disposition;
  }

  easeDisposition(disposition){
    disposition.score=Math.max(0,disposition.score-8);
    disposition.level=disposition.score>=70?"hostile":disposition.score>=38?"contested":disposition.score>=12?"wary":disposition.score>0?"observed":"clear";
    disposition.quietTime=0;
  }

  applyWaryBehavior(a,b,disposition){
    const ca=center(a),cb=center(b);
    for(const group of [a,b]){
      const other=group===a?cb:ca;
      for(let i=0;i<group.actors.length;i++){
        const actor=group.actors[i];
        if(i===0||actor.role==="Security"){
          actor.operationPausedByEncounter=true;
          actor.motionState="encounter";
          actor.vx=0;actor.vy=0;
          actor.currentAction="Maintaining watch";
          actor.currentTask="Keeping watch on the nearby opposing crew";
          actor.workPose=actor.role==="Security"?"brace":"scan";
          faceToward(actor,other);
        }else{
          actor.operationPausedByEncounter=false;
          actor.currentAction="Working cautiously";
        }
        actor.encounterState="watchful";
        actor.encounterReason=disposition.lastReason??"recent contact";
      }
    }
  }

  getRelation(a,b){return relation(a,b);}

  teamsHaveContact(a,b){
    const perception=this.game.perception;
    if(!perception)return false;
    return perception.teamHasContact(a.id,b.id,"suspected")||perception.teamHasContact(b.id,a.id,"suspected");
  }

  strongestContact(a,b){
    const ab=this.game.perception?.getTeamContact(a.id,b.id);
    const ba=this.game.perception?.getTeamContact(b.id,a.id);
    return [ab,ba].filter(Boolean).sort((x,y)=>y.certainty-x.certainty)[0]??null;
  }

  getActorEncounter(actorId){
    for(const encounter of this.encounters.values()){
      if(encounter.participantIds.has(actorId)&&!["unaware","disengaging"].includes(encounter.state))return encounter;
    }
    return null;
  }

  update(delta){
    if(!this.game.operations?.started)return;
    const groups=groupActors(this.game.actors);
    const seen=new Set();

    for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const a=groups[i],b=groups[j];
      if(a.factionId===b.factionId)continue;
      const nearest=nearestPair(a,b);
      if(!nearest)continue;

      const key=pairKey(a.id,b.id);
      seen.add(key);
      let encounter=this.encounters.get(key);
      if(!encounter){
        encounter={
          id:`encounter_${key}`,
          key,
          teamAId:a.id,teamBId:b.id,
          factionA:a.factionId,factionB:b.factionId,
          state:"unaware",elapsed:0,cooldown:0,
          participantIds:new Set(),
          challengerId:null,targetId:null,
          reason:null,line:null,
          yieldedFaction:null,
          repeatCount:0
        };
        this.encounters.set(key,encounter);
      }

      encounter.elapsed+=delta;
      encounter.participantIds=new Set([...a.actors,...b.actors].map(actor=>actor.id));
      const rel=relation(a.factionId,b.factionId);
      const d=nearest.distance;
      const disposition=this.getDisposition(key);
      if(d<760&&disposition.level!=="clear")disposition.quietTime=0;
      else disposition.quietTime+=delta;
      if(disposition.level!=="clear"&&d>900&&disposition.quietTime>42)this.easeDisposition(disposition);

      if(d>900){
        if(encounter.state!=="unaware"){
          encounter.state="disengaging";
          encounter.cooldown+=delta;
          this.releaseActors(encounter);
          if(encounter.cooldown>18){encounter.state="unaware";encounter.elapsed=0;encounter.cooldown=0;encounter.reason=null;encounter.line=null;}
        }
        continue;
      }

      encounter.cooldown=0;
      const contact=this.strongestContact(a,b);
      const hasContact=this.teamsHaveContact(a,b);
      const contested=this.detectContestedReason(a,b,nearest);
      encounter.reason=contested;
      encounter.contactLevel=contact?.level??"unaware";
      encounter.contactCertainty=contact?.certainty??0;

      if(!hasContact){
        if(disposition.level!=="clear"&&d<760){
          this.applyWaryBehavior(a,b,disposition);
          continue;
        }
        if(encounter.state!=="unaware"){
          encounter.state="disengaging";
          encounter.cooldown+=delta;
          this.releaseActors(encounter);
          if(encounter.cooldown>14){encounter.state="unaware";encounter.elapsed=0;encounter.cooldown=0;}
        }
        continue;
      }

      const repeatAcceleration=disposition.level==="contested"||disposition.level==="hostile"?2.2:disposition.level==="wary"?1.55:1;
      encounter.elapsed+=delta*(repeatAcceleration-1);

      // Contact begins at scouting distance. Crews observe and plan before closing.
      if(d<780&&encounter.state==="unaware"){
        encounter.state="aware";encounter.elapsed=0;
      }else if(d<650&&encounter.state==="aware"&&encounter.elapsed>1.2){
        encounter.state="watchful";encounter.elapsed=0;
      }else if(d<680&&encounter.state==="watchful"&&encounter.elapsed>3.2){
        encounter.state="challenging";encounter.elapsed=0;
        encounter.repeatCount++;
        this.raiseDisposition(key,encounter.reason,encounter.repeatCount>1?14:9);
        this.beginChallenge(encounter,a,b,nearest,rel);
      }else if(d<590&&encounter.state==="challenging"&&encounter.elapsed>3.8){
        encounter.state="blocking";encounter.elapsed=0;
      }else if(d<510&&encounter.state==="blocking"&&encounter.elapsed>4.2&&rel<=-25){
        encounter.state="threatening";encounter.elapsed=0;
        encounter.lastHostileContactAt=performance.now()/1000;
        this.raiseDisposition(key,encounter.reason,22);
      }
      if(encounter.state==="threatening"&&hasContact){
        encounter.lastHostileContactAt=performance.now()/1000;
      }

      this.applyEncounterBehavior(encounter,a,b,nearest);
    }

    for(const [key,encounter] of this.encounters){
      if(!seen.has(key)&&encounter.state!=="unaware"){
        encounter.state="disengaging";
        this.releaseActors(encounter);
      }
    }
    this.activeCount=[...this.encounters.values()].filter(e=>!["unaware","disengaging"].includes(e.state)).length;
  }

  detectContestedReason(a,b,nearest){
    const actors=[...a.actors,...b.actors];
    const nearCulvert=actors.some(actor=>Math.hypot(actor.x-3820,actor.y-880)<300);
    if(nearCulvert){
      if([a.factionId,b.factionId].includes("freelancers")&&[a.factionId,b.factionId].includes("northline"))return "salvage claim at an active infrastructure site";
      if([a.factionId,b.factionId].includes("commune")&&[a.factionId,b.factionId].includes("northline"))return "aid movement through a controlled work zone";
    }
    const nearShelter=actors.some(actor=>Math.hypot(actor.x-2500,actor.y-1180)<260);
    if(nearShelter&&[a.factionId,b.factionId].includes("freelancers"))return "access to protected medical supplies";
    return "overlapping routes and unclear right of way";
  }

  beginChallenge(encounter,a,b,nearest,rel){
    const priority={northline:3,commune:2,freelancers:1};
    const challengerGroup=priority[a.factionId]>=priority[b.factionId]?a:b;
    const targetGroup=challengerGroup===a?b:a;
    const challenger=challengerGroup.actors.find(actor=>actor.role==="Security")??challengerGroup.actors[0];
    const target=targetGroup.actors[0];
    encounter.challengerId=challenger.id;encounter.targetId=target.id;
    encounter.line=this.challengeLine(challenger.factionId,target.factionId,encounter.reason);
    this.game.pushMessage(`${challenger.name}: ${encounter.line}`,3.8);
    this.game.emitEvent("factionChallenge",challenger);
  }

  challengeLine(from,to,reason){
    if(from==="northline"&&to==="freelancers")return "That equipment is inside an active work site. Step back.";
    if(from==="northline"&&to==="commune")return "Keep the aid route clear of the marked work zone.";
    if(from==="commune"&&to==="northline")return "People need this route too. We are coming through.";
    if(from==="commune"&&to==="freelancers")return "Those supplies are for the shelter. Leave them alone.";
    if(from==="freelancers"&&to==="northline")return "We have a recovery claim. Do not box us out.";
    if(from==="freelancers"&&to==="commune")return "We are not touching your medicine. Keep moving.";
    return `Hold there. We need to settle ${reason}.`;
  }

  reactionFor(group,other,encounter){
    const contact=this.game.perception?.getTeamContact(group.id,other.id);
    const seenByTarget=this.game.perception?.teamHasContact(other.id,group.id,"located")??false;
    const rel=relation(group.factionId,other.factionId);
    const operation=this.game.operations?.getOperation(group.actors[0]?.operationId);
    const taskPressure=operation?.status==="active"&&operation?.tasks?.some(task=>task.status==="in_progress");

    if(group.factionId==="northline"){
      if(encounter.state==="threatening")return "take_cover";
      if(taskPressure&&rel>-40)return "block";
      return seenByTarget?"overwatch":"track";
    }
    if(group.factionId==="commune"){
      if(encounter.state==="threatening")return "retreat";
      if(taskPressure)return "protect";
      return seenByTarget?"challenge":"track";
    }
    if(group.factionId==="freelancers"){
      if(!seenByTarget&&contact?.level==="identified")return "flank";
      if(encounter.state==="threatening")return "disengage";
      return "track";
    }
    return "track";
  }

  applyReaction(group,other,reaction,encounter){
    const otherCenter=center(other);
    for(let i=0;i<group.actors.length;i++){
      const actor=group.actors[i];
      actor.contactReaction=reaction;
      const hardPause=["overwatch","take_cover","block","protect","challenge"].includes(reaction);
      actor.operationPausedByEncounter=hardPause;
      if(hardPause){
        actor.vx=0;actor.vy=0;actor.motionState="encounter";
      }
      actor.workProp=null;
      faceToward(actor,{x:otherCenter.x,y:otherCenter.y});

      if(reaction==="track"){
        actor.currentAction="Scouting contact";actor.currentTask="Watching the contact while repositioning";actor.workPose="scan";
        actor.operationPausedByEncounter=false;
      }else if(reaction==="overwatch"){
        actor.currentAction="Taking overwatch";actor.currentTask="Holding an overwatch position";actor.workPose="brace";
      }else if(reaction==="take_cover"){
        actor.currentAction="Taking cover";actor.currentTask="Moving toward nearby cover";actor.workPose="brace";
        const cover=this.findCover(actor,otherCenter);
        if(cover)moveActorToward(actor,cover,1/60,{speedMultiplier:.48,arrivalRadius:18,task:"Moving to cover",pose:"walk"});
      }else if(reaction==="block"){
        actor.currentAction="Blocking route";actor.currentTask="Blocking access to the work site";actor.workPose="brace";
      }else if(reaction==="protect"){
        actor.currentAction="Protecting supplies";actor.currentTask="Forming around vulnerable supplies";actor.workPose=i===0?"brace":"scan";
      }else if(reaction==="challenge"){
        actor.currentAction="Calling out";actor.currentTask="Warning the opposing crew";actor.workPose="brace";
      }else if(reaction==="flank"){
        actor.currentAction="Flanking contact";actor.currentTask="Moving for a side angle";actor.workPose="walk";
        const dx=otherCenter.x-actor.x,dy=otherCenter.y-actor.y,d=Math.max(1,Math.hypot(dx,dy));
        const side=i%2?1:-1;
        const flankTarget={x:actor.x+(-dy/d)*side*110,y:actor.y+(dx/d)*side*110};
        moveActorToward(actor,flankTarget,1/60,{speedMultiplier:.55,arrivalRadius:12,task:"Flanking contact",pose:"walk"});
      }else if(reaction==="retreat"||reaction==="disengage"){
        actor.currentAction="Disengaging";actor.currentTask="Breaking contact";actor.workPose="walk";
        const dx=actor.x-otherCenter.x,dy=actor.y-otherCenter.y,d=Math.max(1,Math.hypot(dx,dy));
        const retreatTarget={x:actor.x+dx/d*150,y:actor.y+dy/d*150};
        moveActorToward(actor,retreatTarget,1/60,{speedMultiplier:.62,arrivalRadius:12,task:"Breaking contact",pose:"walk"});
      }
      actor.groundY=actor.y+actor.radius;
    }
  }

  findCover(actor,threat){
    const candidates=this.game.map.obstacles
      .filter(obstacle=>Math.hypot(obstacle.x-actor.x,obstacle.y-actor.y)<330)
      .map(obstacle=>{
        const fromThreat=Math.hypot(obstacle.x-threat.x,obstacle.y-threat.y);
        const fromActor=Math.hypot(obstacle.x-actor.x,obstacle.y-actor.y);
        return{...obstacle,score:fromThreat-fromActor*.8+(obstacle.type==="rock"?45:25)};
      })
      .sort((a,b)=>b.score-a.score);
    return candidates[0]??null;
  }

  applyEncounterBehavior(encounter,a,b,nearest){
    const active=!["unaware","disengaging"].includes(encounter.state);
    if(!active)return;

    const reactionA=this.reactionFor(a,b,encounter);
    const reactionB=this.reactionFor(b,a,encounter);
    this.applyReaction(a,b,reactionA,encounter);
    this.applyReaction(b,a,reactionB,encounter);

    const challenger=this.game.actors.find(actor=>actor.id===encounter.challengerId)??nearest.actorA;
    const target=this.game.actors.find(actor=>actor.id===encounter.targetId)??nearest.actorB;
    faceToward(challenger,target);faceToward(target,challenger);

    for(const actor of [...a.actors,...b.actors]){
      if(isImmobileCasualty(actor)||actor.beingDragged){stopActor(actor,actor.medical?.dead?"dead":"downed");continue;}
      actor.encounterState=encounter.state;
      actor.encounterReason=encounter.reason;
      actor.encounterId=encounter.id;
      actor.operationPausedByEncounter=["challenging","blocking","threatening"].includes(encounter.state);
      actor.encounterState=encounter.state;
      actor.encounterReason=encounter.reason;
      actor.encounterId=encounter.id;
    }

    if(encounter.state==="blocking"){
      this.placeBlocker(challenger,target);
    }
    if(encounter.state==="threatening"){
      challenger.workPose="brace";
      target.workPose="scan";
    }

    if(encounter.elapsed>12&&["challenging","blocking"].includes(encounter.state)){
      const yieldFaction=this.chooseYield(encounter,a,b);
      encounter.yieldedFaction=yieldFaction;
      this.raiseDisposition(encounter.key,encounter.reason,12);
      encounter.state="disengaging";
      this.game.pushMessage(`${yieldFaction==="commune"?"Commune":yieldFaction==="northline"?"Northline":"Freelancers"} yields the immediate route.`,3.2);
      this.releaseActors(encounter,yieldFaction);
    }
  }

  placeBlocker(challenger,target){
    if(isImmobileCasualty(challenger)||challenger.beingDragged){stopActor(challenger);return;}
    const dx=target.x-challenger.x,dy=target.y-challenger.y,d=Math.max(1,Math.hypot(dx,dy));
    const desired={x:target.x-dx/d*74,y:target.y-dy/d*74};
    const arrived=moveActorToward(challenger,desired,1/60,{
      speedMultiplier:.5,arrivalRadius:12,task:"Moving to block the route",pose:"walk"
    });
    if(arrived){challenger.workPose="brace";challenger.currentTask="Blocking the route";}
  }

  chooseYield(encounter,a,b){
    const rel=relation(a.factionId,b.factionId);
    if(encounter.reason.includes("active infrastructure"))return "freelancers";
    if(encounter.reason.includes("protected medical"))return "freelancers";
    if(encounter.reason.includes("aid movement"))return "northline";
    if(rel<=-45)return Math.random()<0.55?"freelancers":"northline";
    return a.actors.length<b.actors.length?a.factionId:b.factionId;
  }

  releaseActors(encounter,yieldFaction=null){
    for(const id of encounter.participantIds){
      const actor=this.game.actors.find(candidate=>candidate.id===id);if(!actor)continue;
      actor.operationPausedByEncounter=false;
      actor.encounterState="disengaging";
      actor.motionState="walking";
      actor.workPose="walk";
      actor.workProp=null;
      if(yieldFaction&&actor.factionId===yieldFaction){
        actor.routeIndex=Math.max(0,actor.routeIndex-1);
        actor.currentTask="Yielding the route";
      }
    }
  }
}
