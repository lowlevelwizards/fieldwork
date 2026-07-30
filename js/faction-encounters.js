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
    this.activeCount=0;
  }

  getRelation(a,b){return relation(a,b);}

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
          yieldedFaction:null
        };
        this.encounters.set(key,encounter);
      }

      encounter.elapsed+=delta;
      encounter.participantIds=new Set([...a.actors,...b.actors].map(actor=>actor.id));
      const rel=relation(a.factionId,b.factionId);
      const d=nearest.distance;

      if(d>430){
        if(encounter.state!=="unaware"){
          encounter.state="disengaging";
          encounter.cooldown+=delta;
          this.releaseActors(encounter);
          if(encounter.cooldown>4){encounter.state="unaware";encounter.elapsed=0;encounter.cooldown=0;encounter.reason=null;encounter.line=null;}
        }
        continue;
      }

      encounter.cooldown=0;
      const contested=this.detectContestedReason(a,b,nearest);
      encounter.reason=contested;

      if(d<360&&encounter.state==="unaware"){
        encounter.state="aware";encounter.elapsed=0;
      }else if(d<285&&encounter.state==="aware"&&encounter.elapsed>1.4){
        encounter.state="watchful";encounter.elapsed=0;
      }else if(d<215&&encounter.state==="watchful"&&encounter.elapsed>2.0){
        encounter.state="challenging";encounter.elapsed=0;
        this.beginChallenge(encounter,a,b,nearest,rel);
      }else if(d<160&&encounter.state==="challenging"&&encounter.elapsed>3.5){
        encounter.state="blocking";encounter.elapsed=0;
      }else if(d<115&&encounter.state==="blocking"&&encounter.elapsed>4.5&&rel<=-40){
        encounter.state="threatening";encounter.elapsed=0;
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

  applyEncounterBehavior(encounter,a,b,nearest){
    const active=!["unaware","disengaging"].includes(encounter.state);
    if(!active)return;

    const challenger=this.game.actors.find(actor=>actor.id===encounter.challengerId)??nearest.actorA;
    const target=this.game.actors.find(actor=>actor.id===encounter.targetId)??nearest.actorB;
    faceToward(challenger,target);faceToward(target,challenger);

    for(const actor of [...a.actors,...b.actors]){
      actor.encounterState=encounter.state;
      actor.encounterReason=encounter.reason;
      actor.encounterId=encounter.id;
      actor.operationPausedByEncounter=["watchful","challenging","blocking","threatening"].includes(encounter.state);
      if(actor.operationPausedByEncounter){
        actor.vx=0;actor.vy=0;actor.motionState="encounter";
        actor.currentAction=encounter.state==="watchful"?"Watching opposing crew":encounter.state==="challenging"?"Challenging opposing crew":encounter.state==="blocking"?"Blocking the route":"Holding a threat posture";
        actor.currentTask=actor.currentAction;
        actor.workPose=encounter.state==="threatening"?"brace":"scan";
        actor.workProp=null;
      }
    }

    if(encounter.state==="blocking"){
      this.placeBlocker(challenger,target);
    }
    if(encounter.state==="threatening"){
      challenger.workPose="brace";
      target.workPose="scan";
    }

    if(encounter.elapsed>8&&["challenging","blocking","threatening"].includes(encounter.state)){
      const yieldFaction=this.chooseYield(encounter,a,b);
      encounter.yieldedFaction=yieldFaction;
      encounter.state="disengaging";
      this.game.pushMessage(`${yieldFaction==="commune"?"Commune":yieldFaction==="northline"?"Northline":"Freelancers"} yields the immediate route.`,3.2);
      this.releaseActors(encounter,yieldFaction);
    }
  }

  placeBlocker(challenger,target){
    const dx=target.x-challenger.x,dy=target.y-challenger.y,d=Math.max(1,Math.hypot(dx,dy));
    const desiredX=target.x-dx/d*54,desiredY=target.y-dy/d*54;
    challenger.x+=(desiredX-challenger.x)*0.08;
    challenger.y+=(desiredY-challenger.y)*0.08;
    challenger.groundY=challenger.y+challenger.radius;
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
