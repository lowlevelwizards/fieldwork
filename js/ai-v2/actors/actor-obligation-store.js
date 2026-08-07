import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const clonePoint=point=>point?{x:Number(point.x)||0,y:Number(point.y)||0}:null;

function clone(record){
  return record?{
    ...record,
    point:clonePoint(record.point),
    activeActionIds:[...(record.activeActionIds??[])],
    history:(record.history??[]).map(item=>({...item}))
  }:null;
}

function obligationAuthority(concern,assignment){
  if(concern?.kind==="hostile_contact"&&assignment?.required)return ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE;
  if(concern?.kind==="friendly_casualty"&&assignment?.responsibility==="carrier_or_aid_provider")return ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE;
  if(concern?.kind==="mission_progress"||concern?.kind==="safe_return")return ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY;
  return ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN;
}

function obligationPriority(concern,assignment){
  return clamp((Number(concern?.importance)||0)*.62+(Number(concern?.urgency)||0)*.38+(assignment?.required?.12:0),0,1.35);
}

function selfAidSource(game,actor){
  const assessment=game?.wounds?.getAssessment?.(actor)??null;
  const need=game?.wounds?.getTreatmentNeed?.(actor)??null;
  const bleeding=Number(assessment?.bleeding??actor?.medical?.bleedingRate??actor?.medical?.bleeding??0);
  if(!need||bleeding<=.05||Number(actor?.aiV2MedicalSupplies?.[need.type]??0)<=0)return null;
  return{need,bleeding,assessment};
}

export class ActorObligationStore{
  constructor({decisionLog=null,resolvedRetention=18}={}){
    this.decisionLog=decisionLog;
    this.resolvedRetention=Math.max(1,Number(resolvedRetention)||18);
    this.byId=new Map();
    this.byActor=new Map();
  }

