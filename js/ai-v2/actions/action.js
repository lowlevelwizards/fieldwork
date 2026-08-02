import { normalizeActionChannels } from "./action-channels.js?v=20i-position-requirements-repositioning-20260802";

export const ACTION_STATES=Object.freeze({
  PROPOSED:"proposed",
  ACTIVE:"active",
  COMPLETED:"completed",
  INTERRUPTED:"interrupted",
  FAILED:"failed",
  CANCELLED:"cancelled"
});

let nextActionSequence=1;

export class AIV2Action{
  constructor({type,actorId,purpose="",channels=[],primary=true,displayPriority=0,metadata={}}={}){
    if(!type)throw new Error("AI V2 actions require a type");
    if(!actorId)throw new Error("AI V2 actions require an actorId");
    this.id=`v2_action_${nextActionSequence++}`;
    this.type=type;
    this.actorId=actorId;
    this.purpose=purpose;
    this.channels=normalizeActionChannels(channels);
    this.primary=Boolean(primary);
    this.displayPriority=Number.isFinite(displayPriority)?displayPriority:0;
    this.metadata={...metadata};
    this.state=ACTION_STATES.PROPOSED;
    this.startedAt=null;
    this.endedAt=null;
    this.endReason=null;
    this.progress=0;
  }

  canStart(){return true;}
  canContinue(){return true;}
  update(){return null;}

  start(now){
    this.state=ACTION_STATES.ACTIVE;
    this.startedAt=now;
  }

  complete(now,reason="completed"){
    this.#end(ACTION_STATES.COMPLETED,now,reason);
  }

  interrupt(now,reason="interrupted"){
    this.#end(ACTION_STATES.INTERRUPTED,now,reason);
  }

  fail(now,reason="failed"){
    this.#end(ACTION_STATES.FAILED,now,reason);
  }

  cancel(now,reason="cancelled"){
    this.#end(ACTION_STATES.CANCELLED,now,reason);
  }

  #end(state,now,reason){
    this.state=state;
    this.endedAt=now;
    this.endReason=reason;
  }
}
