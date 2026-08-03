const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function cloneCapabilities(capabilities={}){
  return Object.fromEntries(Object.entries(capabilities).map(([key,value])=>[key,clamp(value)]));
}

function cloneRosterMember(member){
  return{
    ...member,
    capabilities:cloneCapabilities(member.capabilities),
    deployedActorId:member.deployedActorId??null,
    operationId:member.operationId??null,
    availableAt:finite(member.availableAt,0)
  };
}

function cloneFaction(faction){
  return{
    ...faction,
    priorities:{...faction.priorities},
    entryPoint:{...faction.entryPoint},
    roster:faction.roster.map(cloneRosterMember)
  };
}

function cloneNeed(need){return need?{...need,capabilityNeeds:{...need.capabilityNeeds}}:null;}
function cloneOperation(operation){
  return operation?{
    ...operation,
    rosterIds:[...(operation.rosterIds??[])],
    actorIds:[...(operation.actorIds??[])],
    assignments:(operation.assignments??[]).map(item=>({...item})),
    objectivePoint:operation.objectivePoint?{...operation.objectivePoint}:null,
    entryPoint:operation.entryPoint?{...operation.entryPoint}:null,
    capabilityNeeds:{...(operation.capabilityNeeds??{})}
  }:null;
}

function normalizedFaction(spec,index){
  return{
    id:spec.id,
    label:spec.label??spec.id,
    priorityOrder:index,
    priorities:{restore_infrastructure:clamp(spec.priorities?.restore_infrastructure??.5)},
    entryPoint:{x:finite(spec.entryPoint?.x,0),y:finite(spec.entryPoint?.y,0),facing:spec.entryPoint?.facing??"down"},
    roster:(spec.roster??[]).map((member,memberIndex)=>({
      id:member.id??`${spec.id}_operator_${memberIndex+1}`,
      name:member.name??`${spec.label??spec.id} Operator ${memberIndex+1}`,
      role:member.role??"Field Operator",
      kitId:member.kitId??null,
      capabilities:cloneCapabilities(member.capabilities),
      status:"available",
      operationId:null,
      deployedActorId:null,
      availableAt:0
    }))
  };
}

function capabilityScore(member,key){return clamp(member?.capabilities?.[key]??0);}

export class LivingSandboxState{
  constructor({config={},decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.dispatchDelay=Math.max(0,finite(config.dispatchDelay,1.2));
    this.minimumDispatchGap=Math.max(0,finite(config.minimumDispatchGap,1.5));
    this.postCompletionHold=Math.max(0,finite(config.postCompletionHold,4));
    this.interruptedReturnHold=Math.max(0,finite(config.interruptedReturnHold,1.2));
    this.blockedRetryDelay=Math.max(1,finite(config.blockedRetryDelay,30));
    this.recoveryDuration=Math.max(0,finite(config.recoveryDuration,24));
    this.teamSize=Math.max(1,Math.round(finite(config.teamSize,3)));
    this.maxActiveOperations=Math.max(1,Math.round(finite(config.maxActiveOperations,1)));
    this.factions=new Map((config.factions??[]).map((spec,index)=>[spec.id,normalizedFaction(spec,index)]));
    this.needs=new Map();
    this.operations=new Map();
    this.history=[];
    this.operationSequence=0;
    this.lastDispatchAt=-Infinity;
  }

  syncObjectives(objectives,{now=0}={}){
    for(const objective of objectives??[]){
      if(!objective?.id||!objective.aiObjective)continue;
      const desiredState=objective.sandboxNeed?.desiredState??"operational";
      const complete=objective.state===desiredState;
      const existing=this.needs.get(objective.id)??null;
      if(complete){
        if(existing&&existing.status==="assigned"){
          existing.status="satisfied";
          existing.satisfiedAt=existing.satisfiedAt??now;
          existing.lastChangedAt=now;
        }else if(existing&&existing.status!=="resolved"){
          existing.status="resolved";
          existing.resolvedAt=now;
          existing.lastChangedAt=now;
          this.#record("world_need_resolved",now,{needId:existing.id,objectiveId:objective.id});
        }
        continue;
      }

      const spec=objective.sandboxNeed??{};
      if(existing){
        existing.objectiveState=objective.state??"unknown";
        existing.urgency=clamp(spec.urgency??existing.urgency??.5);
        existing.lastChangedAt=now;
        if(["resolved","satisfied"].includes(existing.status)&&!existing.operationId){
          existing.status="open";
          existing.resolvedAt=null;
          existing.satisfiedAt=null;
          this.#record("world_need_reopened",now,{needId:existing.id,objectiveId:objective.id});
        }
        continue;
      }

      const need={
        id:spec.id??`need_${objective.id}`,
        kind:spec.kind??"restore_infrastructure",
        label:spec.label??`Restore ${objective.name??objective.label??objective.id}`,
        objectiveId:objective.id,
        objectiveState:objective.state??"unknown",
        desiredState,
        urgency:clamp(spec.urgency??.5),
        capabilityNeeds:{
          technicalWork:clamp(spec.capabilityNeeds?.technicalWork??.72),
          navigation:clamp(spec.capabilityNeeds?.navigation??.45),
          security:clamp(spec.capabilityNeeds?.security??.45)
        },
        status:"open",
        operationId:null,
        attemptCount:0,
        blockedAt:null,
        blockedByOperationId:null,
        retryAfter:null,
        createdAt:now,
        lastChangedAt:now,
        satisfiedAt:null,
        resolvedAt:null
      };
      this.needs.set(objective.id,need);
      this.#record("world_need_created",now,{needId:need.id,objectiveId:objective.id,kind:need.kind,urgency:need.urgency});
    }
  }

  updateRecovery({now=0}={}){
    for(const faction of this.factions.values())for(const member of faction.roster){
      if(member.status!=="recovering"||member.availableAt>now)continue;
      member.status="available";
      member.operationId=null;
      member.deployedActorId=null;
      member.availableAt=0;
      this.#record("roster_member_available",now,{factionId:faction.id,rosterId:member.id});
    }
  }

  proposeDispatch({objectives=[],now=0}={}){
    this.updateBlockedNeeds({now});
    const active=[...this.operations.values()].filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status));
    if(active.length>=this.maxActiveOperations)return null;
    if(now<this.dispatchDelay||now-this.lastDispatchAt<this.minimumDispatchGap)return null;

