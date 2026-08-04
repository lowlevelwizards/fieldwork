import { ActionScheduler } from "../actions/action-scheduler.js";
import { ObserveSectorAction } from "../actions/observe-sector-action.js";
import { ReportContactAction } from "../actions/report-contact-action.js";
import { ReportContactUpdateAction } from "../actions/report-contact-update-action.js";
import { ReportCasualtyAction } from "../actions/report-casualty-action.js";
import { ActorInitiativeRuntime } from "../actors/actor-initiative-runtime.js";
import { RoleActionRuntime } from "../actors/role-action-runtime.js";
import { RolePositionRuntime } from "../actors/role-position-runtime.js";
import { DefensivePositionRuntime } from "../actors/defensive-position-runtime.js";
import { CommunicationExecutor } from "../communication/communication-executor.js";
import { DecisionLog } from "../diagnostics/decision-log.js";
import { InvariantMonitor } from "../diagnostics/invariant-monitor.js";
import { getAIV2DebugDetails, getAIV2DebugSummary, updateAIV2ActorDiagnostics } from "../diagnostics/ai-debug-projection.js";
import { TeamEncounterMemory } from "../encounters/team-encounter-memory.js";
import { EncounterOutcomeMemory } from "../encounters/encounter-outcome-memory.js";
import { AttentionExecutor } from "../execution/attention-executor.js";
import { LocomotionExecutor } from "../execution/locomotion-executor.js";
import { CasualtyCareExecutor } from "../execution/casualty-care-executor.js";
import { FireExecutor } from "../execution/fire-executor.js";
import { PersonalKnowledgeStore } from "../knowledge/personal-knowledge.js";
import { TeamKnowledgeStore } from "../knowledge/team-knowledge.js";
import { HeardCommunicationStore } from "../knowledge/heard-communication.js";
import { CasualtyKnowledgeStore } from "../knowledge/casualty-knowledge.js";
import { ThreatKnowledgeStore } from "../knowledge/threat-knowledge.js";
import { TeamMissionStore } from "../missions/team-mission.js";
import { TeamAgendaState } from "../missions/team-agenda-state.js";
import { ObjectiveStateStore } from "../objectives/objective-state-store.js";
import { ObjectiveApproachService } from "../objectives/objective-approach-service.js";
import { TeamProcedureState } from "../procedures/team-procedure-state.js";
import { DestinationClaimService } from "../position/destination-claim-service.js";
import { PositionQueryService } from "../position/position-query-service.js";
import { DirectionalCoverService } from "../position/directional-cover-service.js";
import { PositionSlotClaimService } from "../position/position-slot-claim-service.js";
import { EvacuationRouteService } from "../position/evacuation-route-service.js";
import { TeamResponseState } from "../responses/team-response-state.js";
import { evaluateCasualtyObservation } from "../senses/casualty-observation.js";
import { AmbientPerceptionRuntime } from "../senses/ambient-perception-runtime.js";
import { captureWorldSnapshot } from "./world-snapshot.js";

export const AI_RUNTIME_MODES=Object.freeze({LEGACY:"legacy",V2:"v2"});

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

function preferredAmbientReporter(game,teamId){
  return(game?.actors??[])
    .filter(actor=>actor.teamId===teamId&&!actor.medical?.dead&&!actor.medical?.unconscious)
    .sort((left,right)=>(Number(right.aiV2Capabilities?.observation)||0)-(Number(left.aiV2Capabilities?.observation)||0)||String(left.id).localeCompare(String(right.id)))[0]??null;
}

