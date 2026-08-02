import { ActionScheduler } from "../actions/action-scheduler.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { ObserveSectorAction } from "../actions/observe-sector-action.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { ReportContactAction } from "../actions/report-contact-action.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { CommunicationExecutor } from "../communication/communication-executor.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { DecisionLog } from "../diagnostics/decision-log.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { InvariantMonitor } from "../diagnostics/invariant-monitor.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { AttentionExecutor } from "../execution/attention-executor.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { PersonalKnowledgeStore } from "../knowledge/personal-knowledge.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { TeamKnowledgeStore } from "../knowledge/team-knowledge.js?v=20d-contact-reporting-shared-team-knowledge-20260802";
import { captureWorldSnapshot } from "./world-snapshot.js?v=20d-contact-reporting-shared-team-knowledge-20260802";

export const AI_RUNTIME_MODES=Object.freeze({
  LEGACY:"legacy",
  V2:"v2"
});

export class AIV2Runtime{
  constructor(game){
    this.game=game;
    this.elapsed=0;
    this.snapshotAccumulator=0;
    this.snapshotInterval=.25;
    this.decisionLog=new DecisionLog({limit:700});
    this.invariants=new InvariantMonitor({decisionLog:this.decisionLog});
    this.scheduler=new ActionScheduler({decisionLog:this.decisionLog});
    this.personalKnowledge=new PersonalKnowledgeStore({decisionLog:this.decisionLog});
    this.teamKnowledge=new TeamKnowledgeStore({decisionLog:this.decisionLog});
    this.attention=new AttentionExecutor();
    this.communication=new CommunicationExecutor();
    this.visibleByObserver=new Map();
    this.snapshot=captureWorldSnapshot(game,{elapsed:0});
    this.invariants.inspect(this.snapshot,{now:0});
    this.decisionLog.record({
      type:"runtime_started",
      time:0,
      data:{mode:"v2",stage:"contact_reporting_shared_team_knowledge",scenario:game.scenarioMode}
    });
  }

  update(delta){
    this.elapsed+=delta;
    this.visibleByObserver=new Map();
    this.#ensureObservationActions();
    this.scheduler.update(delta,{now:this.elapsed,context:this.#context(this.elapsed)});
    this.personalKnowledge.update(delta,{now:this.elapsed,visibleByObserver:this.visibleByObserver});
    this.teamKnowledge.update(delta,{now:this.elapsed});
    this.#ensureContactReports();
    this.#updateActorDiagnostics();

    this.snapshotAccumulator+=delta;
    if(this.snapshotAccumulator<this.snapshotInterval)return;
    this.snapshotAccumulator%=this.snapshotInterval;
    this.snapshot=captureWorldSnapshot(this.game,{elapsed:this.elapsed});
    this.invariants.inspect(this.snapshot,{now:this.elapsed});
  }

  getDebugSummary(){
    const scheduler=this.scheduler.summary();
    const observers=this.game.actors.filter(actor=>actor.aiV2Assignment?.action==="observe_sector").length;
    const visible=this.personalKnowledge.summary().reduce((sum,entry)=>sum+entry.contacts.filter(contact=>contact.currentlyVisible).length,0);
    const reporting=scheduler.byType.ReportContact??0;
    return `${observers} observing · ${reporting} reporting · ${this.personalKnowledge.count()} private contact(s) · ${visible} visible · ${this.teamKnowledge.reportCount()} shared report(s) · ${this.teamKnowledge.recipientCount()} received · ${scheduler.activeActions} action(s) · ${this.invariants.current.length} invariant issue(s)`;
  }

  getDebugDetails(){
    const observers=this.game.actors.filter(actor=>actor.aiV2Assignment?.action==="observe_sector");
    const assignments=observers.length
      ?observers.map(actor=>`${actor.name}: ${actor.aiV2Assignment.role}`).join(" · ")
      :"No authored V2 assignment in this fixture";
    const contacts=observers.map(actor=>{
      const contact=this.personalKnowledge.getBestContact(actor.id);
      return contact?`${actor.name}: ${contact.level} ${Math.round(contact.confidence)}%`: `${actor.name}: none`;
    }).join(" · ")||"none";
    const communication=observers.map(actor=>{
      const report=this.scheduler.getAction(actor.id,"ReportContact");
      if(report)return `${actor.name}: voice report ${Math.round(report.progress*100)}%`;
      const delivered=actor.aiV2Communication?.status==="delivered";
      return delivered?`${actor.name}: delivered to ${actor.aiV2Communication.recipientIds.length}`:`${actor.name}: observing`;
    }).join(" · ")||"none";
    const shared=this.teamKnowledge.summary().flatMap(entry=>entry.reports.map(report=>{
      const faction=this.game.actors.find(actor=>actor.teamId===entry.teamId)?.factionId??entry.teamId;
      return `${faction}: ${report.classification.replaceAll("_"," ")} ${Math.round(report.confidence)}% via ${report.recipientIds.length} recipient(s)`;
    })).join(" · ")||"none — no report delivered";
    return{
      assignment:assignments,
      personalKnowledge:contacts,
      communication,
      teamKnowledge:shared
    };
  }

  #ensureObservationActions(){
    for(const actor of this.game.actors){
      const assignment=actor.aiV2Assignment;
      if(!assignment||assignment.action!=="observe_sector"||this.scheduler.hasAction(actor.id,"ObserveSector"))continue;
      const action=new ObserveSectorAction({actorId:actor.id,assignment});
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
      if(this.teamKnowledge.hasReportFrom(actor.teamId,actor.id,contact.subjectId))continue;
      const action=new ReportContactAction({actorId:actor.id,contact,assignment});
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
        visibleByObserver:this.visibleByObserver
      }
    };
  }

