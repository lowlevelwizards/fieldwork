import { ActionScheduler } from "../actions/action-scheduler.js";
import { ObserveSectorAction } from "../actions/observe-sector-action.js";
import { ReportContactAction } from "../actions/report-contact-action.js";
import { ReportContactUpdateAction } from "../actions/report-contact-update-action.js";
import { ReportCasualtyAction } from "../actions/report-casualty-action.js";
import { RoleActionRuntime } from "../actors/role-action-runtime.js";
import { RolePositionRuntime } from "../actors/role-position-runtime.js";
import { CommunicationExecutor } from "../communication/communication-executor.js";
import { DecisionLog } from "../diagnostics/decision-log.js";
import { InvariantMonitor } from "../diagnostics/invariant-monitor.js";
import { TeamEncounterMemory } from "../encounters/team-encounter-memory.js";
import { EncounterOutcomeMemory } from "../encounters/encounter-outcome-memory.js";
import { AttentionExecutor } from "../execution/attention-executor.js";
import { LocomotionExecutor } from "../execution/locomotion-executor.js";
import { CasualtyCareExecutor } from "../execution/casualty-care-executor.js";
import { PersonalKnowledgeStore } from "../knowledge/personal-knowledge.js";
import { TeamKnowledgeStore } from "../knowledge/team-knowledge.js";
import { HeardCommunicationStore } from "../knowledge/heard-communication.js";
import { CasualtyKnowledgeStore } from "../knowledge/casualty-knowledge.js";
import { TeamMissionStore } from "../missions/team-mission.js";
import { TeamProcedureState } from "../procedures/team-procedure-state.js";
import { DestinationClaimService } from "../position/destination-claim-service.js";
import { PositionQueryService } from "../position/position-query-service.js";
import { TeamResponseState } from "../responses/team-response-state.js";
import { evaluateCasualtyObservation } from "../senses/casualty-observation.js";
import { captureWorldSnapshot } from "./world-snapshot.js";

export const AI_RUNTIME_MODES=Object.freeze({LEGACY:"legacy",V2:"v2"});
const stateLabel=state=>String(state??"none").replaceAll("_"," ");

function authoredObservationDirective(actor){
  const assignment=actor?.aiV2Assignment;
  if(assignment?.action!=="observe_sector"||!assignment.sector)return null;
  return{
    ...assignment,
    sector:{...assignment.sector},
    report:assignment.report?{...assignment.report}:null,
    provenance:{
      owner:"fixture_assignment",
      source:"authored_task",
      roleLabel:assignment.role??"Observer",
      procedureLabel:assignment.procedure??"Observation Watch",
      phaseLabel:assignment.phase??"Observe"
    }
  };
}

export class AIV2Runtime{
  constructor(game){
    this.game=game;
    this.elapsed=0;
    this.snapshotAccumulator=0;
    this.snapshotInterval=.25;
    this.decisionLog=new DecisionLog({limit:1200});
    this.invariants=new InvariantMonitor({decisionLog:this.decisionLog});
    this.scheduler=new ActionScheduler({decisionLog:this.decisionLog});
    this.personalKnowledge=new PersonalKnowledgeStore({decisionLog:this.decisionLog});
    this.teamKnowledge=new TeamKnowledgeStore({decisionLog:this.decisionLog});
    this.heardCommunications=new HeardCommunicationStore({decisionLog:this.decisionLog});
    this.casualtyKnowledge=new CasualtyKnowledgeStore({decisionLog:this.decisionLog});
    this.teamMissions=new TeamMissionStore();
    this.teamEncounters=new TeamEncounterMemory({decisionLog:this.decisionLog});
    this.encounterOutcomes=new EncounterOutcomeMemory({decisionLog:this.decisionLog});
    this.teamResponses=new TeamResponseState({decisionLog:this.decisionLog});
    this.teamProcedures=new TeamProcedureState({decisionLog:this.decisionLog});
    this.roleActions=new RoleActionRuntime({scheduler:this.scheduler,decisionLog:this.decisionLog});
    this.positionQueries=new PositionQueryService();
    this.destinationClaims=new DestinationClaimService({decisionLog:this.decisionLog});
    this.rolePositions=new RolePositionRuntime({scheduler:this.scheduler,positionQueries:this.positionQueries,destinationClaims:this.destinationClaims,decisionLog:this.decisionLog});
    this.attention=new AttentionExecutor();
    this.locomotion=new LocomotionExecutor();
    this.casualtyCare=new CasualtyCareExecutor();
    this.communication=new CommunicationExecutor();
    this.visibleByObserver=new Map();
    this.snapshot=captureWorldSnapshot(game,{elapsed:0});
    this.invariants.inspect(this.snapshot,{now:0,procedures:[],roleActions:[]});
    this.decisionLog.record({type:"runtime_started",time:0,data:{mode:"v2",stage:"casualty_recovery_stabilization",scenario:game.scenarioMode}});
  }

