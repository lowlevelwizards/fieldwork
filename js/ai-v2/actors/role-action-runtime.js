import { ObserveSectorAction } from "../actions/observe-sector-action.js";
import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { IssueWarningAction } from "../actions/issue-warning-action.js";
import { WithdrawToRouteAction } from "../actions/withdraw-to-route-action.js";
import { ApproachCasualtyAction } from "../actions/approach-casualty-action.js";
import { ApproachEvacuationCasualtyAction } from "../actions/approach-evacuation-casualty-action.js";
import { AssessCasualtyAction } from "../actions/assess-casualty-action.js";
import { DragCasualtyAction } from "../actions/drag-casualty-action.js";
import { StabilizeCasualtyAction } from "../actions/stabilize-casualty-action.js";
import { SelectEvacuationRouteAction } from "../actions/select-evacuation-route-action.js";
import { AdvanceRouteSecurityAction } from "../actions/advance-route-security-action.js";
import { EvacuateCasualtyAction } from "../actions/evacuate-casualty-action.js";
import { ReassessEvacuationCasualtyAction } from "../actions/reassess-evacuation-casualty-action.js";
import { TransferCasualtyAction } from "../actions/transfer-casualty-action.js";
import { ProtectiveFireAction } from "../actions/protective-fire-action.js";
import { DemonstrativeFireAction } from "../actions/demonstrative-fire-action.js";
import { MoveToObjectivePositionAction } from "../actions/move-to-objective-position-action.js";
import { InspectObjectiveAction } from "../actions/inspect-objective-action.js";
import { PerformObjectiveWorkAction } from "../actions/perform-objective-work-action.js";
import { CollectSupplyAction } from "../actions/collect-supply-action.js";
import { RecordSurveyPointAction } from "../actions/record-survey-point-action.js";
import { AssistObjectiveWorkAction } from "../actions/assist-objective-work-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
import { buildRoleActionContext } from "./role-action-context.js";
import { ActorActionEvaluator } from "./actor-action-evaluator.js";
import {
  evaluateProtectiveBreakawayActions,
  extendProtectiveBreakawayContext
} from "./protective-breakaway-actions.js";
import {
  evaluateDemonstrativeFireActions,
  extendDemonstrativeFireContext
} from "./demonstrative-fire-actions.js";
import {
  evaluateObjectiveMissionActions,
  extendObjectiveMissionContext
} from "./objective-mission-actions.js";
import { evaluateLiveOperationActions, extendLiveOperationContext } from "./live-operation-actions.js";

function staffedConcernForRole(actor,role,context){
  const staffing=context?.services?.concernStaffing;
  if(!staffing)return null;
  const direct=staffing.findForActor?.(actor.id,{responsibility:role?.roleId});
  if(direct)return direct;
  if(String(role?.roleId??"").includes("security")){
    return(staffing.getActorAssignments?.(actor.id)??[]).find(item=>String(item.responsibility).includes("security"))??null;
  }
  return staffing.getPrimaryForActor?.(actor.id)??null;
}

const ROLE_ACTION_TYPES=new Set([
  "ObserveSector","HoldReady","IssueWarning","WithdrawToRoute",
  "ApproachCasualty","ApproachEvacuationCasualty","AssessCasualty","DragCasualty","StabilizeCasualty",
  "SelectEvacuationRoute","AdvanceRouteSecurity","EvacuateCasualty","ReassessEvacuationCasualty","TransferCasualty",
  "ProtectiveFire","DemonstrativeFire","MoveToObjectivePosition","InspectObjective","PerformObjectiveWork","CollectSupply","RecordSurveyPoint","AssistObjectiveWork"
]);

