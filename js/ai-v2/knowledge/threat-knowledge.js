const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

function stableAngle(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%3600)/3600*Math.PI*2;
}

function cloneThreat(threat){
  return threat?{
    ...threat,
    approximatePosition:{...threat.approximatePosition},
    impactPoint:threat.impactPoint?{...threat.impactPoint}:null,
    track:threat.track?{
      ...threat.track,
      intentHypothesis:threat.track.intentHypothesis?{...threat.track.intentHypothesis}:null
    }:null
  }:null;
}

export class ThreatKnowledgeStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  observeEvent({event,game,now=0}={}){
    if(!event?.id||!event?.targetActorId||!event?.sourcePoint)return null;
    const actor=game?.actors?.find(candidate=>candidate.id===event.targetActorId);
    if(!actor||actor.medical?.dead||actor.medical?.unconscious)return null;
    const confidence=clamp(event.confidence??92,0,100);
    const error=12+(100-confidence)*.34;
    const angle=stableAngle(`${event.id}:${actor.id}`);
    const approximatePosition={
      x:event.sourcePoint.x+Math.cos(angle)*error,
      y:event.sourcePoint.y+Math.sin(angle)*error
    };
    const threat={
      id:`personal_threat_${event.id}_${actor.id}`,
      eventId:event.id,
      observerId:actor.id,
      teamId:actor.teamId,
      subjectId:event.subjectId??`threat_source_${event.id}`,
      classification:"armed_contact",
      identity:"unknown",
      factionId:null,
      confidence,
      level:confidence>=72?"high":confidence>=42?"moderate":"low",
      approximatePosition,
      impactPoint:event.impactPoint?{...event.impactPoint}:null,
      lastObservedAt:now,
      currentlyVisible:false,
      eventKind:event.kind??"incoming_fire",
      immediateUntil:now+Math.max(.8,event.immediateDuration??3.2),
      reacted:false,
      reactedAt:null,
      track:{
        currentActivity:"firing",
        activityLabel:"Firing",
        activityReason:event.kind==="near_miss"
          ?"A round passed close enough to establish an immediate hostile threat direction."
          :"A hostile shot was perceived from the estimated source area.",
        activityRevision:1,
        movementDirection:"unknown",
        estimatedSpeed:0,
        previousApproximatePosition:null,
        intentHypothesis:{
          id:"hostile",
          label:"Hostile action observed",
          confidence:clamp(confidence/100,0,1),
          reason:"The hostile interpretation is grounded in a physical incoming-fire event, not faction identity."
        }
      }
    };
    if(!this.byActor.has(actor.id))this.byActor.set(actor.id,new Map());
    this.byActor.get(actor.id).set(threat.subjectId,threat);
    actor.aiV2PersonalThreat=cloneThreat(threat);
    this.decisionLog?.record?.({
      type:"personal_threat_observed",
      time:now,
      actorId:actor.id,
      teamId:actor.teamId,
      data:{
        eventId:event.id,
        subjectId:threat.subjectId,
        eventKind:threat.eventKind,
        confidence:Math.round(threat.confidence),
        approximatePosition:{...threat.approximatePosition}
      }
    });
    return cloneThreat(threat);
  }

  getThreats(actorId){
    return[...(this.byActor.get(actorId)?.values()??[])]
      .sort((a,b)=>b.lastObservedAt-a.lastObservedAt||b.confidence-a.confidence)
      .map(cloneThreat);
  }

  getBestThreat(actorId){return this.getThreats(actorId)[0]??null;}

  isImmediate(actorId,now=0){
    const threat=this.getBestThreat(actorId);
    return Boolean(threat&&now<=threat.immediateUntil);
  }

  markReacted(actorId,subjectId,{now=0}={}){
    const threat=this.byActor.get(actorId)?.get(subjectId);
    if(!threat)return false;
    threat.reacted=true;
    threat.reactedAt=now;
    this.decisionLog?.record?.({
      type:"personal_threat_reaction_completed",
      time:now,
      actorId,
      teamId:threat.teamId,
      data:{subjectId,eventId:threat.eventId}
    });
    return true;
  }

  update(delta,{now=0}={}){
    for(const [actorId,records] of this.byActor){
      for(const [subjectId,threat] of records){
        const age=Math.max(0,now-threat.lastObservedAt);
        if(age>5)threat.confidence=clamp(threat.confidence-Math.max(0,delta)*2.2,0,100);
        if(threat.confidence<=0)records.delete(subjectId);
      }
      if(!records.size)this.byActor.delete(actorId);
    }
  }

  summary(){
    return[...this.byActor.entries()].map(([actorId,records])=>({
      actorId,
      threats:[...records.values()].map(cloneThreat)
    }));
  }
}