export class AIV2Runtime{
  constructor(game){
    this.game=game;
    this.elapsed=0;
    this.snapshotAccumulator=0;
    this.snapshotInterval=.25;
    this.decisionLog=new DecisionLog({limit:1400});
    this.invariants=new InvariantMonitor({decisionLog:this.decisionLog});
    this.scheduler=new ActionScheduler({decisionLog:this.decisionLog});
    this.personalKnowledge=new PersonalKnowledgeStore({decisionLog:this.decisionLog});
    this.teamKnowledge=new TeamKnowledgeStore({decisionLog:this.decisionLog});
    this.heardCommunications=new HeardCommunicationStore({decisionLog:this.decisionLog});
    this.casualtyKnowledge=new CasualtyKnowledgeStore({decisionLog:this.decisionLog});
    this.threatKnowledge=new ThreatKnowledgeStore({decisionLog:this.decisionLog});
    this.teamMissions=new TeamMissionStore();
    this.teamEncounters=new TeamEncounterMemory({decisionLog:this.decisionLog});
    this.encounterOutcomes=new EncounterOutcomeMemory({decisionLog:this.decisionLog});
    this.teamResponses=new TeamResponseState({decisionLog:this.decisionLog});
    this.teamAgenda=new TeamAgendaState({decisionLog:this.decisionLog});
    this.teamProcedures=new TeamProcedureState({decisionLog:this.decisionLog});
    this.objectives=new ObjectiveStateStore({decisionLog:this.decisionLog});
    this.objectiveApproaches=new ObjectiveApproachService({decisionLog:this.decisionLog});
    this.ambientPerception=new AmbientPerceptionRuntime({decisionLog:this.decisionLog});
    this.initiative=new ActorInitiativeRuntime({scheduler:this.scheduler,threatKnowledge:this.threatKnowledge,decisionLog:this.decisionLog});
    this.roleActions=new RoleActionRuntime({scheduler:this.scheduler,decisionLog:this.decisionLog});
    this.positionQueries=new PositionQueryService();
    this.directionalCover=new DirectionalCoverService();
    this.evacuationRoutes=new EvacuationRouteService({decisionLog:this.decisionLog});
    this.destinationClaims=new DestinationClaimService({decisionLog:this.decisionLog});
    this.positionSlots=new PositionSlotClaimService({decisionLog:this.decisionLog});
    this.rolePositions=new RolePositionRuntime({scheduler:this.scheduler,positionQueries:this.positionQueries,destinationClaims:this.destinationClaims,decisionLog:this.decisionLog});
    this.defensivePositions=new DefensivePositionRuntime({scheduler:this.scheduler,directionalCover:this.directionalCover,positionSlots:this.positionSlots,decisionLog:this.decisionLog});
    this.attention=new AttentionExecutor();
    this.locomotion=new LocomotionExecutor();
    this.casualtyCare=new CasualtyCareExecutor();
    this.fire=new FireExecutor();
    this.communication=new CommunicationExecutor();
    this.visibleByObserver=new Map();
    this.consumedThreatEvents=new Set();
    this.objectives.syncFromGame(game);
    this.snapshot=captureWorldSnapshot(game,{elapsed:0});
    this.invariants.inspect(this.snapshot,{now:0,procedures:[],roleActions:[]});
    this.decisionLog.record({type:"runtime_started",time:0,data:{mode:"v2",stage:"objective_affordances_mission_initiative",scenario:game.scenarioMode}});
  }

