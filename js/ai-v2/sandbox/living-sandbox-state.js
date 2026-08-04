const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function stableUnit(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%10000)/10000;
}

function cloneCapabilities(capabilities={}){
  return Object.fromEntries(Object.entries(capabilities).map(([key,value])=>[key,clamp(value)]));
}

function cloneRosterMember(member){
  return{
    ...member,
    capabilities:cloneCapabilities(member.capabilities),
    wounds:(member.wounds??[]).map(wound=>({...wound})),
    equipment:[...(member.equipment??[])],
    unlockedAbilities:[...(member.unlockedAbilities??[])],
    traits:[...(member.traits??[])],
    deployedActorId:member.deployedActorId??null,
    operationId:member.operationId??null,
    availableAt:member.availableAt===Infinity?Infinity:finite(member.availableAt,0)
  };
}

function cloneFaction(faction){
  return{
    ...faction,
    priorities:{...faction.priorities},
    interests:{...faction.interests},
    resources:{...faction.resources},
    entryPoint:{...faction.entryPoint},
    roster:faction.roster.map(cloneRosterMember)
  };
}

function cloneNeed(need){
  return need?{
    ...need,
    capabilityNeeds:{...need.capabilityNeeds},
    scoreBreakdown:need.scoreBreakdown?{...need.scoreBreakdown}:null
  }:null;
}

function cloneOperation(operation){
  return operation?{
    ...operation,
    rosterIds:[...(operation.rosterIds??[])],
    actorIds:[...(operation.actorIds??[])],
    assignments:(operation.assignments??[]).map(item=>({...item})),
    objectivePoint:operation.objectivePoint?{...operation.objectivePoint}:null,
    entryPoint:operation.entryPoint?{...operation.entryPoint}:null,
    capabilityNeeds:{...(operation.capabilityNeeds??{})},
    scoreBreakdown:{...(operation.scoreBreakdown??{})},
    rosterOutcome:(operation.rosterOutcome??[]).map(item=>({...item,wounds:(item.wounds??[]).map(wound=>({...wound}))}))
  }:null;
}

function normalizedFaction(spec,index){
  return{
    id:spec.id,
    label:spec.label??spec.id,
    priorityOrder:index,
    priorities:Object.fromEntries(Object.entries(spec.priorities??{restore_infrastructure:.5}).map(([key,value])=>[key,clamp(value)])),
    interests:Object.fromEntries(Object.entries(spec.interests??{}).map(([key,value])=>[key,clamp(value)])),
    contactResolve:clamp(spec.contactResolve??.5),
    entryPoint:{x:finite(spec.entryPoint?.x,0),y:finite(spec.entryPoint?.y,0),facing:spec.entryPoint?.facing??"down"},
    score:finite(spec.score,0),
    resources:{medical:0,technical:0,food:0,fuel:0,...(spec.resources??{})},
    roster:(spec.roster??[]).map((member,memberIndex)=>({
      id:member.id??`${spec.id}_operator_${memberIndex+1}`,
      name:member.name??`${spec.label??spec.id} Operator ${memberIndex+1}`,
      role:member.role??"Field Operator",
      kitId:member.kitId??null,
      capabilities:cloneCapabilities(member.capabilities),
      status:member.status??"available",
      dutyStatus:member.dutyStatus??"available",
      healthStatus:member.healthStatus??"healthy",
      wounds:(member.wounds??[]).map(wound=>({...wound})),
      fatigue:clamp(member.fatigue??0),
      experience:Math.max(0,finite(member.experience,0)),
      level:Math.max(1,Math.round(finite(member.level,1))),
      operationCount:Math.max(0,Math.round(finite(member.operationCount,0))),
      successfulReturns:Math.max(0,Math.round(finite(member.successfulReturns,0))),
      equipment:[...(member.equipment??[])],
      unlockedAbilities:[...(member.unlockedAbilities??[])],
      traits:[...(member.traits??[])],
      operationId:null,
      deployedActorId:null,
      availableAt:0,
      deathAt:null
    }))
  };
}

function capabilityScore(member,key){return clamp(member?.capabilities?.[key]??0);}
function roleCapabilitiesForNeed(need){
  if(need.kind==="recover_supplies")return{specialist:"carrying",lead:"navigation",support:"security"};
  if(need.kind==="survey_route")return{specialist:"observation",lead:"scouting",support:"security"};
  return{specialist:"technicalWork",lead:"navigation",support:"security"};
}

