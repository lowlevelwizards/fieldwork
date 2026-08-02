import { ObserveSectorAction } from "../actions/observe-sector-action.js";
import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { IssueWarningAction } from "../actions/issue-warning-action.js";
import { WithdrawToRouteAction } from "../actions/withdraw-to-route-action.js";
import { ApproachCasualtyAction } from "../actions/approach-casualty-action.js";
import { AssessCasualtyAction } from "../actions/assess-casualty-action.js";
import { DragCasualtyAction } from "../actions/drag-casualty-action.js";
import { StabilizeCasualtyAction } from "../actions/stabilize-casualty-action.js";
import { buildRoleActionContext } from "./role-action-context.js";
import { ActorActionEvaluator } from "./actor-action-evaluator.js";

const ROLE_ACTION_TYPES=new Set([
  "ObserveSector","HoldReady","IssueWarning","WithdrawToRoute",
  "ApproachCasualty","AssessCasualty","DragCasualty","StabilizeCasualty"
]);

const ACTION_CONSTRUCTORS={
  ObserveSector:directive=>new ObserveSectorAction({actorId:directive.actorId,assignment:directive.directive}),
  HoldReady:directive=>new HoldReadyAction({actorId:directive.actorId,directive:directive.directive}),
  IssueWarning:directive=>new IssueWarningAction({actorId:directive.actorId,directive:directive.directive}),
  WithdrawToRoute:directive=>new WithdrawToRouteAction({actorId:directive.actorId,directive:directive.directive}),
  ApproachCasualty:directive=>new ApproachCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  AssessCasualty:directive=>new AssessCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  DragCasualty:directive=>new DragCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  StabilizeCasualty:directive=>new StabilizeCasualtyAction({actorId:directive.actorId,directive:directive.directive})
};

function authoredDirective(actor){
  const assignment=actor?.aiV2Assignment;
  if(assignment?.action!=="observe_sector"||!assignment.sector)return null;
  return{
    ...assignment,
    sector:{...assignment.sector},
    provenance:{owner:"fixture_assignment",source:"authored_task",roleLabel:assignment.role??"Observer",procedureLabel:assignment.procedure??"Observation Watch",phaseLabel:assignment.phase??"Observe"}
  };
}
function roleAction(action){return action?.metadata?.provenance?.owner==="role_action_runtime";}
function sameProvenance(a,b){return (!a&&!b)||(a?.procedureId===b?.procedureId&&a?.phaseId===b?.phaseId&&a?.roleId===b?.roleId&&a?.owner===b?.owner);}

export class RoleActionRuntime{
  constructor({scheduler,decisionLog=null,evaluator=new ActorActionEvaluator()}={}){
    this.scheduler=scheduler;this.decisionLog=decisionLog;this.evaluator=evaluator;this.assignments=new Map();
  }

  update({game,teamProcedures,teamMissions,teamKnowledge,teamEncounters,casualtyKnowledge,now=0,context={}}={}){
    const desiredByActor=new Map();
    for(const procedure of teamProcedures?.summary?.()??[]){
      if(procedure.phase?.id==="establish_responsibilities")continue;
      const mission=teamMissions?.get?.(procedure.teamId)??null;
      for(const role of procedure.roles??[]){
        if(!role.actorId)continue;
        const actor=game?.actors?.find(candidate=>candidate.id===role.actorId);if(!actor)continue;
        const roleContext=buildRoleActionContext({game,actor,role,procedure,mission,teamKnowledge,teamEncounters,casualtyKnowledge,currentObserveAction:this.scheduler.getAction(actor.id,"ObserveSector")});
        const candidates=this.evaluator.evaluate(roleContext).sort((a,b)=>b.score-a.score);
        const selected=candidates[0]??null;if(!selected)continue;
        desiredByActor.set(actor.id,{actor,role,procedure,mission,candidates,selected});
      }
    }
    for(const desired of desiredByActor.values())this.#reconcile(desired,{game,now,context});
    for(const actor of game?.actors??[])if(!desiredByActor.has(actor.id))this.#releaseActor(actor,{game,now,context});
    this.assignments=new Map([...desiredByActor].map(([actorId,entry])=>[actorId,{actorId,roleId:entry.role.roleId,roleLabel:entry.role.label,procedureId:entry.procedure.procedureId,phaseId:entry.procedure.phase?.id??null,actionType:entry.selected.type,reason:entry.selected.reason,candidates:entry.candidates.map(candidate=>({type:candidate.type,score:candidate.score,reason:candidate.reason}))}]));
  }
  get(actorId){return this.assignments.get(actorId)??null;}
  summary(){return[...this.assignments.values()].map(item=>({...item,candidates:item.candidates.map(candidate=>({...candidate}))}));}

