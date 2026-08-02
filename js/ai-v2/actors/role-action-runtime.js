import { ObserveSectorAction } from "../actions/observe-sector-action.js?v=20h-procedure-driven-actor-actions-20260802";
import { HoldReadyAction } from "../actions/hold-ready-action.js?v=20h-procedure-driven-actor-actions-20260802";
import { buildRoleActionContext } from "./role-action-context.js?v=20h-procedure-driven-actor-actions-20260802";
import { ActorActionEvaluator } from "./actor-action-evaluator.js?v=20h-procedure-driven-actor-actions-20260802";

function authoredDirective(actor){
  const assignment=actor?.aiV2Assignment;
  if(assignment?.action!=="observe_sector"||!assignment.sector)return null;
  return{
    ...assignment,
    sector:{...assignment.sector},
    provenance:{
      owner:"fixture_assignment",
      source:"authored_task",
      roleLabel:assignment.role??"Observer",
      procedureLabel:assignment.procedure??"Observation Watch",
      phaseLabel:assignment.phase??"Observe"
    }
  };
}

function roleAction(action){return action?.metadata?.provenance?.owner==="role_action_runtime";}
function sameProvenance(a,b){
  if(!a&&!b)return true;
  return a?.procedureId===b?.procedureId&&a?.phaseId===b?.phaseId&&a?.roleId===b?.roleId&&a?.owner===b?.owner;
}

export class RoleActionRuntime{
  constructor({scheduler,decisionLog=null,evaluator=new ActorActionEvaluator()}={}){
    this.scheduler=scheduler;
    this.decisionLog=decisionLog;
    this.evaluator=evaluator;
    this.assignments=new Map();
  }

  update({game,teamProcedures,teamMissions,teamKnowledge,teamEncounters,now=0,context={}}={}){
    const desiredByActor=new Map();
    for(const procedure of teamProcedures?.summary?.()??[]){
      if(procedure.phase?.id==="establish_responsibilities")continue;
      const mission=teamMissions?.get?.(procedure.teamId)??null;
      for(const role of procedure.roles??[]){
        if(!role.actorId)continue;
        const actor=game?.actors?.find(candidate=>candidate.id===role.actorId);
        if(!actor)continue;
        const roleContext=buildRoleActionContext({game,actor,role,procedure,mission,teamKnowledge,teamEncounters});
        const candidates=this.evaluator.evaluate(roleContext).sort((a,b)=>b.score-a.score);
        const selected=candidates[0]??null;
        if(!selected)continue;
        desiredByActor.set(actor.id,{actor,role,procedure,mission,candidates,selected});
      }
    }

    for(const desired of desiredByActor.values())this.#reconcile(desired,{game,now,context});

    for(const actor of game?.actors??[]){
      if(desiredByActor.has(actor.id))continue;
      this.#releaseActor(actor,{game,now,context});
    }

    this.assignments=new Map([...desiredByActor].map(([actorId,entry])=>[actorId,{
      actorId,
      roleId:entry.role.roleId,
      roleLabel:entry.role.label,
      procedureId:entry.procedure.procedureId,
      phaseId:entry.procedure.phase?.id??null,
      actionType:entry.selected.type,
      reason:entry.selected.reason,
      candidates:entry.candidates.map(candidate=>({type:candidate.type,score:candidate.score,reason:candidate.reason}))
    }]));
  }

  get(actorId){return this.assignments.get(actorId)??null;}
  summary(){return [...this.assignments.values()].map(item=>({...item,candidates:item.candidates.map(candidate=>({...candidate}))}));}

  #reconcile(desired,{game,now,context}){
    const {actor,selected,role,procedure}=desired;
    const existingObserve=this.scheduler.getAction(actor.id,"ObserveSector");
    const existingHold=this.scheduler.getAction(actor.id,"HoldReady");

    if(selected.type==="ObserveSector"){
      if(existingHold)this.scheduler.cancelAction(actor.id,existingHold,{now,reason:"procedural_role_requires_observation"});
      if(existingObserve){
        const prior=existingObserve.metadata?.provenance??null;
        const adopted=existingObserve.adoptDirective(selected.directive,{now,context});
        if(adopted.changed||!sameProvenance(prior,selected.directive.provenance)){
          this.#record("role_action_adopted",actor,selected,now,{actionId:existingObserve.id,roleId:role.roleId,procedureId:procedure.procedureId,preservedAction:true});
        }
      }else{
        const action=new ObserveSectorAction({actorId:actor.id,assignment:selected.directive});
        const result=this.scheduler.start(action,{now,context});
        if(result.ok)this.#record("role_action_started",actor,selected,now,{actionId:action.id,roleId:role.roleId,procedureId:procedure.procedureId});
      }
      return;
    }

    if(selected.type==="HoldReady"){
      if(existingObserve)this.scheduler.cancelAction(actor.id,existingObserve,{now,reason:"procedural_role_requires_ready_reserve"});
      if(existingHold){
        const prior=existingHold.metadata?.provenance??null;
        const adopted=existingHold.adoptDirective(selected.directive,{now,context});
        if(adopted.changed||!sameProvenance(prior,selected.directive.provenance)){
          this.#record("role_action_adopted",actor,selected,now,{actionId:existingHold.id,roleId:role.roleId,procedureId:procedure.procedureId,preservedAction:true});
        }
      }else{
        const action=new HoldReadyAction({actorId:actor.id,directive:selected.directive});
        const result=this.scheduler.start(action,{now,context});
        if(result.ok)this.#record("role_action_started",actor,selected,now,{actionId:action.id,roleId:role.roleId,procedureId:procedure.procedureId});
      }
    }
  }

  #releaseActor(actor,{game,now,context}){
    const observe=this.scheduler.getAction(actor.id,"ObserveSector");
    const hold=this.scheduler.getAction(actor.id,"HoldReady");
    if(hold&&roleAction(hold)){
      this.scheduler.cancelAction(actor.id,hold,{now,reason:"procedural_responsibility_ended"});
      this.#record("role_action_released",actor,{type:"HoldReady",reason:"Procedural responsibility ended."},now,{actionId:hold.id});
    }
    if(observe&&roleAction(observe)){
      const authored=authoredDirective(actor);
      if(authored){
        observe.adoptDirective(authored,{now,context});
        this.#record("role_action_released_to_authored_task",actor,{type:"ObserveSector",reason:"The procedural role ended, but the authored observation task remains valid."},now,{actionId:observe.id,preservedAction:true});
      }else{
        this.scheduler.cancelAction(actor.id,observe,{now,reason:"procedural_responsibility_ended"});
        this.#record("role_action_released",actor,{type:"ObserveSector",reason:"Procedural responsibility ended."},now,{actionId:observe.id});
      }
    }
  }

  #record(type,actor,selected,now,data={}){
    this.decisionLog?.record?.({
      type,
      time:now,
      actorId:actor.id,
      actionType:selected.type,
      data:{reason:selected.reason,...data}
    });
  }
}