  #updateActorDiagnostics(){
    for(const actor of this.game.actors){
      const actions=this.scheduler.getActions(actor.id);
      const primary=this.scheduler.getPrimaryAction(actor.id);
      const assignment=actor.aiV2Assignment??null;
      const contact=this.personalKnowledge.getBestContact(actor.id);
      const received=this.teamKnowledge.getBestReceivedContact(actor.id);
      const teamContact=this.teamKnowledge.getBestTeamContact(actor.teamId);
      const reporting=actions.find(action=>action.type==="ReportContact")??null;
      const sourceActor=received?this.game.actors.find(candidate=>candidate.id===received.sourceActorId):null;
      actor.aiV2Debug={
        mission:assignment?.mission??actor.squadMission??null,
        task:assignment?.task??actor.currentTask??null,
        procedure:assignment?.procedure??null,
        procedurePhase:assignment?.phase??null,
        role:assignment?.role??null,
        primaryAction:primary?.type??"UNASSIGNED",
        activeActions:actions.map(action=>action.type),
        actionId:primary?.id??null,
        actionReason:primary?.purpose??null,
        attentionSector:assignment?.sector?.label??null,
        visibleContact:contact?.currentlyVisible?contact.subjectId:null,
        personalKnowledge:contact?{
          subjectId:contact.subjectId,
          classification:contact.classification,
          identity:contact.identity,
          level:contact.level,
          confidence:contact.confidence,
          currentlyVisible:contact.currentlyVisible,
          approximatePosition:{...contact.approximatePosition},
          lastObservedAt:contact.lastObservedAt
        }:null,
        communication:reporting?{
          status:"transmitting",
          method:reporting.transmission?.method??"local_voice",
          progress:reporting.progress,
          recipientIds:[...(reporting.transmission?.recipientIds??[])],
          subjectId:reporting.contactSnapshot?.subjectId??null
        }:actor.aiV2Communication?{...actor.aiV2Communication,recipientIds:[...(actor.aiV2Communication.recipientIds??[])]}:null,
        receivedKnowledge:received?{
          reportId:received.id,
          subjectId:received.subjectId,
          classification:received.classification,
          identity:received.identity,
          confidence:received.confidence,
          approximatePosition:{...received.approximatePosition},
          sourceActorId:received.sourceActorId,
          sourceName:sourceActor?.name??received.sourceActorId,
          method:received.method,
          reportedAt:received.reportedAt,
          independentlyConfirmed:false
        }:null,
        teamKnowledge:teamContact?{
          reportId:teamContact.id,
          subjectId:teamContact.subjectId,
          confidence:teamContact.confidence,
          approximatePosition:{...teamContact.approximatePosition},
          sourceActorId:teamContact.sourceActorId,
          recipientIds:[...teamContact.recipientIds],
          independentlyConfirmed:false
        }:null,
        runtimeStage:"contact_reporting_shared_team_knowledge"
      };
    }
  }
}