  syncSources({game=null,teamConcerns=null,concernStaffing=null,now=0}={}){
    const seen=new Set();
    const nextByActor=new Map();
    const actors=game?.actors??[];

    for(const actor of actors){
      if(!actor?.id||actor.medical?.dead||actor.medical?.unconscious)continue;
      const assignments=concernStaffing?.getActorAssignments?.(actor.id)??[];
      for(const assignment of assignments){
        const concern=teamConcerns?.get?.(actor.teamId,assignment.concernId)??null;
        if(!concern||concern.status!=="active")continue;
        const id=`staffed:${assignment.id}`;
        seen.add(id);
        const previous=this.byId.get(id)??null;
        const record={
          id,actorId:actor.id,teamId:actor.teamId,kind:"staffed_concern",sourceType:"staffing_assignment",
          sourceId:assignment.id,sourceAssignmentId:assignment.id,concernId:concern.id,concernKind:concern.kind,
          subjectId:concern.subjectId??null,missionId:concern.missionId??null,responsibility:assignment.responsibility,
          desiredEffect:concern.desiredEffect,point:clonePoint(concern.point),required:Boolean(assignment.required),
          priority:obligationPriority(concern,assignment),urgency:clamp((Number(concern.urgency)||0)+(assignment.required?.08:0)),
          authorityTier:obligationAuthority(concern,assignment),status:previous?.status==="acting"?"acting":previous?.status==="blocked"?"blocked":"accepted",
          acceptedAt:previous?.acceptedAt??now,lastConfirmedAt:now,lastActionAt:previous?.lastActionAt??null,
          lastProgressAt:previous?.lastProgressAt??previous?.acceptedAt??now,lastInterruptedAt:previous?.lastInterruptedAt??null,
          interruptionCount:previous?.interruptionCount??0,activeActionIds:[...(previous?.activeActionIds??[])],
          history:[...(previous?.history??[])]
        };
        this.#store(record,nextByActor,{now,isNew:!previous});
      }

      const selfAid=selfAidSource(game,actor);
      if(selfAid){
        const id=`self_aid:${actor.id}`;
        seen.add(id);
        const previous=this.byId.get(id)??null;
        const record={
          id,actorId:actor.id,teamId:actor.teamId??null,kind:"self_aid",sourceType:"personal_wound",sourceId:actor.id,
          sourceAssignmentId:null,concernId:null,concernKind:null,subjectId:actor.id,missionId:actor.squadMission??null,
          responsibility:"self_aid",desiredEffect:`treat_${selfAid.need.type}`,point:{x:actor.x,y:actor.y},required:true,
          treatmentType:selfAid.need.type,bleeding:selfAid.bleeding,priority:1.35,urgency:clamp(.72+selfAid.bleeding*.18),
          authorityTier:ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL,status:previous?.status==="acting"?"acting":previous?.status==="blocked"?"blocked":"accepted",
          acceptedAt:previous?.acceptedAt??now,lastConfirmedAt:now,lastActionAt:previous?.lastActionAt??null,
          lastProgressAt:previous?.lastProgressAt??previous?.acceptedAt??now,lastInterruptedAt:previous?.lastInterruptedAt??null,
          interruptionCount:previous?.interruptionCount??0,activeActionIds:[...(previous?.activeActionIds??[])],
          history:[...(previous?.history??[])]
        };
        this.#store(record,nextByActor,{now,isNew:!previous});
      }
    }

    for(const [id,record] of [...this.byId]){
      if(seen.has(id))continue;
      if(["resolved","abandoned"].includes(record.status)){
        if(now-(record.resolvedAt??record.abandonedAt??now)>=this.resolvedRetention)this.byId.delete(id);
        continue;
      }
      const actor=actors.find(candidate=>candidate.id===record.actorId)??null;
      const unavailable=!actor||actor.medical?.dead||actor.medical?.unconscious;
      const status=unavailable?"abandoned":"resolved";
      const next={...record,status,activeActionIds:[],lastConfirmedAt:now,[status==="abandoned"?"abandonedAt":"resolvedAt"]:now,history:this.#history(record,{at:now,event:status,reason:unavailable?"actor_unavailable":"source_resolved_or_reassigned"})};
      this.byId.set(id,next);
      this.#record(`actor_obligation_${status}`,next,now,{reason:unavailable?"actor_unavailable":"source_resolved_or_reassigned"});
    }

    this.byActor=nextByActor;
    for(const actor of actors)actor.aiV2Obligations=this.getActorObligations(actor.id);
  }

  reconcileExecution({game=null,scheduler=null,now=0}={}){
    const nextByActor=new Map();
    for(const [id,record] of [...this.byId]){
      if(["resolved","abandoned"].includes(record.status))continue;
      const actor=game?.actors?.find?.(candidate=>candidate.id===record.actorId)??null;
      if(!actor||actor.medical?.dead||actor.medical?.unconscious)continue;
      const activeActions=(scheduler?.getActions?.(record.actorId)??[]).filter(action=>{
        const plan=action.metadata?.actorBrainPlan??{};
        const implicitSelfAid=record.kind==="self_aid"&&action.type==="SelfAid";
        const implicitConcern=Boolean(record.concernId&&!plan.obligationId&&plan.concernId===record.concernId);
        const matches=plan.obligationId===id||implicitSelfAid||implicitConcern;
        if(matches&&plan.obligationId!==id)action.metadata={...(action.metadata??{}),actorBrainPlan:{...plan,obligationId:id}};
        return matches;
      });
      let next=record;
      if(activeActions.length){
        const actionIds=activeActions.map(action=>action.id);
        const resumed=record.status!=="acting"||actionIds.some(actionId=>!(record.activeActionIds??[]).includes(actionId));
        next={...record,status:"acting",activeActionIds:actionIds,lastActionAt:now,lastProgressAt:now,lastConfirmedAt:now};
        if(resumed)this.#record("actor_obligation_acting",next,now,{actionTypes:activeActions.map(action=>action.type)});
      }else if(record.status==="acting"){
        next={...record,status:"accepted",activeActionIds:[],lastInterruptedAt:now,interruptionCount:(record.interruptionCount??0)+1,lastConfirmedAt:now,history:this.#history(record,{at:now,event:"action_gap",reason:"obligation_source_still_active"})};
        this.#record("actor_obligation_action_gap",next,now,{interruptionCount:next.interruptionCount});
      }else{
        next={...record,activeActionIds:[],lastConfirmedAt:now};
      }
      this.byId.set(id,next);
      if(!nextByActor.has(next.actorId))nextByActor.set(next.actorId,[]);
      nextByActor.get(next.actorId).push(next);
    }
    for(const records of nextByActor.values())records.sort((a,b)=>b.authorityTier-a.authorityTier||b.priority-a.priority||a.acceptedAt-b.acceptedAt);
    this.byActor=nextByActor;
    for(const actor of game?.actors??[])actor.aiV2Obligations=this.getActorObligations(actor.id);
  }

  markBlocked(id,{now=0,reason="temporarily_blocked"}={}){
    const record=this.byId.get(id);if(!record||["resolved","abandoned"].includes(record.status))return false;
    const changed=record.status!=="blocked";
    const next={...record,status:"blocked",blockedReason:reason,blockedAt:changed?now:record.blockedAt??now,lastConfirmedAt:now,activeActionIds:[]};
    this.byId.set(id,next);if(changed)this.#record("actor_obligation_blocked",next,now,{reason});return true;
  }

  get(actorId,id){const record=this.byId.get(id);return record?.actorId===actorId?clone(record):null;}
  getById(id){return clone(this.byId.get(id)??null);}
  getActorObligations(actorId,{activeOnly=true}={}){return(this.byActor.get(actorId)??[]).filter(item=>!activeOnly||!["resolved","abandoned"].includes(item.status)).map(clone);}
  getPrimaryForActor(actorId){return clone((this.byActor.get(actorId)??[])[0]??null);}
  findForActor(actorId,{kind=null,concernKind=null,responsibility=null,sourceAssignmentId=null,concernId=null}={}){
    const concerns=Array.isArray(concernKind)?new Set(concernKind):null;
    return clone((this.byActor.get(actorId)??[]).find(item=>(!kind||item.kind===kind)&&(!concernKind||(concerns?concerns.has(item.concernKind):item.concernKind===concernKind))&&(!responsibility||item.responsibility===responsibility)&&(!sourceAssignmentId||item.sourceAssignmentId===sourceAssignmentId)&&(!concernId||item.concernId===concernId))??null);
  }
  summary(){return[...this.byId.values()].map(clone);}

  #store(record,nextByActor,{now,isNew}){
    if(isNew){record.history=this.#history(record,{at:now,event:"accepted",sourceType:record.sourceType});this.#record("actor_obligation_accepted",record,now,{sourceType:record.sourceType});}
    this.byId.set(record.id,record);
    if(!nextByActor.has(record.actorId))nextByActor.set(record.actorId,[]);
    nextByActor.get(record.actorId).push(record);
    nextByActor.get(record.actorId).sort((a,b)=>b.authorityTier-a.authorityTier||b.priority-a.priority||a.acceptedAt-b.acceptedAt);
  }

  #history(record,event){return[...(record.history??[]),event].slice(-16);}
  #record(type,record,time,data={}){this.decisionLog?.record?.({type,time,actorId:record.actorId,teamId:record.teamId??null,data:{obligationId:record.id,kind:record.kind,concernId:record.concernId??null,responsibility:record.responsibility,desiredEffect:record.desiredEffect,...data}});}
}