const ACTION_CONSTRUCTORS={
  ObserveSector:directive=>new ObserveSectorAction({actorId:directive.actorId,assignment:directive.directive}),
  HoldReady:directive=>new HoldReadyAction({actorId:directive.actorId,directive:directive.directive}),
  IssueWarning:directive=>new IssueWarningAction({actorId:directive.actorId,directive:directive.directive}),
  WithdrawToRoute:directive=>new WithdrawToRouteAction({actorId:directive.actorId,directive:directive.directive}),
  ApproachCasualty:directive=>new ApproachCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  ApproachEvacuationCasualty:directive=>new ApproachEvacuationCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  AssessCasualty:directive=>new AssessCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  DragCasualty:directive=>new DragCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  StabilizeCasualty:directive=>new StabilizeCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  SelectEvacuationRoute:directive=>new SelectEvacuationRouteAction({actorId:directive.actorId,directive:directive.directive}),
  AdvanceRouteSecurity:directive=>new AdvanceRouteSecurityAction({actorId:directive.actorId,directive:directive.directive}),
  EvacuateCasualty:directive=>new EvacuateCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  ReassessEvacuationCasualty:directive=>new ReassessEvacuationCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  TransferCasualty:directive=>new TransferCasualtyAction({actorId:directive.actorId,directive:directive.directive}),
  ProtectiveFire:directive=>new ProtectiveFireAction({actorId:directive.actorId,directive:directive.directive}),
  DemonstrativeFire:directive=>new DemonstrativeFireAction({actorId:directive.actorId,directive:directive.directive}),
  MoveToObjectivePosition:directive=>new MoveToObjectivePositionAction({actorId:directive.actorId,directive:directive.directive}),
  InspectObjective:directive=>new InspectObjectiveAction({actorId:directive.actorId,directive:directive.directive}),
  PerformObjectiveWork:directive=>new PerformObjectiveWorkAction({actorId:directive.actorId,directive:directive.directive}),
  CollectSupply:directive=>new CollectSupplyAction({actorId:directive.actorId,directive:directive.directive}),
  RecordSurveyPoint:directive=>new RecordSurveyPointAction({actorId:directive.actorId,directive:directive.directive}),
  AssistObjectiveWork:directive=>new AssistObjectiveWorkAction({actorId:directive.actorId,directive:directive.directive})
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
  constructor({scheduler,decisionLog=null,evaluator=new ActorActionEvaluator(),brain=null,arbiter=null}={}){
    this.scheduler=scheduler;this.decisionLog=decisionLog;this.evaluator=evaluator;this.brain=brain??arbiter;this.assignments=new Map();
  }

  update({game,teamProcedures,teamMissions,teamKnowledge,teamEncounters,casualtyKnowledge,now=0,context={}}={}){
    const desiredByActor=new Map();
    for(const procedure of teamProcedures?.summary?.()??[]){
      if(procedure.phase?.id==="establish_responsibilities")continue;
      const mission=teamMissions?.get?.(procedure.teamId)??null;
      for(const role of procedure.roles??[]){
        if(!role.actorId)continue;
        const actor=game?.actors?.find(candidate=>candidate.id===role.actorId);if(!actor)continue;
        const baseContext=buildRoleActionContext({game,actor,role,procedure,mission,teamKnowledge,teamEncounters,casualtyKnowledge,evacuationRoutes:context?.services?.evacuationRoutes,currentObserveAction:this.scheduler.getAction(actor.id,"ObserveSector")});
        const protectiveContext=extendProtectiveBreakawayContext(baseContext,{game,actor,role,procedure,mission});
        const demonstrativeContext=extendDemonstrativeFireContext(protectiveContext,{game,actor,role,procedure,mission});
        const objectiveContext=extendObjectiveMissionContext(demonstrativeContext,{
          game,actor,role,procedure,mission,now,
          objectives:context?.services?.objectives,
          objectiveApproaches:context?.services?.objectiveApproaches,
          positionQueries:context?.services?.positionQueries,
          directionalCover:context?.services?.directionalCover,
          destinationClaims:context?.services?.destinationClaims,
          teamKnowledge,
          teamAgenda:context?.services?.teamAgenda
        });
        const roleContext=extendLiveOperationContext(objectiveContext,{
          game,actor,role,procedure,mission,now,
          objectives:context?.services?.objectives,
          objectiveApproaches:context?.services?.objectiveApproaches,
          teamKnowledge,
          teamAgenda:context?.services?.teamAgenda
        });
        const candidates=[
          ...this.evaluator.evaluate(roleContext),
          ...evaluateProtectiveBreakawayActions(roleContext),
          ...evaluateDemonstrativeFireActions(roleContext),
          ...evaluateObjectiveMissionActions(roleContext),
          ...evaluateLiveOperationActions(roleContext)
        ].sort((a,b)=>b.score-a.score);
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
    const staffedConcern=staffedConcernForRole(actor,role,context);
    const obligation=staffedConcern?context?.services?.actorObligations?.findForActor?.(actor.id,{sourceAssignmentId:staffedConcern.id})??null:null;
    const bindConcern=action=>{
      if(!action||!staffedConcern)return;
      action.metadata={...(action.metadata??{}),actorBrainPlan:{...(action.metadata?.actorBrainPlan??{}),concernId:staffedConcern.concernId,obligationId:obligation?.id??null,desiredEffect:staffedConcern.desiredEffect,source:action.metadata?.actorBrainPlan?.source??"role_action_runtime"}};
    };
    const existing=this.scheduler.getAction(actor.id,selected.type);
    for(const action of [...this.scheduler.getActions(actor.id)]){
      if(action.type===selected.type||!ROLE_ACTION_TYPES.has(action.type))continue;
      this.#cancelWithCleanup(actor,action,{now,context,reason:`procedural_role_requires_${selected.type}`});
    }

    if(selected.type==="ObserveSector"&&existing){
      const prior=existing.metadata?.provenance??null;
      const adopted=existing.adoptDirective(selected.directive,{now,context});
      bindConcern(existing);
      if(adopted.changed||!sameProvenance(prior,selected.directive.provenance))this.#record("role_action_adopted",actor,selected,now,{actionId:existing.id,roleId:role.roleId,procedureId:procedure.procedureId,preservedAction:true});
      return;
    }
    if(selected.type==="HoldReady"&&existing){
      const prior=existing.metadata?.provenance??null;
      const adopted=existing.adoptDirective(selected.directive,{now,context});
      bindConcern(existing);
      if(adopted.changed||!sameProvenance(prior,selected.directive.provenance))this.#record("role_action_adopted",actor,selected,now,{actionId:existing.id,roleId:role.roleId,procedureId:procedure.procedureId,preservedAction:true});
      return;
    }
    if(existing){bindConcern(existing);return;}
    const create=ACTION_CONSTRUCTORS[selected.type];if(!create)return;
    const action=create({actorId:actor.id,directive:selected.directive});
    const agenda=context?.services?.teamAgenda?.get?.(actor.teamId)??null;
    const authorityTier=agenda?.source==="encounter"
      ?ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE
      :ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY;
    const authorityLabel=agenda?.source==="encounter"?"Governing team response":"Governing mission responsibility";
    const onGranted=result=>this.#record("role_action_started",actor,selected,now,{actionId:result.action?.id??action.id,roleId:role.roleId,procedureId:procedure.procedureId,concernId:staffedConcern?.concernId??null});
    if(this.brain)this.brain.submit({
      actorId:actor.id,action,score:selected.score,urgency:agenda?.source==="encounter"?.9:.55,
      authorityTier,authorityLabel,reason:selected.reason,source:"role_action_runtime",
      operationId:actor.operationId??null,missionId:procedure.missionId??null,
      governingIntentId:agenda?.intentId??null,supportingIntentId:agenda?.supporting?.intentId??null,
      procedureId:procedure.procedureId,roleId:role.roleId,concernId:staffedConcern?.concernId??null,obligationId:obligation?.id??null,
      desiredEffect:staffedConcern?.desiredEffect??null,onGranted
    });

  }

  #cancelWithCleanup(actor,action,{now,context,reason}){
    this.brain?.requestCancel?.(actor.id,action,{reason});
    if(["WithdrawToRoute","ApproachCasualty","ApproachEvacuationCasualty","DragCasualty","AdvanceRouteSecurity","EvacuateCasualty","MoveToObjectivePosition","CollectSupply","AssistObjectiveWork"].includes(action.type))context?.services?.destinationClaims?.release?.(actor.id,{now,reason});
    if(["DragCasualty","EvacuateCasualty"].includes(action.type)){
      const patientId=action.directive?.casualtyId;const patient=context?.game?.actors?.find(candidate=>candidate.id===patientId);
      context?.services?.casualtyCare?.releasePatient?.(patientId,actor.id);context?.services?.casualtyCare?.releaseDrag?.({patient});
    }
    if(["StabilizeCasualty","ReassessEvacuationCasualty","TransferCasualty"].includes(action.type))context?.services?.casualtyCare?.releasePatient?.(action.directive?.casualtyId,actor.id);
    if(["InspectObjective","PerformObjectiveWork"].includes(action.type))context?.services?.objectives?.releaseWork?.(action.directive?.objectiveId,actor.id,{now,reason});
    if(action.type==="AssistObjectiveWork")context?.services?.objectives?.releaseAssist?.(action.directive?.objectiveId,actor.id,{now,reason});
  }

  #releaseActor(actor,{now,context}){
    for(const action of [...this.scheduler.getActions(actor.id)]){
      if(!ROLE_ACTION_TYPES.has(action.type)||!roleAction(action))continue;
      if(action.type==="ObserveSector"){
        const outcome=context?.services?.encounterOutcomes?.getLatest?.(actor.teamId)??null;
        const missionResolved=outcome?.missionResolved??outcome?.resolved??false;
        const authored=missionResolved?null:authoredDirective(actor);
        if(authored){action.adoptDirective(authored,{now,context});this.#record("role_action_released_to_authored_task",actor,{type:"ObserveSector",reason:"The procedural role ended, but the authored observation task remains valid."},now,{actionId:action.id,preservedAction:true});continue;}
      }
      this.#cancelWithCleanup(actor,action,{now,context,reason:"procedural_responsibility_ended"});
      this.#record("role_action_released",actor,{type:action.type,reason:"Procedural responsibility ended."},now,{actionId:action.id});
    }
  }
  #record(type,actor,selected,now,data={}){this.decisionLog?.record?.({type,time:now,actorId:actor.id,actionType:selected.type,data:{reason:selected.reason,...data}});}
}
