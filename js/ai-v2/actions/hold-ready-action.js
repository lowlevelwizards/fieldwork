import { AIV2Action } from "./action.js?v=20h-procedure-driven-actor-actions-20260802";
import { ACTION_CHANNELS } from "./action-channels.js?v=20h-procedure-driven-actor-actions-20260802";

function cloneDirective(directive={}){
  return{
    ...directive,
    focus:directive.focus?{...directive.focus}:null,
    provenance:directive.provenance?{...directive.provenance}:null
  };
}

export class HoldReadyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"HoldReady",
      actorId,
      purpose:normalized.reason??"Remain available for the team's next requirement",
      channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,
      displayPriority:20,
      metadata:{directive:normalized,provenance:normalized.provenance??null}
    });
    this.directive=normalized;
    this.elapsed=0;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.focus);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.focus);
  }

  adoptDirective(directive,{now=0,context={}}={}){
    const previous=this.directive;
    this.directive=cloneDirective(directive);
    this.purpose=this.directive.reason??this.purpose;
    this.metadata.directive=cloneDirective(this.directive);
    this.metadata.provenance=this.directive.provenance?{...this.directive.provenance}:null;
    this.#applyActorContext(context?.game,now);
    return{
      changed:JSON.stringify(previous)!==JSON.stringify(this.directive),
      previous,
      current:this.directive
    };
  }

  start(now,context){
    super.start(now,context);
    this.#applyActorContext(context?.game,now);
  }

  update(delta,{game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return {status:"failed",reason:"actor_missing"};
    this.elapsed+=delta;
    this.progress=1;
    const attention=services.attention.turnToward(actor,this.directive.focus,delta,{pose:"ready",turnRate:3.8});
    actor.currentAction=attention.settled?"Holding ready":"Orienting to ready sector";
    actor.aiV2HoldReady={
      label:this.directive.label??"Ready sector",
      focus:{...this.directive.focus},
      settled:attention.settled,
      turnError:attention.error,
      provenance:this.directive.provenance?{...this.directive.provenance}:null
    };
    return null;
  }

  #applyActorContext(game,now){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.currentTask=this.directive.task??actor.currentTask;
    actor.currentAction="Holding ready";
    actor.procedureRole=this.directive.roleLabel??actor.procedureRole;
    actor.aiV2Procedure=this.directive.procedureLabel??actor.aiV2Procedure;
    actor.aiV2ProcedurePhase=this.directive.phaseLabel??actor.aiV2ProcedurePhase;
    actor.aiV2ActionReason=this.purpose;
    actor.aiV2ActionAssignedAt=now;
  }
}
