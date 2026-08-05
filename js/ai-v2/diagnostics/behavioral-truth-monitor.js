const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const round=(value,digits=2)=>Number((Number(value)||0).toFixed(digits));
const INCAPACITATED=new Set(["critical","unconscious","dead"]);
const REACTION_ACTIONS=new Set([
  "TacticalReposition","ReactToIncomingFire","ContactFire","ProtectiveFire","DemonstrativeFire",
  "HoldReady","HoldPosition","WithdrawToRoute","CircumventContact","ApproachCasualty","DragCasualty",
  "EvacuateCasualty","StabilizeCasualty","SelfAid"
]);

function actionTargetsCasualty(action,casualtyId){
  return Boolean(action&&[
    action.directive?.casualtyId,
    action.metadata?.casualtyId,
    action.casualtySnapshot?.subjectId,
    action.subjectId
  ].includes(casualtyId));
}

function actorRecord(actor){
  return{
    actorId:actor.id,teamId:actor.teamId,name:actor.name??actor.id,
    distanceTravelled:0,directionReversals:0,actionSwitches:0,stationarySeconds:0,
    threatenedStationarySeconds:0,overlapSeconds:0,samples:0,
    firstPosition:{x:actor.x,y:actor.y},lastPosition:{x:actor.x,y:actor.y},
    lastVelocity:null,lastActionType:null,lastSampleAt:0,maxDisplacementFromStart:0
  };
}

function cloneActorMetric(record){return{...record,firstPosition:{...record.firstPosition},lastPosition:{...record.lastPosition},lastVelocity:record.lastVelocity?{...record.lastVelocity}:null};}
function pairKey(left,right){return[String(left),String(right)].sort().join("::");}

export class BehavioralTruthMonitor{
  constructor({sampleInterval=.25,closeTeamDistance=280,overlapPadding=4}={}){
    this.sampleInterval=Math.max(.05,Number(sampleInterval)||.25);
    this.closeTeamDistance=Math.max(80,Number(closeTeamDistance)||280);
    this.overlapPadding=Math.max(0,Number(overlapPadding)||4);
    this.accumulator=0;
    this.startedAt=null;
    this.lastSampleAt=0;
    this.actorMetrics=new Map();
    this.teamPairMetrics=new Map();
    this.casualtyMetrics=new Map();
    this.concernTimeline=[];
    this.lastConcernSignature=new Map();
    this.samples=0;
  }

