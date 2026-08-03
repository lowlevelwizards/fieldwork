import { evaluateVisualObservation } from "./visual-observation.js";

function conscious(actor){
  return Boolean(actor?.id&&!actor.medical?.dead&&!actor.medical?.unconscious);
}

function cloneVisibleMap(source){
  return new Map([...source].map(([actorId,subjectIds])=>[actorId,new Set(subjectIds)]));
}

export class AmbientPerceptionRuntime{
  constructor({decisionLog=null,scanInterval=.28}={}){
    this.decisionLog=decisionLog;
    this.scanInterval=Math.max(.08,Number(scanInterval)||.28);
    this.accumulator=0;
    this.lastVisibleByObserver=new Map();
  }

  update(delta,{game,missions,personalKnowledge,visibleByObserver,now=0}={}){
    for(const [actorId,subjectIds] of this.lastVisibleByObserver){
      if(!game?.actors?.some(actor=>actor.id===actorId))continue;
      visibleByObserver.set(actorId,new Set(subjectIds));
    }

    this.accumulator+=Math.max(0,delta);
    if(this.accumulator<this.scanInterval)return;
    const sampleDelta=this.accumulator;
    this.accumulator%=this.scanInterval;

    const nextVisible=new Map();
    const activeActors=(game?.actors??[]).filter(actor=>conscious(actor)&&missions?.has?.(actor.teamId));
    for(const observer of activeActors){
      const mission=missions.get(observer.teamId);
      const policy=mission?.contactPolicy;
      if(policy?.passiveVision===false)continue;
      const visibleIds=new Set();
      const candidates=activeActors.filter(target=>
        target.id!==observer.id&&
        target.teamId!==observer.teamId&&
        target.factionId&&observer.factionId&&
        target.factionId!==observer.factionId
      );
      for(const target of candidates){
        const observationCapability=Math.max(0,Math.min(1,Number(observer.aiV2Capabilities?.observation)||.5));
        const maximumRange=(policy?.maximumRange??780)*(.88+observationCapability*.2);
        const fieldOfViewDegrees=(policy?.fieldOfViewDegrees??112)+observationCapability*10;
        const evidence=evaluateVisualObservation(game,observer,target,{maximumRange,fieldOfViewDegrees});
        if(!evidence.visible)continue;
        visibleIds.add(target.id);
        const contact=personalKnowledge?.observe?.({observer,target,evidence,now,delta:sampleDelta});
        if(contact?.observationCount===1){
          this.decisionLog?.record?.({
            type:"ambient_contact_observed",
            time:now,
            actorId:observer.id,
            teamId:observer.teamId,
            data:{subjectId:target.id,distance:Math.round(evidence.distance),confidence:Math.round(contact.confidence),evidenceType:"ambient_visual"}
          });
        }
      }
      nextVisible.set(observer.id,visibleIds);
      visibleByObserver.set(observer.id,new Set(visibleIds));
    }
    this.lastVisibleByObserver=cloneVisibleMap(nextVisible);
  }

  summary(){
    return[...this.lastVisibleByObserver].map(([observerId,subjectIds])=>({observerId,subjectIds:[...subjectIds]}));
  }
}
