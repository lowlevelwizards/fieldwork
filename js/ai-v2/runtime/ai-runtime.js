import { ActionScheduler } from "../actions/action-scheduler.js?v=20c-tasked-observation-personal-knowledge-20260802";
import { ObserveSectorAction } from "../actions/observe-sector-action.js?v=20c-tasked-observation-personal-knowledge-20260802";
import { DecisionLog } from "../diagnostics/decision-log.js?v=20c-tasked-observation-personal-knowledge-20260802";
import { InvariantMonitor } from "../diagnostics/invariant-monitor.js?v=20c-tasked-observation-personal-knowledge-20260802";
import { AttentionExecutor } from "../execution/attention-executor.js?v=20c-tasked-observation-personal-knowledge-20260802";
import { PersonalKnowledgeStore } from "../knowledge/personal-knowledge.js?v=20c-tasked-observation-personal-knowledge-20260802";
import { captureWorldSnapshot } from "./world-snapshot.js?v=20c-tasked-observation-personal-knowledge-20260802";

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
    this.decisionLog=new DecisionLog({limit:500});
    this.invariants=new InvariantMonitor({decisionLog:this.decisionLog});
    this.scheduler=new ActionScheduler({decisionLog:this.decisionLog});
    this.personalKnowledge=new PersonalKnowledgeStore({decisionLog:this.decisionLog});
    this.attention=new AttentionExecutor();
    this.visibleByObserver=new Map();
    this.startedAssignments=new Set();
    this.snapshot=captureWorldSnapshot(game,{elapsed:0});
    this.invariants.inspect(this.snapshot,{now:0});
    this.decisionLog.record({
      type:"runtime_started",
      time:0,
      data:{mode:"v2",stage:"tasked_observation_personal_knowledge",scenario:game.scenarioMode}
    });
  }

  update(delta){
    this.elapsed+=delta;
    this.visibleByObserver=new Map();
    this.#ensureAuthoredActions();
    this.scheduler.update(delta,{now:this.elapsed,context:this.#context(this.elapsed)});
    this.personalKnowledge.update(delta,{now:this.elapsed,visibleByObserver:this.visibleByObserver});
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
    return `${observers} observing · ${this.personalKnowledge.count()} personal contact(s) · ${visible} visible · 0 shared · ${scheduler.activeActions} action(s) · ${this.invariants.current.length} invariant issue(s)`;
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
    return{
      assignment:assignments,
      personalKnowledge:contacts,
      teamKnowledge:"none — no report action exists yet"
    };
  }

  #ensureAuthoredActions(){
    for(const actor of this.game.actors){
      const assignment=actor.aiV2Assignment;
      if(!assignment||assignment.action!=="observe_sector"||this.startedAssignments.has(actor.id))continue;
      const action=new ObserveSectorAction({actorId:actor.id,assignment});
      const result=this.scheduler.start(action,{now:this.elapsed,context:this.#context(this.elapsed)});
      if(result.ok)this.startedAssignments.add(actor.id);
    }
  }

  #context(now=this.elapsed){
    return{
      now,
      game:this.game,
      snapshot:this.snapshot,
      services:{
        attention:this.attention,
        personalKnowledge:this.personalKnowledge,
        visibleByObserver:this.visibleByObserver
      }
    };
  }

  #updateActorDiagnostics(){
    for(const actor of this.game.actors){
      const primary=this.scheduler.getPrimaryAction(actor.id);
      const assignment=actor.aiV2Assignment??null;
      const contact=this.personalKnowledge.getBestContact(actor.id);
      actor.aiV2Debug={
        mission:assignment?.mission??actor.squadMission??null,
        task:assignment?.task??actor.currentTask??null,
        procedure:assignment?.procedure??null,
        procedurePhase:assignment?.phase??null,
        role:assignment?.role??null,
        primaryAction:primary?.type??"UNASSIGNED",
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
        teamKnowledge:"none",
        runtimeStage:"tasked_observation_personal_knowledge"
      };
    }
  }
}