  #reconcile(desired,{game,now,context}){
    const {actor,selected,role,procedure}=desired;
    const existing=this.scheduler.getAction(actor.id,selected.type);
    for(const action of [...this.scheduler.getActions(actor.id)]){
      if(action.type===selected.type||!ROLE_ACTION_TYPES.has(action.type))continue;
      this.#cancelWithCleanup(actor,action,{now,context,reason:`procedural_role_requires_${selected.type}`});
    }

    if(selected.type==="ObserveSector"&&existing){
      const prior=existing.metadata?.provenance??null;
      const adopted=existing.adoptDirective(selected.directive,{now,context});
      if(adopted.changed||!sameProvenance(prior,selected.directive.provenance))this.#record("role_action_adopted",actor,selected,now,{actionId:existing.id,roleId:role.roleId,procedureId:procedure.procedureId,preservedAction:true});
      return;
    }
    if(selected.type==="HoldReady"&&existing){
      const prior=existing.metadata?.provenance??null;
      const adopted=existing.adoptDirective(selected.directive,{now,context});
      if(adopted.changed||!sameProvenance(prior,selected.directive.provenance))this.#record("role_action_adopted",actor,selected,now,{actionId:existing.id,roleId:role.roleId,procedureId:procedure.procedureId,preservedAction:true});
      return;
    }
    if(existing)return;
    const create=ACTION_CONSTRUCTORS[selected.type];if(!create)return;
    const action=create({actorId:actor.id,directive:selected.directive});
    const result=this.scheduler.start(action,{now,context});
    if(result.ok)this.#record("role_action_started",actor,selected,now,{actionId:action.id,roleId:role.roleId,procedureId:procedure.procedureId});
  }

  #cancelWithCleanup(actor,action,{now,context,reason}){
    this.scheduler.cancelAction(actor.id,action,{now,reason});
    if(["WithdrawToRoute","ApproachCasualty","DragCasualty"].includes(action.type))context?.services?.destinationClaims?.release?.(actor.id,{now,reason});
    if(action.type==="DragCasualty"){
      const patientId=action.directive?.casualtyId;const patient=context?.game?.actors?.find(candidate=>candidate.id===patientId);
      context?.services?.casualtyCare?.releasePatient?.(patientId,actor.id);context?.services?.casualtyCare?.releaseDrag?.({patient});
    }
    if(action.type==="StabilizeCasualty")context?.services?.casualtyCare?.releasePatient?.(action.directive?.casualtyId,actor.id);
  }

  #releaseActor(actor,{now,context}){
    for(const action of [...this.scheduler.getActions(actor.id)]){
      if(!ROLE_ACTION_TYPES.has(action.type)||!roleAction(action))continue;
      if(action.type==="ObserveSector"){
        const resolvedOutcome=context?.services?.encounterOutcomes?.getLatest?.(actor.teamId)??null;
        const authored=resolvedOutcome?.resolved?null:authoredDirective(actor);
        if(authored){action.adoptDirective(authored,{now,context});this.#record("role_action_released_to_authored_task",actor,{type:"ObserveSector",reason:"The procedural role ended, but the authored observation task remains valid."},now,{actionId:action.id,preservedAction:true});continue;}
      }
      this.#cancelWithCleanup(actor,action,{now,context,reason:"procedural_responsibility_ended"});
      this.#record("role_action_released",actor,{type:action.type,reason:"Procedural responsibility ended."},now,{actionId:action.id});
    }
  }
  #record(type,actor,selected,now,data={}){this.decisionLog?.record?.({type,time:now,actorId:actor.id,actionType:selected.type,data:{reason:selected.reason,...data}});}
}