  update(delta,{game=null,scheduler=null,teamConcerns=null,threatKnowledge=null,now=0}={}){
    if(this.startedAt===null)this.startedAt=now-Math.max(0,delta);
    this.accumulator+=Math.max(0,delta);
    if(this.accumulator<this.sampleInterval)return;
    const sampleDelta=this.accumulator;
    this.accumulator=0;
    this.lastSampleAt=now;
    this.samples+=1;
    const actors=(game?.actors??[]).filter(actor=>actor?.id);
    const activeActors=actors.filter(actor=>!actor.medical?.dead);

    for(const actor of actors){
      const metric=this.actorMetrics.get(actor.id)??actorRecord(actor);
      const previous=metric.lastPosition;
      const dx=(actor.x??0)-previous.x;
      const dy=(actor.y??0)-previous.y;
      const moved=Math.hypot(dx,dy);
      const velocity=moved>.25?{x:dx/sampleDelta,y:dy/sampleDelta}:null;
      metric.distanceTravelled+=moved;
      metric.maxDisplacementFromStart=Math.max(metric.maxDisplacementFromStart,distance(actor,metric.firstPosition));
      if(metric.lastVelocity&&velocity){
        const priorMagnitude=Math.hypot(metric.lastVelocity.x,metric.lastVelocity.y);
        const magnitude=Math.hypot(velocity.x,velocity.y);
        const cosine=priorMagnitude&&magnitude?(metric.lastVelocity.x*velocity.x+metric.lastVelocity.y*velocity.y)/(priorMagnitude*magnitude):1;
        if(cosine<-.55&&moved>2)metric.directionReversals+=1;
      }
      if(moved<1)metric.stationarySeconds+=sampleDelta;
      const immediateThreat=threatKnowledge?.isImmediate?.(actor.id,now)??false;
      if(immediateThreat&&moved<1)metric.threatenedStationarySeconds+=sampleDelta;
      const primary=scheduler?.getPrimaryAction?.(actor.id)??null;
      if(metric.lastActionType&&primary?.type!==metric.lastActionType)metric.actionSwitches+=1;
      metric.lastActionType=primary?.type??null;
      metric.lastVelocity=velocity??metric.lastVelocity;
      metric.lastPosition={x:actor.x,y:actor.y};
      metric.lastSampleAt=now;
      metric.samples+=1;
      this.actorMetrics.set(actor.id,metric);
    }

    for(let index=0;index<activeActors.length;index+=1){
      const left=activeActors[index];
      for(let otherIndex=index+1;otherIndex<activeActors.length;otherIndex+=1){
        const right=activeActors[otherIndex];
        const separation=distance(left,right);
        if(left.teamId===right.teamId){
          const overlapDistance=(Number(left.radius)||18)+(Number(right.radius)||18)+this.overlapPadding;
          if(separation<overlapDistance){
            this.actorMetrics.get(left.id).overlapSeconds+=sampleDelta;
            this.actorMetrics.get(right.id).overlapSeconds+=sampleDelta;
          }
          continue;
        }
        const key=pairKey(left.teamId,right.teamId);
        const metric=this.teamPairMetrics.get(key)??{
          pairId:key,teamIds:[left.teamId,right.teamId].sort(),minimumDistance:Infinity,
          closeSeconds:0,unreactedCloseSeconds:0,staticCloseSeconds:0,firstCloseAt:null,
          firstReactionAt:null,lastSampleAt:0,samples:0
        };
        metric.minimumDistance=Math.min(metric.minimumDistance,separation);
        if(separation<=this.closeTeamDistance){
          metric.closeSeconds+=sampleDelta;
          metric.firstCloseAt??=now;
          const leftAction=scheduler?.getPrimaryAction?.(left.id)?.type??null;
          const rightAction=scheduler?.getPrimaryAction?.(right.id)?.type??null;
          const reacted=REACTION_ACTIONS.has(leftAction)||REACTION_ACTIONS.has(rightAction)||Boolean(left.aiV2ThreatReaction||right.aiV2ThreatReaction);
          if(reacted)metric.firstReactionAt??=now;
          else metric.unreactedCloseSeconds+=sampleDelta;
          const leftMoved=Math.hypot(Number(left.vx)||0,Number(left.vy)||0);
          const rightMoved=Math.hypot(Number(right.vx)||0,Number(right.vy)||0);
          if(leftMoved<4&&rightMoved<4)metric.staticCloseSeconds+=sampleDelta;
        }
        metric.lastSampleAt=now;
        metric.samples+=1;
        this.teamPairMetrics.set(key,metric);
      }
    }

    for(const casualty of actors){
      const condition=casualty.medical?.dead?"dead":casualty.medical?.unconscious?"unconscious":casualty.medical?.condition??"healthy";
      if(!INCAPACITATED.has(condition))continue;
      const metric=this.casualtyMetrics.get(casualty.id)??{
        casualtyId:casualty.id,teamId:casualty.teamId,name:casualty.name??casualty.id,
        condition,firstObservedAt:now,lastObservedAt:now,unattendedSeconds:0,
        firstAssistanceAt:null,firstPhysicalAttendanceAt:null,firstTargetedActionAt:null,
        carriedAt:null,evacuatedAt:null,samples:0
      };
      metric.condition=condition;
      metric.lastObservedAt=now;
      const teammates=activeActors.filter(actor=>actor.teamId===casualty.teamId&&actor.id!==casualty.id&&!actor.medical?.unconscious);
      const physicallyAttended=teammates.some(actor=>distance(actor,casualty)<=Math.max(100,Number(actor.interactionRadius)||84));
      const targeted=teammates.some(actor=>(scheduler?.getActions?.(actor.id)??[]).some(action=>actionTargetsCasualty(action,casualty.id)));
      if(physicallyAttended)metric.firstPhysicalAttendanceAt??=now;
      if(targeted)metric.firstTargetedActionAt??=now;
      if(physicallyAttended||targeted)metric.firstAssistanceAt??=now;
      else metric.unattendedSeconds+=sampleDelta;
      if(casualty.aiV2CarrierId||casualty.carriedByActorId)metric.carriedAt??=now;
      if(casualty.aiV2Evacuated)metric.evacuatedAt??=now;
      metric.samples+=1;
      this.casualtyMetrics.set(casualty.id,metric);
    }

    for(const team of teamConcerns?.summary?.()??[]){
      const active=team.concerns.filter(concern=>concern.status==="active");
      const signature=active.map(concern=>`${concern.id}:${Math.round(concern.importance*100)}`).sort().join("|");
      if(this.lastConcernSignature.get(team.teamId)===signature)continue;
      this.lastConcernSignature.set(team.teamId,signature);
      this.concernTimeline.push({
        at:now,teamId:team.teamId,
        concerns:active.map(concern=>({id:concern.id,kind:concern.kind,importance:concern.importance,desiredEffect:concern.desiredEffect}))
      });
      if(this.concernTimeline.length>240)this.concernTimeline.splice(0,this.concernTimeline.length-240);
    }
  }