    const objectiveById=new Map((objectives??[]).map(objective=>[objective.id,objective]));
    const candidates=[];
    for(const need of this.needs.values()){
      if(need.status!=="open")continue;
      const objective=objectiveById.get(need.objectiveId);
      if(!objective||objective.state===need.desiredState)continue;
      for(const faction of this.factions.values()){
        const available=faction.roster.filter(member=>member.status==="available");
        if(available.length<this.teamSize)continue;
        const team=this.#selectTeam(faction);
        if(team.length<this.teamSize)continue;
        const priority=clamp(faction.priorities[need.kind]??0);
        const capabilityFit=this.#teamCapabilityFit(team,need.capabilityNeeds);
        const score=priority*.58+need.urgency*.27+capabilityFit*.15-faction.priorityOrder*.0001;
        candidates.push({need,objective,faction,team,score,capabilityFit});
      }
    }
    candidates.sort((left,right)=>right.score-left.score||right.need.urgency-left.need.urgency||left.faction.priorityOrder-right.faction.priorityOrder||left.need.id.localeCompare(right.need.id));
    const selected=candidates[0];
    if(!selected)return null;

    const operationId=`sandbox_operation_${++this.operationSequence}`;
    const assignments=this.#assignResponsibilities(selected.team);
    const operation={
      id:operationId,
      kind:selected.need.kind,
      label:selected.need.label,
      status:"proposed",
      factionId:selected.faction.id,
      factionLabel:selected.faction.label,
      needId:selected.need.id,
      objectiveId:selected.need.objectiveId,
      objectiveLabel:selected.objective.name??selected.objective.label??selected.need.objectiveId,
      objectivePoint:{x:selected.objective.x,y:selected.objective.y},
      desiredState:selected.need.desiredState,
      urgency:selected.need.urgency,
      capabilityNeeds:{...selected.need.capabilityNeeds},
      capabilityFit:selected.capabilityFit,
      score:selected.score,
      rosterIds:selected.team.map(member=>member.id),
      assignments,
      actorIds:[],
      teamId:null,
      entryPoint:{...selected.faction.entryPoint},
      proposedAt:now,
      deployedAt:null,
      objectiveCompletedAt:null,
      returnReadyAt:null,
      completedAt:null,
      attemptNumber:(selected.need.attemptCount??0)+1,
      result:null,
      interruptedAt:null,
      interruptionReason:null,
      blockingOperationId:null,
      outcomeId:null
    };
    this.operations.set(operationId,operation);
    selected.need.status="assigned";
    selected.need.operationId=operationId;
    selected.need.attemptCount=(selected.need.attemptCount??0)+1;
    selected.need.blockedAt=null;
    selected.need.blockedByOperationId=null;
    selected.need.retryAfter=null;
    selected.need.lastChangedAt=now;
    for(const member of selected.team){
      member.status="assigned";
      member.operationId=operationId;
    }
    this.lastDispatchAt=now;
    this.#record("faction_operation_proposed",now,{operationId,factionId:operation.factionId,needId:operation.needId,objectiveId:operation.objectiveId,score:operation.score});
    return cloneOperation(operation);
  }

  markDeployed({operationId,teamId,actorIds=[],now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="proposed")return false;
    operation.status="deployed";
    operation.teamId=teamId;
    operation.actorIds=[...actorIds];
    operation.deployedAt=now;
    const faction=this.factions.get(operation.factionId);
    for(let index=0;index<operation.rosterIds.length;index+=1){
      const member=faction?.roster.find(candidate=>candidate.id===operation.rosterIds[index]);
      if(!member)continue;
      member.status="deployed";
      member.operationId=operationId;
      member.deployedActorId=actorIds[index]??null;
    }
    this.#record("faction_operation_deployed",now,{operationId,teamId,factionId:operation.factionId,actorIds:[...actorIds]});
    return true;
  }

  beginReturn(operationId,{now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="deployed")return false;
    operation.status="returning";
    operation.objectiveCompletedAt=now;
    operation.returnReadyAt=now+this.postCompletionHold;
    this.#record("faction_operation_returning",now,{operationId,teamId:operation.teamId,objectiveId:operation.objectiveId,returnReadyAt:operation.returnReadyAt});
    return true;
  }

  interruptOperation(operationId,{now=0,reason="mission_interrupted",blockingOperationId=null,outcomeId=null}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="deployed")return false;
    operation.status="interrupted";
    operation.result="deferred";
    operation.interruptedAt=now;
    operation.interruptionReason=reason;
    operation.blockingOperationId=blockingOperationId;
    operation.outcomeId=outcomeId;
    operation.returnReadyAt=now+this.interruptedReturnHold;
    const need=[...this.needs.values()].find(candidate=>candidate.id===operation.needId)??null;
    if(need){
      need.status="blocked";
      need.blockedAt=now;
      need.blockedByOperationId=blockingOperationId;
      need.retryAfter=now+this.blockedRetryDelay;
      need.lastChangedAt=now;
    }
    this.#record("faction_operation_interrupted",now,{operationId,teamId:operation.teamId,factionId:operation.factionId,needId:operation.needId,reason,blockingOperationId,outcomeId,returnReadyAt:operation.returnReadyAt});
    return true;
  }

  updateBlockedNeeds({now=0}={}){
    for(const need of this.needs.values()){
      if(need.status!=="blocked"||need.operationId)continue;
      const blocker=need.blockedByOperationId?this.operations.get(need.blockedByOperationId):null;
      const blockerActive=Boolean(blocker&&["proposed","deployed","returning","interrupted"].includes(blocker.status));
      if(blockerActive&&finite(need.retryAfter,Infinity)>now)continue;
      need.status="open";
      need.blockedAt=null;
      need.blockedByOperationId=null;
      need.retryAfter=null;
      need.lastChangedAt=now;
      this.#record("world_need_retry_opened",now,{needId:need.id,objectiveId:need.objectiveId,attemptCount:need.attemptCount??0});
    }
  }

  readyReturns({now=0}={}){
    return[...this.operations.values()]
      .filter(operation=>["returning","interrupted"].includes(operation.status)&&finite(operation.returnReadyAt,Infinity)<=now)
      .map(cloneOperation);
  }

  completeReturn(operationId,{now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||!["returning","interrupted"].includes(operation.status))return false;
    const interrupted=operation.status==="interrupted";
    operation.status=interrupted?"deferred":"completed";
    operation.result=interrupted?"deferred":"completed";
    operation.completedAt=now;
    const need=[...this.needs.values()].find(candidate=>candidate.id===operation.needId)??null;
    if(need){
      if(interrupted){
        need.status="blocked";
        need.operationId=null;
        need.blockedAt=need.blockedAt??now;
        need.retryAfter=need.retryAfter??now+this.blockedRetryDelay;
      }else{
        need.status="resolved";
        need.operationId=operationId;
        need.resolvedAt=now;
      }
      need.lastChangedAt=now;
    }
    const faction=this.factions.get(operation.factionId);
    for(const rosterId of operation.rosterIds){
      const member=faction?.roster.find(candidate=>candidate.id===rosterId);
      if(!member)continue;
      member.status=this.recoveryDuration>0?"recovering":"available";
      member.operationId=null;
      member.deployedActorId=null;
      member.availableAt=this.recoveryDuration>0?now+this.recoveryDuration:0;
    }
    this.#record(interrupted?"faction_operation_deferred":"faction_operation_completed",now,{operationId,factionId:operation.factionId,needId:operation.needId,objectiveId:operation.objectiveId,blockingOperationId:operation.blockingOperationId,outcomeId:operation.outcomeId});
    return true;
  }

  getOperation(operationId){return cloneOperation(this.operations.get(operationId)??null);}
  getFaction(factionId){const faction=this.factions.get(factionId);return faction?cloneFaction(faction):null;}
  getNeedByObjective(objectiveId){return cloneNeed(this.needs.get(objectiveId)??null);}
  activeOperations(){return[...this.operations.values()].filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status)).map(cloneOperation);}

  summary(){
    return{
      factions:[...this.factions.values()].map(faction=>({
        id:faction.id,
        label:faction.label,
        available:faction.roster.filter(member=>member.status==="available").length,
        assigned:faction.roster.filter(member=>member.status==="assigned").length,
        deployed:faction.roster.filter(member=>member.status==="deployed").length,
        recovering:faction.roster.filter(member=>member.status==="recovering").length,
        roster:faction.roster.map(cloneRosterMember)
      })),
      needs:[...this.needs.values()].map(cloneNeed),
      operations:[...this.operations.values()].map(cloneOperation),
      activeOperationIds:this.activeOperations().map(operation=>operation.id),
      history:this.history.map(entry=>({...entry,data:{...entry.data}}))
    };
  }

  #selectTeam(faction){
    const available=faction.roster.filter(member=>member.status==="available");
    if(available.length<this.teamSize)return[];
    const specialist=[...available].sort((a,b)=>capabilityScore(b,"technicalWork")-capabilityScore(a,"technicalWork")||a.id.localeCompare(b.id))[0];
    const remaining=available.filter(member=>member!==specialist);
    const lead=[...remaining].sort((a,b)=>
      (capabilityScore(b,"navigation")+capabilityScore(b,"scouting")*.5)-(capabilityScore(a,"navigation")+capabilityScore(a,"scouting")*.5)||a.id.localeCompare(b.id)
    )[0];
    const securityPool=remaining.filter(member=>member!==lead);
    const security=[...securityPool].sort((a,b)=>
      (capabilityScore(b,"security")+capabilityScore(b,"observation")*.45)-(capabilityScore(a,"security")+capabilityScore(a,"observation")*.45)||a.id.localeCompare(b.id)
    )[0];
    const selected=[lead,specialist,security].filter(Boolean);
    for(const member of available)if(selected.length<this.teamSize&&!selected.includes(member))selected.push(member);
    return selected.slice(0,this.teamSize);
  }

  #assignResponsibilities(team){
    const [lead,specialist,security]=team;
    return[
      lead?{rosterId:lead.id,responsibility:"approach_lead"}:null,
      specialist?{rosterId:specialist.id,responsibility:"objective_specialist"}:null,
      security?{rosterId:security.id,responsibility:"local_security"}:null
    ].filter(Boolean);
  }

  #teamCapabilityFit(team,needs){
    if(!team.length)return 0;
    const technical=Math.max(...team.map(member=>capabilityScore(member,"technicalWork")),0);
    const navigation=Math.max(...team.map(member=>capabilityScore(member,"navigation")),0);
    const security=Math.max(...team.map(member=>capabilityScore(member,"security")),0);
    const weighted=(technical*(needs.technicalWork??0)+navigation*(needs.navigation??0)+security*(needs.security??0));
    const total=(needs.technicalWork??0)+(needs.navigation??0)+(needs.security??0);
    return total>0?clamp(weighted/total):1;
  }

  #record(type,time,data={}){
    const entry={type,time,data:{...data}};
    this.history.push(entry);
    if(this.history.length>160)this.history.splice(0,this.history.length-160);
    this.decisionLog?.record?.({type,time,teamId:data.teamId??null,data:{...data}});
  }
}