  update(delta){
    this.elapsed+=delta;
    this.visibleByObserver=new Map();
    this.teamMissions.syncFromGame(this.game);
    this.#updateCasualtyObservations(delta);
    this.#ensureAuthoredObservationActions();
    this.scheduler.update(delta,{now:this.elapsed,context:this.#context(this.elapsed)});
    this.personalKnowledge.update(delta,{now:this.elapsed,visibleByObserver:this.visibleByObserver});
    this.teamKnowledge.update(delta,{now:this.elapsed});
    this.#ensureContactReports();
    this.#ensureContactUpdateReports();
    this.#ensureCasualtyReports();
    this.teamEncounters.update({missions:this.teamMissions,teamKnowledge:this.teamKnowledge,casualtyKnowledge:this.casualtyKnowledge,heardCommunications:this.heardCommunications,now:this.elapsed});
    this.teamResponses.update({missions:this.teamMissions,teamEncounters:this.teamEncounters,encounterOutcomes:this.encounterOutcomes,now:this.elapsed});
    this.teamProcedures.update({game:this.game,teamResponses:this.teamResponses,now:this.elapsed});
    this.roleActions.update({
      game:this.game,
      teamProcedures:this.teamProcedures,
      teamMissions:this.teamMissions,
      teamKnowledge:this.teamKnowledge,
      teamEncounters:this.teamEncounters,
      casualtyKnowledge:this.casualtyKnowledge,
      now:this.elapsed,
      context:this.#context(this.elapsed)
    });
    this.rolePositions.update({
      game:this.game,
      teamProcedures:this.teamProcedures,
      now:this.elapsed,
      context:this.#context(this.elapsed)
    });
    this.encounterOutcomes.update({
      game:this.game,
      teamProcedures:this.teamProcedures,
      teamEncounters:this.teamEncounters,
      heardCommunications:this.heardCommunications,
      casualtyKnowledge:this.casualtyKnowledge,
      now:this.elapsed
    });
    this.#updateActorDiagnostics();

    this.snapshotAccumulator+=delta;
    if(this.snapshotAccumulator<this.snapshotInterval)return;
    this.snapshotAccumulator%=this.snapshotInterval;
    this.snapshot=captureWorldSnapshot(this.game,{elapsed:this.elapsed});
    this.invariants.inspect(this.snapshot,{
      now:this.elapsed,
      procedures:this.teamProcedures.summary(),
      roleActions:this.roleActions.summary(),
      rolePositions:this.rolePositions.summary(),
      destinationClaims:this.destinationClaims.summary(this.elapsed),
      patientClaims:this.casualtyCare.summary(),
      scheduler:this.scheduler
    });
  }

  getDebugSummary(){
    const scheduler=this.scheduler.summary();
    const observers=scheduler.byType.ObserveSector??0;
    const ready=scheduler.byType.HoldReady??0;
    const repositioning=scheduler.byType.RepositionForResponsibility??0;
    const withdrawing=scheduler.byType.WithdrawToRoute??0;
    const recovery=(scheduler.byType.ApproachCasualty??0)+(scheduler.byType.AssessCasualty??0)+(scheduler.byType.DragCasualty??0)+(scheduler.byType.StabilizeCasualty??0);
    const visible=this.personalKnowledge.summary().reduce((sum,entry)=>sum+entry.contacts.filter(contact=>contact.currentlyVisible).length,0);
    const reporting=(scheduler.byType.ReportContact??0)+(scheduler.byType.ReportContactUpdate??0)+(scheduler.byType.ReportCasualty??0);
    const issuingWarnings=scheduler.byType.IssueWarning??0;
    const activityUpdates=this.teamKnowledge.activityReportCount();
    const activeEncounterCount=this.teamEncounters.summary().reduce((sum,entry)=>sum+entry.hypotheses.filter(item=>item.state!=="stale").length,0);
    return `${observers} observing · ${ready} holding ready · ${repositioning} repositioning · ${withdrawing} withdrawing · ${recovery} recovering casualty · ${reporting} reporting · ${issuingWarnings} warning · ${this.heardCommunications.count()} heard warning(s) · ${this.casualtyKnowledge.count()} casualty record(s) · ${this.personalKnowledge.count()} private contact(s) · ${visible} visible · ${activityUpdates} activity update(s) · ${this.teamKnowledge.reportCount()} shared report(s) · ${activeEncounterCount} mission-relevant encounter(s) · ${this.teamResponses.count()} response(s) · ${this.teamProcedures.count()} procedure(s) · ${this.encounterOutcomes.count()} outcome memory(s) · ${scheduler.activeActions} action(s) · ${this.invariants.current.length} invariant issue(s)`;
  }

  getDebugDetails(){
    const actionAssignments=this.game.actors.map(actor=>{
      const primary=this.scheduler.getPrimaryAction(actor.id);
      const role=this.teamProcedures.getActorRole(actor.id);
      if(!primary&&!role)return null;
      const source=primary?.metadata?.provenance?.source??"none";
      return `${actor.name}: ${primary?.type??"unassigned"}${role?` for ${role.label}`:""} · ${source}`;
    }).filter(Boolean).join(" · ")||"No V2 actor responsibilities in this fixture";
    const observingActors=this.game.actors.filter(actor=>this.scheduler.hasAction(actor.id,"ObserveSector"));
    const contacts=observingActors.map(actor=>{
      const contact=this.personalKnowledge.getBestContact(actor.id);
      return contact?`${actor.name}: ${contact.level} ${Math.round(contact.confidence)}% · ${stateLabel(contact.track?.currentActivity)} · ${stateLabel(contact.track?.intentHypothesis?.id)}`:`${actor.name}: none`;
    }).join(" · ")||"none";
    const communication=this.game.actors.map(actor=>{
      const casualtyReport=this.scheduler.getAction(actor.id,"ReportCasualty");
      if(casualtyReport)return `${actor.name}: casualty report ${Math.round(casualtyReport.progress*100)}% · ${casualtyReport.casualtySnapshot?.subjectName??"teammate"}`;
      const warning=this.scheduler.getAction(actor.id,"IssueWarning");
      if(warning)return `${actor.name}: directed warning ${Math.round(warning.progress*100)}% · ${warning.directive?.message??"challenge"}`;
      const update=this.scheduler.getAction(actor.id,"ReportContactUpdate");
      if(update)return `${actor.name}: activity update ${Math.round(update.progress*100)}% · ${stateLabel(update.contactSnapshot?.activity)}`;
      const report=this.scheduler.getAction(actor.id,"ReportContact");
      if(report)return `${actor.name}: voice report ${Math.round(report.progress*100)}%`;
      const heard=this.heardCommunications.getLatestForActor(actor.id);
      if(heard)return `${actor.name}: warning heard · ${heard.message}`;
      const delivered=actor.aiV2Communication?.status==="delivered";
      if(delivered)return `${actor.name}: delivered to ${actor.aiV2Communication.recipientIds.length}`;
      return null;
    }).filter(Boolean).join(" · ")||"none";
    const sharedContacts=this.teamKnowledge.summary().flatMap(entry=>entry.reports.map(report=>{
      const faction=this.game.actors.find(actor=>actor.teamId===entry.teamId)?.factionId??entry.teamId;
      const evidence=report.reportKind==="activity_update"?` · ${stateLabel(report.activity)} · ${stateLabel(report.intentHypothesis?.id)}`:"";
      return `${faction}: ${report.classification.replaceAll("_"," ")} ${Math.round(report.confidence)}%${evidence} via ${report.recipientIds.length} recipient(s)`;
    }));
    const sharedCasualties=this.casualtyKnowledge.summary().flatMap(entry=>entry.casualties.map(report=>{
      const faction=this.game.actors.find(actor=>actor.teamId===entry.teamId)?.factionId??entry.teamId;
      const treatment=report.assessment?.treatmentNeed?.type?` · needs ${stateLabel(report.assessment.treatmentNeed.type)}`:"";
      return `${faction}: ${report.subjectName} ${stateLabel(report.observedCondition)}${treatment} via ${report.recipientIds.length} recipient(s)`;
    }));
    const shared=[...sharedContacts,...sharedCasualties].join(" · ")||"none — no report delivered";
    const encounters=this.teamEncounters.summary().flatMap(entry=>entry.hypotheses.map(hypothesis=>{
      const faction=this.game.actors.find(actor=>actor.teamId===entry.teamId)?.factionId??entry.teamId;
      const activity=hypothesis.activity?` · ${stateLabel(hypothesis.activity)} / ${stateLabel(hypothesis.intent)}`:"";
      return `${faction}: ${stateLabel(hypothesis.state)} · ${hypothesis.missionRelevance} relevance${activity} · ${hypothesis.reason}`;
    })).join(" · ")||"none — no mission-relevant report";
    const responses=this.teamResponses.summary().map(response=>{
      const faction=this.game.actors.find(actor=>actor.teamId===response.teamId)?.factionId??response.teamId;
      const alternatives=response.candidates.slice(1,4).map(candidate=>`${candidate.label} ${Math.round(candidate.score*100)}`).join(", ");
      return `${faction}: ${response.selected.label} ${Math.round(response.selected.score*100)} · ${response.selected.reason}${alternatives?` · next: ${alternatives}`:""}`;
    }).join(" · ")||"none — no team response selected";
    const positions=this.rolePositions.summary().map(position=>{
      const actor=this.game.actors.find(candidate=>candidate.id===position.actorId);
      return `${actor?.name??position.actorId}: ${stateLabel(position.status)}${position.failureReason?` · ${position.failureReason}`:""}`;
    }).join(" · ")||"none — no role position requirements";
    const procedures=this.teamProcedures.summary().map(procedure=>{
      const faction=this.game.actors.find(actor=>actor.teamId===procedure.teamId)?.factionId??procedure.teamId;
      const roles=procedure.roles.map(role=>`${role.actorName??"unfilled"}: ${role.label}`).join(", ");
      return `${faction}: ${procedure.label} · ${procedure.phase.label} · ${roles}`;
    }).join(" · ")||"none — no team procedure assigned";
    const activity=this.personalKnowledge.summary().flatMap(entry=>entry.contacts.filter(contact=>(contact.track?.activityRevision??0)>0).map(contact=>{
      const actor=this.game.actors.find(candidate=>candidate.id===entry.observerId);
      return `${actor?.name??entry.observerId}: ${stateLabel(contact.track.currentActivity)} · ${stateLabel(contact.track.intentHypothesis?.id)} · revision ${contact.track.activityRevision}`;
    })).join(" · ")||"none — no meaningful activity change observed";
    const outcomes=this.encounterOutcomes.summary().flatMap(entry=>entry.outcomes.map(outcome=>{
      const faction=this.game.actors.find(actor=>actor.teamId===entry.teamId)?.factionId??entry.teamId;
      return `${faction}: ${outcome.label} · ${outcome.summary}`;
    })).join(" · ")||"none — no encounter outcome remembered";
    return{assignment:actionAssignments,personalKnowledge:contacts,activity,communication,teamKnowledge:shared,encounter:encounters,response:responses,procedure:procedures,position:positions,outcome:outcomes};
  }

  #updateCasualtyObservations(delta){
    for(const observer of this.game.actors){
      const assignment=observer.aiV2CasualtyAssignment;
      if(!assignment?.observe||observer.medical?.dead||observer.medical?.unconscious)continue;
      const visibleIds=new Set();
      const casualties=this.game.actors.filter(candidate=>candidate.id!==observer.id&&candidate.teamId===observer.teamId&&["critical","unconscious","serious"].includes(candidate.medical?.condition));
      for(const casualty of casualties){
        const evidence=evaluateCasualtyObservation(this.game,observer,casualty,{maximumRange:assignment.maximumRange??640,fieldOfViewDegrees:assignment.fieldOfViewDegrees??170});
        if(!evidence.visible)continue;
        visibleIds.add(casualty.id);
        this.casualtyKnowledge.observe({observer,casualty,evidence,now:this.elapsed,delta});
      }
      this.casualtyKnowledge.markNotVisible(observer.id,visibleIds,this.elapsed);
    }
  }

  #ensureCasualtyReports(){
    for(const actor of this.game.actors){
      const assignment=actor.aiV2CasualtyAssignment;
      if(!assignment?.observe||this.scheduler.hasAction(actor.id,"ReportCasualty"))continue;
      const casualty=this.casualtyKnowledge.getBestPersonalCasualty(actor.id);
      if(!casualty?.currentlyVisible||casualty.confidence<(assignment.report?.minimumConfidence??52))continue;
      if(this.casualtyKnowledge.hasInitialReport(actor.teamId,actor.id,casualty.subjectId))continue;
      const action=new ReportCasualtyAction({actorId:actor.id,casualty,assignment});
      this.scheduler.start(action,{now:this.elapsed,context:this.#context(this.elapsed)});
    }
  }

  #ensureAuthoredObservationActions(){
    for(const actor of this.game.actors){
      const resolvedOutcome=this.encounterOutcomes.getLatest(actor.teamId);
      if(resolvedOutcome?.kind==="withdrew_without_reply"){
        const observe=this.scheduler.getAction(actor.id,"ObserveSector");
        if(observe&&observe.metadata?.provenance?.source==="authored_task")this.scheduler.cancelAction(actor.id,observe,{now:this.elapsed,reason:"encounter_resolved_by_withdrawal"});
        continue;
      }
      const directive=authoredObservationDirective(actor);
      if(!directive||this.scheduler.hasAction(actor.id,"ObserveSector"))continue;
      if(this.teamProcedures.getActorRole(actor.id))continue;
      const action=new ObserveSectorAction({actorId:actor.id,assignment:directive});
      this.scheduler.start(action,{now:this.elapsed,context:this.#context(this.elapsed)});
    }
  }

  #ensureContactReports(){
    for(const actor of this.game.actors){
      const assignment=actor.aiV2Assignment;
      if(!assignment||assignment.action!=="observe_sector")continue;
      if(this.scheduler.hasAction(actor.id,"ReportContact"))continue;
      const contact=this.personalKnowledge.getBestContact(actor.id);
      const minimumConfidence=assignment.report?.minimumConfidence??35;
      if(!contact?.currentlyVisible||contact.confidence<minimumConfidence)continue;
      if(this.teamKnowledge.hasInitialReportFrom(actor.teamId,actor.id))continue;
      const action=new ReportContactAction({actorId:actor.id,contact,assignment});
      this.scheduler.start(action,{now:this.elapsed,context:this.#context(this.elapsed)});
    }
  }

  #ensureContactUpdateReports(){
    for(const actor of this.game.actors){
      const assignment=actor.aiV2Assignment;
      if(!assignment||assignment.action!=="observe_sector")continue;
      if(this.scheduler.hasAction(actor.id,"ReportContact")||this.scheduler.hasAction(actor.id,"ReportContactUpdate"))continue;
      if(!this.teamKnowledge.hasInitialReportFrom(actor.teamId,actor.id))continue;
      const contact=this.personalKnowledge.getContacts(actor.id)
        .filter(candidate=>(candidate.track?.activityRevision??0)>0)
        .filter(candidate=>!this.teamKnowledge.hasActivityRevision(actor.teamId,actor.id,candidate.subjectId,candidate.track.activityRevision))
        .sort((a,b)=>(b.track?.lastActivityChangedAt??0)-(a.track?.lastActivityChangedAt??0))[0]??null;
      const revision=contact?.track?.activityRevision??0;
      if(!contact||revision<=0)continue;
      if(this.elapsed-(contact.track?.lastActivityChangedAt??0)<.2)continue;
      const action=new ReportContactUpdateAction({actorId:actor.id,contact,assignment});
      this.scheduler.start(action,{now:this.elapsed,context:this.#context(this.elapsed)});
    }
  }

  #context(now=this.elapsed){
    return{
      now,
      game:this.game,
      snapshot:this.snapshot,
      services:{
        attention:this.attention,
        communication:this.communication,
        personalKnowledge:this.personalKnowledge,
        teamKnowledge:this.teamKnowledge,
        heardCommunications:this.heardCommunications,
        casualtyKnowledge:this.casualtyKnowledge,
        casualtyCare:this.casualtyCare,
        teamMissions:this.teamMissions,
        teamEncounters:this.teamEncounters,
        encounterOutcomes:this.encounterOutcomes,
        teamResponses:this.teamResponses,
        teamProcedures:this.teamProcedures,
        roleActions:this.roleActions,
        rolePositions:this.rolePositions,
        positionQueries:this.positionQueries,
        destinationClaims:this.destinationClaims,
        locomotion:this.locomotion,
        visibleByObserver:this.visibleByObserver
      }
    };
  }

  #updateActorDiagnostics(){
    for(const actor of this.game.actors){
      const actions=this.scheduler.getActions(actor.id);
      const primary=this.scheduler.getPrimaryAction(actor.id);
      const observeAction=actions.find(action=>action.type==="ObserveSector")??null;
      const holdAction=actions.find(action=>action.type==="HoldReady")??null;
      const repositionAction=actions.find(action=>action.type==="RepositionForResponsibility")??null;
      const withdrawalAction=actions.find(action=>action.type==="WithdrawToRoute")??null;
      const warningAction=actions.find(action=>action.type==="IssueWarning")??null;
      const casualtyReportAction=actions.find(action=>action.type==="ReportCasualty")??null;
      const recoveryAction=actions.find(action=>["ApproachCasualty","AssessCasualty","DragCasualty","StabilizeCasualty"].includes(action.type))??null;
      const assignment=actor.aiV2Assignment??null;
      const contact=this.personalKnowledge.getBestContact(actor.id);
      const received=this.teamKnowledge.getBestReceivedContact(actor.id);
      const teamContact=this.teamKnowledge.getBestTeamContact(actor.teamId);
      const teamMission=this.teamMissions.get(actor.teamId);
      const encounter=this.teamEncounters.getBestTeamHypothesis(actor.teamId);
      const response=this.teamResponses.get(actor.teamId);
      const teamProcedure=this.teamProcedures.get(actor.teamId);
      const procedureRole=this.teamProcedures.getActorRole(actor.id);
      const roleAction=this.roleActions.get(actor.id);
      const rolePosition=this.rolePositions.get(actor.id);
      const reporting=warningAction??casualtyReportAction??actions.find(action=>action.type==="ReportContactUpdate")??actions.find(action=>action.type==="ReportContact")??null;
      const personalCasualty=this.casualtyKnowledge.getBestPersonalCasualty(actor.id);
      const receivedCasualty=this.casualtyKnowledge.getLatestReceived(actor.id);
      const teamCasualty=this.casualtyKnowledge.getBestTeamCasualty(actor.teamId);
      const sourceActor=received?this.game.actors.find(candidate=>candidate.id===received.sourceActorId):null;
      const heardWarning=this.heardCommunications.getLatestForActor(actor.id);
      const encounterOutcome=this.encounterOutcomes.getLatest(actor.teamId);
      if(!observeAction)actor.aiV2Observation=null;
      if(!holdAction)actor.aiV2HoldReady=null;
      actor.aiV2Debug={
        mission:teamMission?.title??assignment?.mission??actor.squadMission??null,
        missionObjective:teamMission?.objective??assignment?.mission??null,
        missionSuccessCondition:teamMission?.successCondition??null,
        task:roleAction?.reason??assignment?.task??teamMission?.immediateTask??actor.currentTask??null,
        procedure:teamProcedure?.label??assignment?.procedure??null,
        procedurePhase:teamProcedure?.phase?.label??assignment?.phase??null,
        role:procedureRole?.label??assignment?.role??null,
        procedureRole:procedureRole?{
          roleId:procedureRole.roleId,label:procedureRole.label,responsibility:procedureRole.responsibility,
          selectionReason:procedureRole.selectionReason,fulfillment:procedureRole.fulfillment?{...procedureRole.fulfillment}:null,
          procedureId:procedureRole.procedureId,procedureLabel:procedureRole.procedureLabel,
          phase:{...procedureRole.phase},permissions:{...procedureRole.permissions}
        }:null,
        roleAction:roleAction?{...roleAction,candidates:roleAction.candidates.map(candidate=>({...candidate}))}:null,
        primaryAction:primary?.type??"UNASSIGNED",
        activeActions:actions.map(action=>action.type),
        reposition:repositionAction?{
          status:"moving",progress:repositionAction.progress,destination:{...repositionAction.directive.destination},
          failureReason:repositionAction.directive.failureReason,roleId:repositionAction.directive.roleId,roleLabel:repositionAction.directive.roleLabel
        }:actor.aiV2Reposition?{...actor.aiV2Reposition,destination:actor.aiV2Reposition.destination?{...actor.aiV2Reposition.destination}:null}:null,
        withdrawal:withdrawalAction?{
          status:"moving",progress:withdrawalAction.progress,destination:{...withdrawalAction.directive.destination},
          routeLabel:withdrawalAction.directive.routeLabel,roleId:withdrawalAction.directive.roleId,roleLabel:withdrawalAction.directive.roleLabel,
          stageId:withdrawalAction.directive.phaseId
        }:actor.aiV2Withdrawal?{...actor.aiV2Withdrawal,destination:actor.aiV2Withdrawal.destination?{...actor.aiV2Withdrawal.destination}:null}:null,
        recovery:recoveryAction?{
          actionType:recoveryAction.type,
          status:actor.aiV2Recovery?.status??"active",
          phase:actor.aiV2Recovery?.phase??teamProcedure?.phase?.id??null,
          progress:recoveryAction.progress??actor.aiV2Recovery?.progress??0,
          casualtyId:recoveryAction.directive?.casualtyId??actor.aiV2Recovery?.casualtyId??null,
          destination:recoveryAction.directive?.destination?{...recoveryAction.directive.destination}:actor.aiV2Recovery?.destination?{...actor.aiV2Recovery.destination}:null,
          treatmentType:actor.aiV2Recovery?.treatmentType??null
        }:actor.aiV2Recovery?{...actor.aiV2Recovery,destination:actor.aiV2Recovery.destination?{...actor.aiV2Recovery.destination}:null}:null,
        personalCasualty:personalCasualty?{...personalCasualty,approximatePosition:{...personalCasualty.approximatePosition},assessment:personalCasualty.assessment?{...personalCasualty.assessment}:null}:null,
        receivedCasualty:receivedCasualty?{...receivedCasualty,approximatePosition:{...receivedCasualty.approximatePosition},assessment:receivedCasualty.assessment?{...receivedCasualty.assessment}:null}:null,
        teamCasualty:teamCasualty?{...teamCasualty,approximatePosition:{...teamCasualty.approximatePosition},assessment:teamCasualty.assessment?{...teamCasualty.assessment}:null}:null,
        positionRequirement:rolePosition?{
          ...rolePosition,acceptedPosition:rolePosition.acceptedPosition?{...rolePosition.acceptedPosition}:null,
          destination:rolePosition.destination?{...rolePosition.destination}:null,
          evaluation:rolePosition.evaluation?{...rolePosition.evaluation,reasons:[...(rolePosition.evaluation.reasons??[])]}:null
        }:null,
        actionId:primary?.id??null,
        actionReason:primary?.purpose??null,
        actionProvenance:primary?.metadata?.provenance?{...primary.metadata.provenance}:null,
        attentionSector:observeAction?.assignment?.sector?.label??holdAction?.directive?.label??assignment?.sector?.label??null,
        visibleContact:contact?.currentlyVisible?contact.subjectId:null,
        personalKnowledge:contact?{
          subjectId:contact.subjectId,classification:contact.classification,identity:contact.identity,level:contact.level,
          confidence:contact.confidence,currentlyVisible:contact.currentlyVisible,
          approximatePosition:{...contact.approximatePosition},lastObservedAt:contact.lastObservedAt,
          activity:contact.track?.currentActivity??null,activityLabel:contact.track?.activityLabel??null,
          activityRevision:contact.track?.activityRevision??0,movementDirection:contact.track?.movementDirection??null,
          previousApproximatePosition:contact.track?.previousApproximatePosition?{...contact.track.previousApproximatePosition}:null,
          intentHypothesis:contact.track?.intentHypothesis?{...contact.track.intentHypothesis}:null
        }:null,
        communication:reporting?{
          status:reporting.type==="IssueWarning"?"issuing_warning":reporting.type==="ReportCasualty"?"reporting_casualty":reporting.type==="ReportContactUpdate"?"transmitting_update":"transmitting",
          reportKind:reporting.type==="IssueWarning"?"directed_warning":reporting.type==="ReportCasualty"?"casualty_initial":reporting.type==="ReportContactUpdate"?"activity_update":"initial_contact",
          method:reporting.transmission?.method??(reporting.type==="IssueWarning"?"raised_voice":"local_voice"),progress:reporting.progress,
          recipientIds:[...(reporting.transmission?.recipientIds??[])],subjectId:reporting.contactSnapshot?.subjectId??reporting.casualtySnapshot?.subjectId??reporting.directive?.subjectId??null,
          activity:reporting.contactSnapshot?.activity??null,activityRevision:reporting.contactSnapshot?.activityRevision??0,
          message:reporting.directive?.message??null,targetPoint:reporting.directive?.targetPoint?{...reporting.directive.targetPoint}:null
        }:actor.aiV2Communication?{...actor.aiV2Communication,recipientIds:[...(actor.aiV2Communication.recipientIds??[])]}:null,
        heardWarning:heardWarning?{...heardWarning,targetPoint:heardWarning.targetPoint?{...heardWarning.targetPoint}:null,approximateSourcePosition:heardWarning.approximateSourcePosition?{...heardWarning.approximateSourcePosition}:null,recipientIds:[...(heardWarning.recipientIds??[])]}:null,
        receivedKnowledge:received?{
          reportId:received.id,subjectId:received.subjectId,classification:received.classification,identity:received.identity,
          confidence:received.confidence,approximatePosition:{...received.approximatePosition},sourceActorId:received.sourceActorId,
          sourceName:sourceActor?.name??received.sourceActorId,method:received.method,reportedAt:received.reportedAt,independentlyConfirmed:false,
          reportKind:received.reportKind,activity:received.activity??null,activityLabel:received.activityLabel??null,
          activityRevision:received.activityRevision??0,intentHypothesis:received.intentHypothesis?{...received.intentHypothesis}:null
        }:null,
        teamKnowledge:teamContact?{
          reportId:teamContact.id,subjectId:teamContact.subjectId,confidence:teamContact.confidence,
          approximatePosition:{...teamContact.approximatePosition},previousApproximatePosition:teamContact.previousApproximatePosition?{...teamContact.previousApproximatePosition}:null,
          sourceActorId:teamContact.sourceActorId,recipientIds:[...teamContact.recipientIds],independentlyConfirmed:false,
          reportKind:teamContact.reportKind,activity:teamContact.activity??null,activityLabel:teamContact.activityLabel??null,
          activityRevision:teamContact.activityRevision??0,intentHypothesis:teamContact.intentHypothesis?{...teamContact.intentHypothesis}:null
        }:null,
        encounter:encounter?{
          state:encounter.state,missionRelevance:encounter.missionRelevance,relevanceScore:encounter.relevanceScore,
          reason:encounter.reason,reportConfidence:encounter.reportConfidence,reportAge:encounter.reportAge,
          identity:encounter.identity,intent:encounter.intent,intentHypothesis:encounter.intentHypothesis?{...encounter.intentHypothesis}:null,
          activity:encounter.activity??null,activityLabel:encounter.activityLabel??null,activityRevision:encounter.activityRevision??0,
          interferenceLabel:encounter.interferenceLabel,response:response?.selected?.id??null,
          warningHeard:Boolean(encounter.warningHeard),warningIssued:Boolean(encounter.warningIssued),departureObserved:Boolean(encounter.departureObserved),departureObservedAfterWarning:Boolean(encounter.departureObservedAfterWarning),
          subjectKind:encounter.subjectKind??"external_contact",casualty:encounter.casualty?{...encounter.casualty,treatmentNeed:encounter.casualty.treatmentNeed?{...encounter.casualty.treatmentNeed}:null}:null
        }:null,
        teamResponse:response?{
          id:response.selected.id,label:response.selected.label,score:response.selected.score,reason:response.selected.reason,
          selectedAt:response.selectedAt,candidates:response.candidates.map(candidate=>({id:candidate.id,label:candidate.label,score:candidate.score})),
          ledger:{...response.ledger,responseBias:{...(response.ledger?.responseBias??{})}},procedure:teamProcedure?.procedureId??null
        }:null,
        teamProcedure:teamProcedure?{
          id:teamProcedure.procedureId,label:teamProcedure.label,phase:{...teamProcedure.phase},permissions:{...teamProcedure.permissions},
          reassessmentTriggers:[...teamProcedure.reassessmentTriggers],roles:teamProcedure.roles.map(role=>({...role,fulfillment:role.fulfillment?{...role.fulfillment}:null}))
        }:null,
        encounterOutcome:encounterOutcome?{...encounterOutcome,facts:[...encounterOutcome.facts],evidence:[...encounterOutcome.evidence]}:null,
        runtimeStage:"casualty_recovery_stabilization"
      };
    }
  }
}