  report({scenarioId=null,now=this.lastSampleAt}={}){
    const actors=[...this.actorMetrics.values()].map(metric=>({
      ...cloneActorMetric(metric),
      distanceTravelled:round(metric.distanceTravelled),
      stationarySeconds:round(metric.stationarySeconds),
      threatenedStationarySeconds:round(metric.threatenedStationarySeconds),
      overlapSeconds:round(metric.overlapSeconds),
      maxDisplacementFromStart:round(metric.maxDisplacementFromStart)
    }));
    const teamPairs=[...this.teamPairMetrics.values()].map(metric=>({
      ...metric,
      minimumDistance:Number.isFinite(metric.minimumDistance)?round(metric.minimumDistance):null,
      closeSeconds:round(metric.closeSeconds),
      unreactedCloseSeconds:round(metric.unreactedCloseSeconds),
      staticCloseSeconds:round(metric.staticCloseSeconds)
    }));
    const casualties=[...this.casualtyMetrics.values()].map(metric=>({...metric,unattendedSeconds:round(metric.unattendedSeconds)}));
    const duration=Math.max(0,now-(this.startedAt??now));
    return{
      scenarioId,
      duration:round(duration),
      sampleInterval:this.sampleInterval,
      samples:this.samples,
      actors,
      teamPairs,
      casualties,
      concernTimeline:this.concernTimeline.map(entry=>({...entry,concerns:entry.concerns.map(concern=>({...concern}))})),
      signals:{
        pacingActors:actors.filter(actor=>actor.directionReversals>=3).map(actor=>actor.actorId),
        overlappingActors:actors.filter(actor=>actor.overlapSeconds>=1).map(actor=>actor.actorId),
        threatenedStaticActors:actors.filter(actor=>actor.threatenedStationarySeconds>=1).map(actor=>actor.actorId),
        closeUnreactedPairs:teamPairs.filter(pair=>pair.unreactedCloseSeconds>=.5).map(pair=>pair.pairId),
        staticContactPairs:teamPairs.filter(pair=>pair.staticCloseSeconds>=2).map(pair=>pair.pairId),
        unattendedCasualties:casualties.filter(casualty=>casualty.unattendedSeconds>=2).map(casualty=>casualty.casualtyId)
      }
    };
  }

  summary(){return this.report({});}
}