export class LivingSandboxState{
  constructor({config={},decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.liveMode=Boolean(config.liveMode);
    this.seed=Math.round(finite(config.seed,2101));
    this.dispatchDelay=Math.max(0,finite(config.dispatchDelay,1.2));
    this.minimumDispatchGap=Math.max(0,finite(config.minimumDispatchGap,1.5));
    this.postCompletionHold=Math.max(0,finite(config.postCompletionHold,4));
    this.interruptedReturnHold=Math.max(0,finite(config.interruptedReturnHold,1.2));
    this.blockedRetryDelay=Math.max(1,finite(config.blockedRetryDelay,30));
    this.recoveryDuration=Math.max(0,finite(config.recoveryDuration,24));
    this.woundedRecoveryMultiplier=Math.max(1,finite(config.woundedRecoveryMultiplier,3));
    this.teamSize=Math.max(1,Math.round(finite(config.teamSize,3)));
    this.maxActiveOperations=Math.max(1,Math.round(finite(config.maxActiveOperations,1)));
    this.turnover={...(config.turnover??{})};
    this.factions=new Map((config.factions??[]).map((spec,index)=>[spec.id,normalizedFaction(spec,index)]));
    this.needs=new Map();
    this.operations=new Map();
    this.history=[];
    this.operationSequence=0;
    this.lastDispatchAt=-Infinity;
    this.lastCandidateScores=[];
  }

  syncObjectives(objectives,{now=0}={}){
    for(const objective of objectives??[]){
      if(!objective?.id||!objective.aiObjective)continue;
      const desiredState=objective.sandboxNeed?.desiredState??objective.objectiveRequirements?.desiredState??"operational";
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
        if(["resolved","satisfied"].includes(existing.status)){
          const priorOperation=existing.operationId?this.operations.get(existing.operationId):null;
          const priorStillActive=Boolean(priorOperation&&["proposed","deployed","returning","interrupted"].includes(priorOperation.status));
          if(!priorStillActive){
            existing.previousOperationId=existing.operationId??existing.previousOperationId??null;
            existing.status="open";
            existing.operationId=null;
            existing.resolvedAt=null;
            existing.satisfiedAt=null;
            this.#record("world_need_reopened",now,{needId:existing.id,objectiveId:objective.id,previousOperationId:existing.previousOperationId});
          }
        }
        continue;
      }

      const need={
        id:spec.id??`need_${objective.id}`,
        kind:spec.kind??"restore_infrastructure",
        family:spec.family??"infrastructure",
        interestKey:spec.interestKey??spec.family??"infrastructure",
        label:spec.label??`Restore ${objective.name??objective.label??objective.id}`,
        objectiveId:objective.id,
        objectiveState:objective.state??"unknown",
        desiredState,
        urgency:clamp(spec.urgency??.5),
        strategicValue:clamp(spec.strategicValue??.65),
        scoreValue:Math.max(1,Math.round(finite(spec.scoreValue,50))),
        resourceType:spec.resourceType??null,
        resourceAmount:Math.max(0,finite(spec.resourceAmount,0)),
        capabilityNeeds:Object.fromEntries(Object.entries(spec.capabilityNeeds??{
          technicalWork:.72,navigation:.45,security:.45
        }).map(([key,value])=>[key,clamp(value)])),
        status:"open",
        operationId:null,
        attemptCount:0,
        blockedAt:null,
        blockedByOperationId:null,
        retryAfter:null,
        createdAt:now,
        lastChangedAt:now,
        satisfiedAt:null,
        resolvedAt:null,
        scoreBreakdown:null
      };
      this.needs.set(objective.id,need);
      this.#record("world_need_created",now,{needId:need.id,objectiveId:objective.id,kind:need.kind,urgency:need.urgency});
    }
  }

