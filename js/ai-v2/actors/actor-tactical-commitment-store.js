function clonePoint(point){return point?{x:point.x,y:point.y}:null;}
function clone(record){return record?{...record,anchorPoint:clonePoint(record.anchorPoint),threatPoint:clonePoint(record.threatPoint),subject:{...(record.subject??{})},provenance:{...(record.provenance??{})}}:null;}

export class ActorTacticalCommitmentStore{
  constructor({decisionLog=null}={}){this.decisionLog=decisionLog;this.byActor=new Map();}
  get(actorId){return clone(this.byActor.get(actorId));}
  isValid(actorId,{now=0,responsibilityId=null,threatTrackId=null}={}){
    const item=this.byActor.get(actorId);if(!item)return false;
    if(item.maximumUntil!=null&&now>=item.maximumUntil)return false;
    if(responsibilityId&&item.responsibilityId&&item.responsibilityId!==responsibilityId)return false;
    if(threatTrackId&&item.threatTrackId&&item.threatTrackId!==threatTrackId)return false;
    return item.status!=="released"&&item.status!=="completed";
  }
  commit(input,{now=0}={}){
    const previous=this.byActor.get(input.actorId)??null;
    const key=input.key??[input.kind,input.responsibilityId??"none",input.threatTrackId??"none"].join(":");
    if(previous?.key===key){
      // Reaffirming the same tactical choice confirms it; it must not move its
      // anchor or slide its lifetime forward every frame. Stable local plans
      // are what make movement causal instead of a chain of moving goalposts.
      const next={...previous,...input,key,status:"active",reaffirmedAt:now,
        anchorPoint:clonePoint(previous.anchorPoint??input.anchorPoint),
        threatPoint:clonePoint(input.threatPoint??previous.threatPoint),
        minimumUntil:previous.minimumUntil??input.minimumUntil??now,
        maximumUntil:previous.maximumUntil??input.maximumUntil??now+12};
      this.byActor.set(input.actorId,next);return clone(next);
    }
    const record={actorId:input.actorId,key,kind:input.kind,responsibilityId:input.responsibilityId??null,procedureId:input.procedureId??null,roleId:input.roleId??null,threatTrackId:input.threatTrackId??null,subject:input.subject??{},anchorPoint:clonePoint(input.anchorPoint),threatPoint:clonePoint(input.threatPoint),desiredEffect:input.desiredEffect??null,selectedAt:now,reaffirmedAt:now,minimumUntil:input.minimumUntil??now,maximumUntil:input.maximumUntil??now+12,status:"active",reason:input.reason??null,provenance:input.provenance??{}};
    this.byActor.set(input.actorId,record);
    this.decisionLog?.record?.({type:"actor_tactical_commitment_selected",time:now,actorId:input.actorId,data:{kind:record.kind,key:record.key,responsibilityId:record.responsibilityId,procedureId:record.procedureId,roleId:record.roleId,desiredEffect:record.desiredEffect}});
    return clone(record);
  }
  release(actorId,{now=0,reason="commitment_invalidated"}={}){
    const item=this.byActor.get(actorId);if(!item)return null;
    this.byActor.delete(actorId);this.decisionLog?.record?.({type:"actor_tactical_commitment_released",time:now,actorId,data:{kind:item.kind,key:item.key,reason}});return clone({...item,status:"released",releasedAt:now,releaseReason:reason});
  }
  prune(liveActorIds,{now=0}={}){const live=new Set(liveActorIds);for(const [actorId,item] of this.byActor){if(!live.has(actorId)||item.maximumUntil!=null&&now>=item.maximumUntil)this.release(actorId,{now,reason:live.has(actorId)?"maximum_duration_elapsed":"actor_unavailable"});}}
  summary(){return[...this.byActor.values()].map(clone);}
}
