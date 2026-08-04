const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function cloneObjective(entity){
  return entity?{
    id:entity.id,
    kind:entity.objectiveKind??entity.propType??"objective",
    label:entity.name??entity.label??"Objective",
    x:entity.x,
    y:entity.y,
    interactionRadius:entity.interactionRadius??78,
    securityRadius:entity.securityRadius??280,
    state:entity.state??"offline",
    progress:clamp(entity.progress??0),
    requirements:{...(entity.objectiveRequirements??{})},
    completedByTeamId:entity.completedByTeamId??null,
    lastChangedAt:entity.lastChangedAt??0
  }:null;
}

export class ObjectiveStateStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.entities=new Map();
    this.claims=new Map();
  }

  syncFromGame(game){
    const live=new Set();
    for(const entity of game?.entities??[]){
      if(!entity?.aiObjective)continue;
      live.add(entity.id);
      this.entities.set(entity.id,entity);
    }
    for(const id of [...this.entities.keys()])if(!live.has(id))this.entities.delete(id);
    for(const [objectiveId] of [...this.claims])if(!live.has(objectiveId))this.claims.delete(objectiveId);
  }

  get(objectiveId){return cloneObjective(this.entities.get(objectiveId)??null);}
  getEntity(objectiveId){return this.entities.get(objectiveId)??null;}
  isComplete(objectiveId,desiredState="operational"){
    return this.entities.get(objectiveId)?.state===desiredState;
  }

  claimWork({objectiveId,actorId,teamId=null,purpose="objective_work",now=0}={}){
    const objective=this.entities.get(objectiveId);
    if(!objective||!actorId)return{ok:false,reason:"objective_or_actor_missing"};
    const existing=this.claims.get(objectiveId);
    if(existing&&existing.actorId!==actorId)return{ok:false,reason:"objective_already_claimed",claim:{...existing}};
    const claim={objectiveId,actorId,teamId,purpose,claimedAt:existing?.claimedAt??now,renewedAt:now};
    this.claims.set(objectiveId,claim);
    if(!existing)this.#record("objective_work_claimed",now,claim);
    return{ok:true,claim:{...claim}};
  }

  renewWork(objectiveId,actorId,{now=0}={}){
    const claim=this.claims.get(objectiveId);
    if(!claim||claim.actorId!==actorId)return false;
    claim.renewedAt=now;
    return true;
  }

  releaseWork(objectiveId,actorId,{now=0,reason="released"}={}){
    const claim=this.claims.get(objectiveId);
    if(!claim||claim.actorId!==actorId)return false;
    this.claims.delete(objectiveId);
    this.#record("objective_work_released",now,{...claim,reason});
    return true;
  }

  inspect({objectiveId,actorId,now=0}={}){
    const objective=this.entities.get(objectiveId);
    const claim=this.claims.get(objectiveId);
    if(!objective||claim?.actorId!==actorId)return{ok:false,reason:"objective_inspection_not_owned"};
    const desiredState=objective.objectiveRequirements?.desiredState??"operational";
    if(objective.state===desiredState)return{ok:true,completed:true,objective:cloneObjective(objective)};
    objective.state=objective.objectiveRequirements?.inspectionState??"repairable";
    objective.progress=Math.max(0,objective.progress??0);
    objective.lastChangedAt=now;
    this.#record("objective_inspected",now,{objectiveId,actorId,state:objective.state});
    return{ok:true,completed:true,objective:cloneObjective(objective)};
  }

  advanceWork({objectiveId,actorId,teamId=null,delta=0,now=0}={}){
    const objective=this.entities.get(objectiveId);
    const claim=this.claims.get(objectiveId);
    if(!objective||claim?.actorId!==actorId)return{ok:false,reason:"objective_work_not_owned"};
    const requirements=objective.objectiveRequirements??{};
    const desiredState=requirements.desiredState??"operational";
    const inspectionState=requirements.inspectionState??"repairable";
    const workingState=requirements.workingState??"being_restored";
    if(objective.state===desiredState)return{ok:true,completed:true,objective:cloneObjective(objective)};
    if(![inspectionState,workingState].includes(objective.state))return{ok:false,reason:"objective_not_ready_for_work"};
    const duration=Math.max(.25,Number(requirements.workDuration)||4);
    objective.state=workingState;
    objective.progress=clamp((objective.progress??0)+Math.max(0,delta)/duration);
    objective.lastChangedAt=now;
    if(objective.progress>=1){
      objective.progress=1;
      objective.state=desiredState;
      objective.completedByTeamId=teamId;
      this.#record("objective_completed",now,{objectiveId,actorId,teamId,state:objective.state});
      return{ok:true,completed:true,objective:cloneObjective(objective)};
    }
    return{ok:true,completed:false,objective:cloneObjective(objective)};
  }

  claimSummary(){return[...this.claims.values()].map(claim=>({...claim}));}
  summary(){return[...this.entities.values()].map(cloneObjective);}

  #record(type,time,data){this.decisionLog?.record?.({type,time,actorId:data.actorId??null,teamId:data.teamId??null,data:{...data}});}
}