  updateRecovery({now=0}={}){
    for(const faction of this.factions.values())for(const member of faction.roster){
      if(member.status!=="recovering"||member.availableAt>now)continue;
      member.status="available";
      member.dutyStatus="available";
      member.operationId=null;
      member.deployedActorId=null;
      member.availableAt=0;
      member.fatigue=Math.max(0,(member.fatigue??0)-.55);
      if(member.healthStatus!=="dead")member.healthStatus="healthy";
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
        const available=faction.roster.filter(member=>member.status==="available"&&member.healthStatus!=="dead");
        if(available.length<this.teamSize)continue;
        const team=this.#selectTeam(faction,need);
        if(team.length<this.teamSize)continue;
        const priority=clamp(faction.priorities[need.kind]??0);
        const capabilityFit=this.#teamCapabilityFit(team,need.capabilityNeeds);
        let score;
        let scoreBreakdown;
        if(!this.liveMode){
          score=priority*.58+need.urgency*.27+capabilityFit*.15-faction.priorityOrder*.0001;
          scoreBreakdown={priority:priority*.58,urgency:need.urgency*.27,capabilityFit:capabilityFit*.15,total:score};
        }else{
          const interest=clamp(faction.interests[need.interestKey]??.5);
          const travelDistance=distance(faction.entryPoint,objective);
          const worldDiagonal=Math.hypot(7600,4200);
          const travelCost=clamp(travelDistance/worldDiagonal);
          const scarcity=clamp(1-(available.length-this.teamSize)/Math.max(1,faction.roster.length-this.teamSize));
          const retryPressure=clamp((need.attemptCount??0)*.08,0,.24);
          const continuity=objective.progress>0?clamp(objective.progress)*.1:0;
          const variation=(stableUnit(`${this.seed}:${this.operationSequence+1}:${faction.id}:${need.id}`)-.5)*.05;
          const terms={
            priority:priority*.22,
            interest:interest*.2,
            urgency:need.urgency*.18,
            strategicValue:need.strategicValue*.14,
            capabilityFit:capabilityFit*.16,
            continuity,
            travelCost:-travelCost*.11,
            rosterScarcity:-scarcity*.08,
            retryPressure:-retryPressure,
            variation
          };
          score=Object.values(terms).reduce((sum,value)=>sum+value,0);
          scoreBreakdown={...terms,total:score,travelDistance:Math.round(travelDistance),availableRoster:available.length};
        }
        candidates.push({need,objective,faction,team,score,scoreBreakdown,capabilityFit});
      }
    }
    candidates.sort((left,right)=>right.score-left.score||right.need.urgency-left.need.urgency||left.faction.priorityOrder-right.faction.priorityOrder||left.need.id.localeCompare(right.need.id));
    this.lastCandidateScores=candidates.slice(0,18).map(candidate=>({
      factionId:candidate.faction.id,factionLabel:candidate.faction.label,needId:candidate.need.id,objectiveId:candidate.need.objectiveId,
      objectiveLabel:candidate.objective.name??candidate.need.objectiveId,kind:candidate.need.kind,score:candidate.score,scoreBreakdown:{...candidate.scoreBreakdown},
      rosterIds:candidate.team.map(member=>member.id)
    }));
    const selected=candidates[0];
    if(!selected)return null;

    const operationId=`sandbox_operation_${++this.operationSequence}`;
    const assignments=this.#assignResponsibilities(selected.team,selected.need);
    const operation={
      id:operationId,
      kind:selected.need.kind,
      templateId:selected.need.kind,
      family:selected.need.family,
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
      strategicValue:selected.need.strategicValue,
      scoreValue:selected.need.scoreValue,
      resourceType:selected.need.resourceType,
      resourceAmount:selected.need.resourceAmount,
      capabilityNeeds:{...selected.need.capabilityNeeds},
      capabilityFit:selected.capabilityFit,
      score:selected.score,
      scoreBreakdown:{...selected.scoreBreakdown},
      contactResolve:selected.faction.contactResolve,
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
      violent:false,
      interruptedAt:null,
      interruptionReason:null,
      blockingOperationId:null,
      outcomeId:null,
      rosterOutcome:[]
    };
    this.operations.set(operationId,operation);
    selected.need.status="assigned";
    selected.need.operationId=operationId;
    selected.need.attemptCount=(selected.need.attemptCount??0)+1;
    selected.need.blockedAt=null;
    selected.need.blockedByOperationId=null;
    selected.need.retryAfter=null;
    selected.need.lastChangedAt=now;
    selected.need.scoreBreakdown={...selected.scoreBreakdown};
    for(const member of selected.team){
      member.status="assigned";
      member.dutyStatus="assigned";
      member.operationId=operationId;
    }
    this.lastDispatchAt=now;
    this.#record("faction_operation_proposed",now,{operationId,factionId:operation.factionId,needId:operation.needId,objectiveId:operation.objectiveId,score:operation.score,scoreBreakdown:{...operation.scoreBreakdown}});
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
      member.dutyStatus="deployed";
      member.operationId=operationId;
      member.deployedActorId=actorIds[index]??null;
      member.operationCount=(member.operationCount??0)+1;
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

