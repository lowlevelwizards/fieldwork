import { ActionScheduler } from "../actions/action-scheduler.js";
import { ObserveSectorAction } from "../actions/observe-sector-action.js";
import { ReportContactAction } from "../actions/report-contact-action.js";
import { ReportContactUpdateAction } from "../actions/report-contact-update-action.js";
import { ReportCasualtyAction } from "../actions/report-casualty-action.js";
import { ActorInitiativeRuntime } from "../actors/actor-initiative-runtime.js";
import { UnifiedActorBrain } from "../actors/unified-actor-brain.js";
import { ActorTacticalPictureService } from "../actors/actor-tactical-picture-service.js";
import { ActorObligationStore } from "../actors/actor-obligation-store.js";
import { ActorTacticalDeliberationRuntime } from "../actors/actor-tactical-deliberation-runtime.js";
import { ActorTacticalCommitmentStore } from "../actors/actor-tactical-commitment-store.js";
import { ActorUtilityEvaluationService } from "../actors/actor-utility-evaluation-service.js";
import { RoleActionRuntime } from "../actors/role-action-runtime.js";
import { ConcernFulfillmentRuntime } from "../actors/concern-fulfillment-runtime.js";
import { LocalAutonomyRuntime } from "../actors/local-autonomy-runtime.js";
import { OperationalTravelRuntime } from "../actors/operational-travel-runtime.js";
import { RolePositionRuntime } from "../actors/role-position-runtime.js";
import { DefensivePositionRuntime } from "../actors/defensive-position-runtime.js";
import { ContactResolutionRuntime } from "../actors/contact-resolution-runtime.js";
import { CommunicationExecutor } from "../communication/communication-executor.js";
import { DecisionLog } from "../diagnostics/decision-log.js";
import { BehavioralTruthMonitor } from "../diagnostics/behavioral-truth-monitor.js";
import { InvariantMonitor } from "../diagnostics/invariant-monitor.js";
import { getAIV2DebugDetails, getAIV2DebugSummary, updateAIV2ActorDiagnostics } from "../diagnostics/ai-debug-projection.js";
import { TeamEncounterMemory } from "../encounters/team-encounter-memory.js";
import { TeamConcernBoard } from "../decisions/team-concern-board.js";
import { TeamConcernStaffingService } from "../decisions/team-concern-staffing-service.js";
import { EncounterOutcomeMemory } from "../encounters/encounter-outcome-memory.js";
import { AttentionExecutor } from "../execution/attention-executor.js";
import { LocomotionExecutor } from "../execution/locomotion-executor.js";
import { CasualtyCareExecutor } from "../execution/casualty-care-executor.js";
import { FireExecutor } from "../execution/fire-executor.js";
import { PersonalKnowledgeStore } from "../knowledge/personal-knowledge.js";
import { TeamKnowledgeStore } from "../knowledge/team-knowledge.js";
import { TeamContactUnderstandingStore } from "../knowledge/team-contact-understanding.js";
import { HeardCommunicationStore } from "../knowledge/heard-communication.js";
import { CasualtyKnowledgeStore } from "../knowledge/casualty-knowledge.js";
import { ThreatKnowledgeStore } from "../knowledge/threat-knowledge.js";
import { TeamMissionStore } from "../missions/team-mission.js";
import { TeamAgendaState } from "../missions/team-agenda-state.js";
import { ActorActionArbiter, ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
import { ObjectiveStateStore } from "../objectives/objective-state-store.js";
import { ObjectiveApproachService } from "../objectives/objective-approach-service.js";
import { TeamProcedureState } from "../procedures/team-procedure-state.js";
import { DestinationClaimService } from "../position/destination-claim-service.js";
import { PositionQueryService } from "../position/position-query-service.js";
import { DirectionalCoverService } from "../position/directional-cover-service.js";
import { FiringEdgeQueryService } from "../position/firing-edge-query-service.js";
import { PositionSlotClaimService } from "../position/position-slot-claim-service.js";
import { SpatialIntentFieldService } from "../position/spatial-intent-field-service.js";
import { EvacuationRouteService } from "../position/evacuation-route-service.js";
import { TeamResponseState } from "../responses/team-response-state.js";
import { TeamRelationshipService } from "../relationships/team-relationship-service.js";
import { TeamInteractionRuntime } from "../interactions/team-interaction-runtime.js";
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
    this.decisionLog=new DecisionLog({limit:8000});
    this.invariants=new InvariantMonitor({decisionLog:this.decisionLog});
    this.scheduler=new ActionScheduler({decisionLog:this.decisionLog});
    this.actionArbiter=new ActorActionArbiter({scheduler:this.scheduler,decisionLog:this.decisionLog});
    this.actorBrain=new UnifiedActorBrain({scheduler:this.scheduler,arbiter:this.actionArbiter,decisionLog:this.decisionLog});
    this.personalKnowledge=new PersonalKnowledgeStore({decisionLog:this.decisionLog});
    this.teamKnowledge=new TeamKnowledgeStore({decisionLog:this.decisionLog});
    this.relationships=new TeamRelationshipService({decisionLog:this.decisionLog});
    this.teamUnderstanding=new TeamContactUnderstandingStore({decisionLog:this.decisionLog});
    this.teamInteractions=new TeamInteractionRuntime({decisionLog:this.decisionLog});
    this.heardCommunications=new HeardCommunicationStore({decisionLog:this.decisionLog});
    this.casualtyKnowledge=new CasualtyKnowledgeStore({decisionLog:this.decisionLog});
    this.threatKnowledge=new ThreatKnowledgeStore({decisionLog:this.decisionLog});
    this.teamMissions=new TeamMissionStore();
    this.teamEncounters=new TeamEncounterMemory({decisionLog:this.decisionLog});
    this.encounterOutcomes=new EncounterOutcomeMemory({decisionLog:this.decisionLog});
    this.teamResponses=new TeamResponseState({decisionLog:this.decisionLog});
    this.teamAgenda=new TeamAgendaState({decisionLog:this.decisionLog});
    this.teamProcedures=new TeamProcedureState({decisionLog:this.decisionLog});
    this.teamConcerns=new TeamConcernBoard({decisionLog:this.decisionLog});
    this.concernStaffing=new TeamConcernStaffingService({decisionLog:this.decisionLog});
    this.actorObligations=new ActorObligationStore({decisionLog:this.decisionLog});
    this.spatialIntentFields=new SpatialIntentFieldService({decisionLog:this.decisionLog});
    this.objectives=new ObjectiveStateStore({decisionLog:this.decisionLog});
    this.objectiveApproaches=new ObjectiveApproachService({decisionLog:this.decisionLog});
    this.ambientPerception=new AmbientPerceptionRuntime({decisionLog:this.decisionLog});
    this.initiative=new ActorInitiativeRuntime({scheduler:this.scheduler,threatKnowledge:this.threatKnowledge,decisionLog:this.decisionLog,brain:this.actorBrain});
    this.roleActions=new RoleActionRuntime({scheduler:this.scheduler,decisionLog:this.decisionLog,brain:this.actorBrain});
    this.concernFulfillment=new ConcernFulfillmentRuntime({brain:this.actorBrain,spatialIntentFields:this.spatialIntentFields,decisionLog:this.decisionLog});
    this.localAutonomy=new LocalAutonomyRuntime({scheduler:this.scheduler,brain:this.actorBrain,decisionLog:this.decisionLog});
    this.operationalTravel=new OperationalTravelRuntime({scheduler:this.scheduler,brain:this.actorBrain,decisionLog:this.decisionLog});
    this.positionQueries=new PositionQueryService();
    this.directionalCover=new DirectionalCoverService();
    this.firingEdges=new FiringEdgeQueryService();
    this.positionSlots=new PositionSlotClaimService({decisionLog:this.decisionLog});
    this.tacticalCommitments=new ActorTacticalCommitmentStore({decisionLog:this.decisionLog});
    this.utilityEvaluation=new ActorUtilityEvaluationService({decisionLog:this.decisionLog});
    this.tacticalPictures=new ActorTacticalPictureService({directionalCover:this.directionalCover,firingEdges:this.firingEdges,positionSlots:this.positionSlots,decisionLog:this.decisionLog});
    this.tacticalDeliberation=new ActorTacticalDeliberationRuntime({brain:this.actorBrain,commitments:this.tacticalCommitments,utilityEvaluation:this.utilityEvaluation,positionSlots:this.positionSlots,decisionLog:this.decisionLog});
    this.evacuationRoutes=new EvacuationRouteService({decisionLog:this.decisionLog});
    this.destinationClaims=new DestinationClaimService({decisionLog:this.decisionLog});
    this.rolePositions=new RolePositionRuntime({scheduler:this.scheduler,positionQueries:this.positionQueries,destinationClaims:this.destinationClaims,brain:this.actorBrain,decisionLog:this.decisionLog});
    this.defensivePositions=new DefensivePositionRuntime({scheduler:this.scheduler,directionalCover:this.directionalCover,positionSlots:this.positionSlots,brain:this.actorBrain,decisionLog:this.decisionLog});
    this.contactResolution=new ContactResolutionRuntime({scheduler:this.scheduler,brain:this.actorBrain,decisionLog:this.decisionLog});
    this.attention=new AttentionExecutor();
    this.locomotion=new LocomotionExecutor();
    this.casualtyCare=new CasualtyCareExecutor();
    this.fire=new FireExecutor();
    this.communication=new CommunicationExecutor();
    this.behavioralTruth=new BehavioralTruthMonitor();
    this.visibleByObserver=new Map();
    this.consumedThreatEvents=new Set();
    this.objectives.syncFromGame(game);
    this.snapshot=captureWorldSnapshot(game,{elapsed:0});
    this.invariants.inspect(this.snapshot,{now:0,procedures:[],roleActions:[]});
    this.decisionLog.record({type:"runtime_started",time:0,data:{mode:"v2",stage:"3.1G_persistent_actor_obligations",scenario:game.scenarioMode}});
  }

  update(delta){
    this.elapsed+=delta;
    for(const actor of this.game?.actors??[])actor.aiV2Suppression=Math.max(0,Number(actor.aiV2Suppression??0)-Math.max(0,delta)*(actor.aiV2ThreatReaction?.status==="moving_to_cover"?2.5:5.5));
    this.visibleByObserver=new Map();
    this.objectives.syncFromGame(this.game);
    this.teamMissions.syncFromGame(this.game);
    this.actorBrain.beginFrame({now:this.elapsed,context:this.#context(this.elapsed)});
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
      tacticalPictures:this.tacticalPictures,
      now:this.elapsed,
      context:this.#context(this.elapsed)
    });
    this.scheduler.update(delta,{now:this.elapsed,context:this.#context(this.elapsed)});
    // Live operations can complete a terminal procedure phase during the scheduler
    // update. Capture it before response/procedure reevaluation can replace the
    // governing procedure in the same frame. Behavior Lab keeps its historical
    // deterministic ordering.
    if(this.game?.livingSandbox?.liveMode)this.encounterOutcomes.update({
      game:this.game,
      teamProcedures:this.teamProcedures,
      teamEncounters:this.teamEncounters,
      heardCommunications:this.heardCommunications,
      casualtyKnowledge:this.casualtyKnowledge,
      now:this.elapsed
    });
    this.personalKnowledge.update(delta,{now:this.elapsed,visibleByObserver:this.visibleByObserver});
    this.teamKnowledge.update(delta,{now:this.elapsed});
    this.threatKnowledge.update(delta,{now:this.elapsed});
    this.#ensureContactReports();
    this.#ensureContactUpdateReports();
    this.#ensureCasualtyReports();
    this.relationships.update({game:this.game,now:this.elapsed});
    const liveTeamSocial=Boolean(this.game?.livingSandbox?.liveMode);
    if(liveTeamSocial){
      this.teamUnderstanding.update({game:this.game,teamKnowledge:this.teamKnowledge,personalKnowledge:this.personalKnowledge,relationships:this.relationships,now:this.elapsed});
      this.teamInteractions.update({game:this.game,understanding:this.teamUnderstanding,relationships:this.relationships,teamMissions:this.teamMissions,now:this.elapsed});
    }
    this.teamEncounters.update({game:this.game,missions:this.teamMissions,teamKnowledge:this.teamKnowledge,teamUnderstanding:liveTeamSocial?this.teamUnderstanding:null,casualtyKnowledge:this.casualtyKnowledge,heardCommunications:this.heardCommunications,teamProcedures:this.teamProcedures,now:this.elapsed});
    this.teamResponses.update({missions:this.teamMissions,teamEncounters:this.teamEncounters,encounterOutcomes:this.encounterOutcomes,teamProcedures:this.teamProcedures,now:this.elapsed});
    this.teamAgenda.update({missions:this.teamMissions,teamResponses:this.teamResponses,objectives:this.objectives,now:this.elapsed});
    this.teamProcedures.update({game:this.game,teamResponses:this.teamAgenda,now:this.elapsed});
    this.teamConcerns.update({
      game:this.game,missions:this.teamMissions,teamEncounters:this.teamEncounters,teamResponses:this.teamResponses,
      teamAgenda:this.teamAgenda,teamProcedures:this.teamProcedures,casualtyKnowledge:this.casualtyKnowledge,
      threatKnowledge:this.threatKnowledge,objectives:this.objectives,encounterOutcomes:this.encounterOutcomes,now:this.elapsed
    });
    this.concernStaffing.update({game:this.game,teamConcerns:this.teamConcerns,teamProcedures:this.teamProcedures,now:this.elapsed});
    this.actorObligations.syncSources({game:this.game,teamConcerns:this.teamConcerns,concernStaffing:this.concernStaffing,now:this.elapsed});
    this.concernFulfillment.update({game:this.game,teamConcerns:this.teamConcerns,concernStaffing:this.concernStaffing,actorObligations:this.actorObligations,teamProcedures:this.teamProcedures,now:this.elapsed});
    this.tacticalPictures.update({game:this.game,personalKnowledge:this.personalKnowledge,teamKnowledge:this.teamKnowledge,threatKnowledge:this.threatKnowledge,teamProcedures:this.teamProcedures,teamAgenda:this.teamAgenda,now:this.elapsed});
    this.tacticalDeliberation.update({game:this.game,tacticalPictures:this.tacticalPictures,teamProcedures:this.teamProcedures,teamAgenda:this.teamAgenda,actorObligations:this.actorObligations,now:this.elapsed});
    this.contactResolution.update({game:this.game,teamResponses:this.teamResponses,teamEncounters:this.teamEncounters,teamProcedures:this.teamProcedures,now:this.elapsed});
    this.operationalTravel.update({game:this.game,teamAgenda:this.teamAgenda,teamProcedures:this.teamProcedures,now:this.elapsed,context:this.#context(this.elapsed)});
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
    this.localAutonomy.update({game:this.game,teamProcedures:this.teamProcedures,teamAgenda:this.teamAgenda,teamInteractions:liveTeamSocial?this.teamInteractions:null,roleActions:this.roleActions,now:this.elapsed});
    this.actorBrain.resolve({now:this.elapsed,context:this.#context(this.elapsed)});
    this.actorObligations.reconcileExecution({game:this.game,scheduler:this.scheduler,now:this.elapsed});
    this.positionSlots.reconcileExecution?.({scheduler:this.scheduler,now:this.elapsed});
    this.behavioralTruth.update(delta,{game:this.game,scheduler:this.scheduler,teamConcerns:this.teamConcerns,threatKnowledge:this.threatKnowledge,now:this.elapsed});
    this.#updateActorDiagnostics();

    this.snapshotAccumulator+=delta;
    if(this.snapshotAccumulator<this.snapshotInterval)return;
    this.snapshotAccumulator%=this.snapshotInterval;
    this.snapshot=captureWorldSnapshot(this.game,{elapsed:this.elapsed});
    this.invariants.inspect(this.snapshot,{
      now:this.elapsed,
      procedures:this.teamProcedures.summary(),
      roleActions:this.roleActions.summary(),
      operationalTravel:this.operationalTravel.summary(),
      rolePositions:this.rolePositions.summary(),
      defensivePositions:this.defensivePositions.summary(),
      destinationClaims:this.destinationClaims.summary(this.elapsed),
      positionSlots:this.positionSlots.summary(this.elapsed),
      patientClaims:this.casualtyCare.summary(),
      scheduler:this.scheduler,
      actionArbiter:this.actionArbiter?.summary?.()??[],
      actorBrain:this.actorBrain?.summary?.()??[],
      concernStaffing:this.concernStaffing?.summary?.()??[],
      actorObligations:this.actorObligations?.summary?.()??[],
      concernFulfillment:this.concernFulfillment?.summary?.()??[]
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
      this.actorBrain.submit({
        actorId:actor.id,action,score:.72,urgency:.64,
        authorityTier:ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN,
        authorityLabel:"Casualty communication",
        reason:action.purpose,source:"runtime_casualty_report",
        concernId:`casualty:${casualty.subjectId}`,desiredEffect:"establish_shared_casualty_awareness",
        operationId:actor.operationId??null,missionId:actor.squadMission??null
      });
    }
  }

  #ensureAuthoredObservationActions(){
    for(const actor of this.game.actors){
      const resolvedOutcome=this.encounterOutcomes.getLatest(actor.teamId);
      if(resolvedOutcome?.kind==="withdrew_without_reply"){
        const observe=this.scheduler.getAction(actor.id,"ObserveSector");
        if(observe&&observe.metadata?.provenance?.source==="authored_task")this.actorBrain.requestCancel(actor.id,observe,{reason:"encounter_resolved_by_withdrawal"});
        continue;
      }
      const directive=authoredObservationDirective(actor);
      if(!directive||this.scheduler.hasAction(actor.id,"ObserveSector"))continue;
      if(this.teamProcedures.getActorRole(actor.id))continue;
      const action=new ObserveSectorAction({actorId:actor.id,assignment:directive});
      this.actorBrain.submit({
        actorId:actor.id,action,score:.58,urgency:.24,
        authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,
        authorityLabel:"Authored observation responsibility",
        reason:action.purpose,source:"runtime_authored_observation",
        desiredEffect:"maintain_authored_observation_sector",
        operationId:actor.operationId??null,missionId:actor.squadMission??null
      });
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
      this.actorBrain.submit({
        actorId:actor.id,action,score:.78,urgency:.7,
        authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,
        authorityLabel:"Contact communication",
        reason:action.purpose,source:"runtime_contact_report",
        concernId:`contact:${contact.subjectId}`,desiredEffect:"establish_shared_contact_awareness",
        operationId:actor.operationId??null,missionId:mission?.id??actor.squadMission??null
      });
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
      this.actorBrain.submit({
        actorId:actor.id,action,score:.66,urgency:.48,
        authorityTier:ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN,
        authorityLabel:"Contact update",
        reason:action.purpose,source:"runtime_contact_update",
        concernId:`contact:${contact.subjectId}`,desiredEffect:"refresh_shared_contact_activity",
        operationId:actor.operationId??null,missionId:mission?.id??actor.squadMission??null
      });
    }
  }

  #context(now=this.elapsed){
    return{
      now,
      game:this.game,
      snapshot:this.snapshot,
      services:{
        decisionLog:this.decisionLog,
        attention:this.attention,
        communication:this.communication,
        personalKnowledge:this.personalKnowledge,
        teamKnowledge:this.teamKnowledge,
        teamUnderstanding:this.teamUnderstanding,
        relationships:this.relationships,
        teamInteractions:this.teamInteractions,
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
        teamConcerns:this.teamConcerns,
        concernStaffing:this.concernStaffing,
        actorObligations:this.actorObligations,
        spatialIntentFields:this.spatialIntentFields,
        concernFulfillment:this.concernFulfillment,
        behavioralTruth:this.behavioralTruth,
        actionArbiter:this.actionArbiter,
        actorBrain:this.actorBrain,
        localAutonomy:this.localAutonomy,
        operationalTravel:this.operationalTravel,
        contactResolution:this.contactResolution,
        tacticalPictures:this.tacticalPictures,
        tacticalDeliberation:this.tacticalDeliberation,
        utilityEvaluation:this.utilityEvaluation,
        tacticalCommitments:this.tacticalCommitments,
        firingEdges:this.firingEdges,
        authorityTiers:ACTION_AUTHORITY_TIERS,
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
