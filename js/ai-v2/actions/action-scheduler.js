import { ACTION_STATES } from "./action.js?v=20j-observable-activity-intent-hypotheses-20260802";

export class ActionScheduler{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.activeByActor=new Map();
  }

  getActions(actorId){return this.activeByActor.get(actorId)??[];}
  getAction(actorId,type){return this.getActions(actorId).find(action=>action.type===type)??null;}
  hasAction(actorId,type){return Boolean(this.getAction(actorId,type));}

  getPrimaryAction(actorId){
    const actions=this.getActions(actorId);
    if(!actions.length)return null;
    const primary=actions.filter(action=>action.primary);
    const candidates=primary.length?primary:actions;
    return candidates.reduce((best,action)=>{
      if(!best)return action;
      if(action.displayPriority!==best.displayPriority)return action.displayPriority>best.displayPriority?action:best;
      return (action.startedAt??0)>(best.startedAt??0)?action:best;
    },null);
  }

  canStart(action,context={}){
    if(!action.canStart(context))return{ok:false,reason:"action_start_condition_failed"};
    const active=this.getActions(action.actorId);
    for(const existing of active){
      const conflict=existing.channels.find(channel=>action.channels.includes(channel));
      if(conflict)return{ok:false,reason:`channel_busy:${conflict}`,blockingActionId:existing.id};
    }
    return{ok:true};
  }

  start(action,{now=0,context={}}={}){
    const result=this.canStart(action,context);
    if(!result.ok){
      this.#record("action_rejected",action,{reason:result.reason,blockingActionId:result.blockingActionId??null},now);
      return result;
    }
    const active=this.getActions(action.actorId).slice();
    action.start(now,context);
    active.push(action);
    this.activeByActor.set(action.actorId,active);
    this.#record("action_started",action,{purpose:action.purpose,channels:action.channels,provenance:action.metadata?.provenance??null},now);
    return{ok:true,action};
  }

  update(delta,{now=0,context={}}={}){
    for(const [actorId,actions] of this.activeByActor){
      for(const action of actions){
        if(action.state!==ACTION_STATES.ACTIVE)continue;
        if(!action.canContinue(context)){
          action.interrupt(now,"continuation_condition_failed");
          this.#record("action_interrupted",action,{reason:action.endReason},now);
          continue;
        }
        const result=action.update(delta,context);
        if(result?.status==="completed"){
          action.complete(now,result.reason??"completed");
          this.#record("action_completed",action,{reason:action.endReason,...(result.data??{})},now);
        }else if(result?.status==="failed"){
          action.fail(now,result.reason??"failed");
          this.#record("action_failed",action,{reason:action.endReason,...(result.data??{})},now);
        }
      }
      const remaining=actions.filter(action=>action.state===ACTION_STATES.ACTIVE);
      if(remaining.length)this.activeByActor.set(actorId,remaining);
      else this.activeByActor.delete(actorId);
    }
  }

  cancelAction(actorId,actionOrType,{now=0,reason="action_cancelled"}={}){
    const actions=this.getActions(actorId);
    const target=typeof actionOrType==="string"
      ?actions.find(action=>action.type===actionOrType)
      :actionOrType;
    if(!target||target.state!==ACTION_STATES.ACTIVE)return false;
    target.cancel(now,reason);
    this.#record("action_cancelled",target,{reason},now);
    const remaining=actions.filter(action=>action!==target&&action.state===ACTION_STATES.ACTIVE);
    if(remaining.length)this.activeByActor.set(actorId,remaining);
    else this.activeByActor.delete(actorId);
    return true;
  }

  cancelActor(actorId,{now=0,reason="actor_actions_cancelled"}={}){
    const actions=this.getActions(actorId);
    for(const action of actions){
      if(action.state!==ACTION_STATES.ACTIVE)continue;
      action.cancel(now,reason);
      this.#record("action_cancelled",action,{reason},now);
    }
    this.activeByActor.delete(actorId);
  }

  summary(){
    let actionCount=0;
    const byType={};
    for(const actions of this.activeByActor.values())for(const action of actions){
      actionCount+=1;
      byType[action.type]=(byType[action.type]??0)+1;
    }
    return{actorsWithActions:this.activeByActor.size,activeActions:actionCount,byType};
  }

  #record(type,action,data,now){
    this.decisionLog?.record?.({type,actorId:action.actorId,actionId:action.id,actionType:action.type,data,time:now});
  }
}
