import { AIV2Action } from "./action.js?v=20i-position-requirements-repositioning-20260802";
import { ACTION_CHANNELS } from "./action-channels.js?v=20i-position-requirements-repositioning-20260802";
import { evaluateVisualObservation } from "../senses/visual-observation.js?v=20i-position-requirements-repositioning-20260802";

function cloneAssignment(assignment={}){
  return{
    ...assignment,
    sector:assignment.sector?{...assignment.sector}:null,
    report:assignment.report?{...assignment.report}:null,
    provenance:assignment.provenance?{...assignment.provenance}:null
  };
}

export class ObserveSectorAction extends AIV2Action{
  constructor({actorId,assignment}={}){
    const normalized=cloneAssignment(assignment);
    super({
      type:"ObserveSector",
      actorId,
      purpose:normalized?.reason??"Gather information about the assigned sector",
      channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,
      displayPriority:30,
      metadata:{assignment:normalized,provenance:normalized.provenance??null}
    });
    this.assignment=normalized;
    this.elapsed=0;
    this.visibleSubjectIds=new Set();
    this.lastEvidenceBySubject=new Map();
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.assignment?.sector);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.assignment?.sector);
  }

  adoptDirective(assignment,{now=0,context={}}={}){
    const previous=this.assignment;
    this.assignment=cloneAssignment(assignment);
    this.purpose=this.assignment.reason??this.purpose;
    this.metadata.assignment=cloneAssignment(this.assignment);
    this.metadata.provenance=this.assignment.provenance?{...this.assignment.provenance}:null;
    this.#applyActorContext(context?.game,now);
    return{
      changed:JSON.stringify(previous)!==JSON.stringify(this.assignment),
      previous,
      current:this.assignment
    };
  }

  start(now,context){
    super.start(now,context);
    this.#applyActorContext(context?.game,now);
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=delta;
    this.progress=Math.min(1,this.elapsed/2.5);
    const sector=this.assignment.sector;
    const attention=services.attention.turnToward(actor,sector,delta,{pose:"scan"});
    actor.currentAction=attention.settled?"Watching assigned sector":"Turning toward assigned sector";

    const visibleIds=new Set();
    const evidenceBySubject=new Map();
    const candidates=game.actors.filter(target=>
      target.id!==actor.id&&
      target.factionId&&target.factionId!==actor.factionId&&
      (!sector.targetFactionId||target.factionId===sector.targetFactionId)&&
      !target.medical?.dead
    );

    for(const target of candidates){
      const evidence=evaluateVisualObservation(game,actor,target,{
        maximumRange:sector.maximumRange??1180,
        fieldOfViewDegrees:sector.fieldOfViewDegrees??72
      });
      evidenceBySubject.set(target.id,evidence);
      if(!evidence.visible)continue;
      visibleIds.add(target.id);
      services.personalKnowledge.observe({observer:actor,target,evidence,now,delta});
    }

    this.visibleSubjectIds=visibleIds;
    this.lastEvidenceBySubject=evidenceBySubject;
    services.visibleByObserver.set(actor.id,visibleIds);
    actor.aiV2Observation={
      sector:{...sector},
      sectorLabel:sector.label??"Assigned sector",
      settled:attention.settled,
      turnError:attention.error,
      visibleSubjectIds:[...visibleIds],
      provenance:this.assignment.provenance?{...this.assignment.provenance}:null
    };
    return null;
  }

  #applyActorContext(game,now){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.currentTask=this.assignment.task??actor.currentTask;
    actor.currentAction="Observing assigned sector";
    actor.procedureRole=this.assignment.roleLabel??this.assignment.role??actor.procedureRole;
    actor.aiV2Procedure=this.assignment.procedureLabel??this.assignment.procedure??actor.aiV2Procedure;
    actor.aiV2ProcedurePhase=this.assignment.phaseLabel??this.assignment.phase??actor.aiV2ProcedurePhase;
    actor.aiV2ActionReason=this.purpose;
    actor.aiV2ActionAssignedAt=now;
  }
}