  update(delta){
    this.elapsed+=delta;
    this.visibleByObserver=new Map();
    this.objectives.syncFromGame(this.game);
    this.teamMissions.syncFromGame(this.game);
    this.#consumeThreatEvents();
    this.#updateCasualtyObservations(delta);
    this.#ensureAuthoredObservationActions();
    this.ambientPerception.update(delta,{
      game:this.game,
      missions:this.teamMissions,
      personalKnowledge:this.personalKnowledge,
      visibleByObserver:this.visibleByObserver,
      now:this.elapsed
    });
    this.initiative.update({
      game:this.game,
      teamKnowledge:this.teamKnowledge,
      now:this.elapsed,
      context:this.#context(this.elapsed)
    });
    this.scheduler.update(delta,{now:this.elapsed,context:this.#context(this.elapsed)});
    this.personalKnowledge.update(delta,{now:this.elapsed,visibleByObserver:this.visibleByObserver});
    this.teamKnowledge.update(delta,{now:this.elapsed});
    this.threatKnowledge.update(delta,{now:this.elapsed});
    this.#ensureContactReports();
    this.#ensureContactUpdateReports();
    this.#ensureCasualtyReports();
    this.teamEncounters.update({missions:this.teamMissions,teamKnowledge:this.teamKnowledge,casualtyKnowledge:this.casualtyKnowledge,heardCommunications:this.heardCommunications,now:this.elapsed});
    this.teamResponses.update({missions:this.teamMissions,teamEncounters:this.teamEncounters,encounterOutcomes:this.encounterOutcomes,now:this.elapsed});
    this.teamAgenda.update({missions:this.teamMissions,teamResponses:this.teamResponses,objectives:this.objectives,now:this.elapsed});
    this.teamProcedures.update({game:this.game,teamResponses:this.teamAgenda,now:this.elapsed});
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
    this.defensivePositions.update({
      game:this.game,
      teamProcedures:this.teamProcedures,
      teamMissions:this.teamMissions,
      teamEncounters:this.teamEncounters,
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
      defensivePositions:this.defensivePositions.summary(),
      destinationClaims:this.destinationClaims.summary(this.elapsed),
      positionSlots:this.positionSlots.summary(this.elapsed),
      patientClaims:this.casualtyCare.summary(),
      scheduler:this.scheduler
    });
  }

  getDebugSummary(){return getAIV2DebugSummary(this);}
  getDebugDetails(){return getAIV2DebugDetails(this);}

  #consumeThreatEvents(){
    for(const event of this.game.aiV2ThreatEvents??[]){
      if(!event?.id||this.consumedThreatEvents.has(event.id))continue;
      this.consumedThreatEvents.add(event.id);
      this.threatKnowledge.observeEvent({event,game:this.game,now:this.elapsed});
      this.decisionLog.record({
        type:"physical_threat_event_consumed",
        time:this.elapsed,
        actorId:event.targetActorId,
        data:{eventId:event.id,eventKind:event.kind??"incoming_fire"}
      });
    }
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
        if(observe&&observe.metadata?.provenance?.source==="authored_task")this.scheduler.cancelAction(actor.id,observe,{now:this.elapsed,reason:"encounter_resolved_by_withdrawal",context:this.#context(this.elapsed)});
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
      if(this.scheduler.hasAction(actor.id,"ReportContact"))continue;
      const authored=actor.aiV2Assignment?.action==="observe_sector"?actor.aiV2Assignment:null;
      const mission=this.teamMissions.get(actor.teamId);
      const policy=mission?.contactPolicy??null;
      if(!authored&&policy?.passiveVision){
        const reporter=preferredAmbientReporter(this.game,actor.teamId);
        if(reporter?.id!==actor.id||this.teamKnowledge.hasInitialReportFrom(actor.teamId,actor.id))continue;
      }
      const assignment=authored??(policy?.passiveVision?{
        task:mission?.immediateTask??actor.currentTask,
        report:{...policy.report}
      }:null);
      if(!assignment)continue;
      const minimumConfidence=assignment.report?.minimumConfidence??35;
      const contact=this.personalKnowledge.getContacts(actor.id)
        .filter(candidate=>candidate.currentlyVisible&&candidate.confidence>=minimumConfidence)
        .filter(candidate=>!this.teamKnowledge.hasReportFrom(actor.teamId,actor.id,candidate.subjectId))[0]??null;
      if(!contact)continue;
      const action=new ReportContactAction({actorId:actor.id,contact,assignment});
      this.scheduler.start(action,{now:this.elapsed,context:this.#context(this.elapsed)});
    }
  }

  #ensureContactUpdateReports(){
    for(const actor of this.game.actors){
      const authored=actor.aiV2Assignment?.action==="observe_sector"?actor.aiV2Assignment:null;
      const mission=this.teamMissions.get(actor.teamId);
      const policy=mission?.contactPolicy??null;
      if(!authored&&policy?.passiveVision){
        const reporter=preferredAmbientReporter(this.game,actor.teamId);
        if(reporter?.id!==actor.id)continue;
      }
      const assignment=authored??(policy?.passiveVision?{
        task:mission?.immediateTask??actor.currentTask,
        report:{...policy.report}
      }:null);
      if(!assignment)continue;
      if(this.scheduler.hasAction(actor.id,"ReportContact")||this.scheduler.hasAction(actor.id,"ReportContactUpdate"))continue;
      const contact=this.personalKnowledge.getContacts(actor.id)
        .filter(candidate=>(candidate.track?.activityRevision??0)>0)
        .filter(candidate=>this.teamKnowledge.hasReportFrom(actor.teamId,actor.id,candidate.subjectId))
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
        threatKnowledge:this.threatKnowledge,
        casualtyCare:this.casualtyCare,
        fire:this.fire,
        teamMissions:this.teamMissions,
        teamEncounters:this.teamEncounters,
        encounterOutcomes:this.encounterOutcomes,
        teamResponses:this.teamResponses,
        teamAgenda:this.teamAgenda,
        ambientPerception:this.ambientPerception,
        teamProcedures:this.teamProcedures,
        objectives:this.objectives,
        objectiveApproaches:this.objectiveApproaches,
        roleActions:this.roleActions,
        rolePositions:this.rolePositions,
        defensivePositions:this.defensivePositions,
        positionQueries:this.positionQueries,
        directionalCover:this.directionalCover,
        evacuationRoutes:this.evacuationRoutes,
        destinationClaims:this.destinationClaims,
        positionSlots:this.positionSlots,
        locomotion:this.locomotion,
        visibleByObserver:this.visibleByObserver
      }
    };
  }

  #updateActorDiagnostics(){updateAIV2ActorDiagnostics(this);}
}