  interruptOperation(operationId,{now=0,reason="mission_interrupted",blockingOperationId=null,outcomeId=null,result="deferred",violent=false}={}){
    const operation=this.operations.get(operationId);
    if(!operation||operation.status!=="deployed")return false;
    operation.status="interrupted";
    operation.result=result;
    operation.violent=Boolean(violent);
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
    this.#record("faction_operation_interrupted",now,{operationId,teamId:operation.teamId,factionId:operation.factionId,needId:operation.needId,reason,result:operation.result,violent:operation.violent,blockingOperationId,outcomeId,returnReadyAt:operation.returnReadyAt});
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

  reconcileReturn(operationId,{actors=[],now=0}={}){
    const operation=this.operations.get(operationId);
    const faction=operation?this.factions.get(operation.factionId):null;
    if(!operation||!faction)return false;
    const actorsById=new Map(actors.map(actor=>[actor.id,actor]));
    operation.rosterOutcome=[];
    for(let index=0;index<operation.rosterIds.length;index+=1){
      const rosterId=operation.rosterIds[index];
      const member=faction.roster.find(candidate=>candidate.id===rosterId);
      const actor=actorsById.get(operation.actorIds[index])??actors.find(candidate=>candidate.rosterId===rosterId)??null;
      if(!member)continue;
      const medical=actor?.medical??{};
      const dead=Boolean(medical.dead);
      const wounded=!dead&&Boolean((medical.wounds??[]).length||medical.condition&&medical.condition!=="healthy");
      member.wounds=(medical.wounds??[]).map(wound=>({...wound}));
      member.healthStatus=dead?"dead":wounded?"wounded":"healthy";
      member.experience=(member.experience??0)+(operation.status==="returning"?18:10)+(operation.violent?5:0);
      member.level=Math.max(1,1+Math.floor(member.experience/100));
      member.fatigue=clamp((member.fatigue??0)+(operation.status==="returning"?.32:.24)+(operation.violent?.12:0));
      if(operation.status==="returning")member.successfulReturns=(member.successfulReturns??0)+1;
      if(dead){
        member.status="dead";
        member.dutyStatus="dead";
        member.availableAt=Infinity;
        member.deathAt=now;
      }else{
        const severity=medical.condition==="critical"?3:medical.condition==="serious"||medical.condition==="unconscious"?2:wounded?1:0;
        const recovery=this.recoveryDuration*(1+severity*(this.woundedRecoveryMultiplier-1));
        member.status=recovery>0?"recovering":"available";
        member.dutyStatus=member.status;
        member.availableAt=recovery>0?now+recovery:0;
      }
      member.operationId=null;
      member.deployedActorId=null;
      const outcome={rosterId:member.id,actorId:actor?.id??null,healthStatus:member.healthStatus,wounds:member.wounds.map(wound=>({...wound})),experience:member.experience,level:member.level,availableAt:member.availableAt};
      operation.rosterOutcome.push(outcome);
      this.#record(dead?"roster_member_killed":wounded?"roster_member_wounded":"roster_member_returned",now,{factionId:faction.id,operationId:operation.id,...outcome});
    }
    return true;
  }

  completeReturn(operationId,{now=0}={}){
    const operation=this.operations.get(operationId);
    if(!operation||!["returning","interrupted"].includes(operation.status))return false;
    const interrupted=operation.status==="interrupted";
    operation.status=interrupted?"deferred":"completed";
    operation.result=interrupted?(operation.result??"deferred"):"completed";
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
    if(!operation.rosterOutcome?.length){
      for(const rosterId of operation.rosterIds){
        const member=faction?.roster.find(candidate=>candidate.id===rosterId);
        if(!member||member.status==="dead")continue;
        member.status=this.recoveryDuration>0?"recovering":"available";
        member.dutyStatus=member.status;
        member.operationId=null;
        member.deployedActorId=null;
        member.availableAt=this.recoveryDuration>0?now+this.recoveryDuration:0;
      }
    }
    if(!interrupted&&faction){
      faction.score+=operation.scoreValue??50;
      if(operation.resourceType&&operation.resourceAmount>0)faction.resources[operation.resourceType]=(faction.resources[operation.resourceType]??0)+operation.resourceAmount;
      this.#record("faction_score_awarded",now,{factionId:faction.id,operationId:operation.id,points:operation.scoreValue??50,totalScore:faction.score,resourceType:operation.resourceType,resourceAmount:operation.resourceAmount});
    }
    this.#record(interrupted?"faction_operation_deferred":"faction_operation_completed",now,{operationId,factionId:operation.factionId,needId:operation.needId,objectiveId:operation.objectiveId,result:operation.result,violent:Boolean(operation.violent),blockingOperationId:operation.blockingOperationId,outcomeId:operation.outcomeId});
    return true;
  }

  getOperation(operationId){return cloneOperation(this.operations.get(operationId)??null);}
  getFaction(factionId){const faction=this.factions.get(factionId);return faction?cloneFaction(faction):null;}
  getNeedByObjective(objectiveId){return cloneNeed(this.needs.get(objectiveId)??null);}
  getCandidateScores(){return this.lastCandidateScores.map(candidate=>({...candidate,scoreBreakdown:{...candidate.scoreBreakdown},rosterIds:[...candidate.rosterIds]}));}
  activeOperations(){return[...this.operations.values()].filter(operation=>["proposed","deployed","returning","interrupted"].includes(operation.status)).map(cloneOperation);}

  summary(){
    return{
      liveMode:this.liveMode,
      seed:this.seed,
      factions:[...this.factions.values()].map(faction=>({
        id:faction.id,
        label:faction.label,
        score:faction.score,
        resources:{...faction.resources},
        available:faction.roster.filter(member=>member.status==="available").length,
        assigned:faction.roster.filter(member=>member.status==="assigned").length,
        deployed:faction.roster.filter(member=>member.status==="deployed").length,
        recovering:faction.roster.filter(member=>member.status==="recovering").length,
        wounded:faction.roster.filter(member=>member.healthStatus==="wounded").length,
        dead:faction.roster.filter(member=>member.healthStatus==="dead").length,
        roster:faction.roster.map(cloneRosterMember)
      })),
      needs:[...this.needs.values()].map(cloneNeed),
      operations:[...this.operations.values()].map(cloneOperation),
      candidates:this.getCandidateScores(),
      activeOperationIds:this.activeOperations().map(operation=>operation.id),
      history:this.history.map(entry=>({...entry,data:{...entry.data}}))
    };
  }

  #selectTeam(faction,need){
    const available=faction.roster.filter(member=>member.status==="available"&&member.healthStatus!=="dead");
    if(available.length<this.teamSize)return[];
    const keys=roleCapabilitiesForNeed(need);
    const specialist=[...available].sort((a,b)=>
      capabilityScore(b,keys.specialist)-capabilityScore(a,keys.specialist)||
      capabilityScore(b,"technicalWork")-capabilityScore(a,"technicalWork")||a.id.localeCompare(b.id)
    )[0];
    const remaining=available.filter(member=>member!==specialist);
    const lead=[...remaining].sort((a,b)=>
      (capabilityScore(b,keys.lead)+capabilityScore(b,"navigation")*.45+capabilityScore(b,"scouting")*.35)-
      (capabilityScore(a,keys.lead)+capabilityScore(a,"navigation")*.45+capabilityScore(a,"scouting")*.35)||a.id.localeCompare(b.id)
    )[0];
    const securityPool=remaining.filter(member=>member!==lead);
    const security=[...securityPool].sort((a,b)=>
      (capabilityScore(b,keys.support)+capabilityScore(b,"observation")*.45)-
      (capabilityScore(a,keys.support)+capabilityScore(a,"observation")*.45)||a.id.localeCompare(b.id)
    )[0];
    const selected=[lead,specialist,security].filter(Boolean);
    for(const member of available)if(selected.length<this.teamSize&&!selected.includes(member))selected.push(member);
    return selected.slice(0,this.teamSize);
  }

  #assignResponsibilities(team,need){
    const [lead,specialist,security]=team;
    const specialistLabel=need.kind==="recover_supplies"?"supply_handler":need.kind==="survey_route"?"survey_recorder":"objective_specialist";
    return[
      lead?{rosterId:lead.id,responsibility:need.kind==="survey_route"?"route_scout":"approach_lead"}:null,
      specialist?{rosterId:specialist.id,responsibility:specialistLabel}:null,
      security?{rosterId:security.id,responsibility:"local_security"}:null
    ].filter(Boolean);
  }

  #teamCapabilityFit(team,needs){
    if(!team.length)return 0;
    let weighted=0,total=0;
    for(const [key,weight] of Object.entries(needs??{})){
      weighted+=Math.max(...team.map(member=>capabilityScore(member,key)),0)*weight;
      total+=weight;
    }
    return total>0?clamp(weighted/total):1;
  }

  #record(type,time,data={}){
    const entry={type,time,data:{...data}};
    this.history.push(entry);
    if(this.history.length>360)this.history.splice(0,this.history.length-360);
    this.decisionLog?.record?.({type,time,teamId:data.teamId??null,data:{...data}});
  }
}
