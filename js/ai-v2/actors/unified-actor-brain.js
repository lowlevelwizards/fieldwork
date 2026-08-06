import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const DEFAULT_SWITCH_MARGIN=.08;
const cloneChannels=channels=>[...(channels??[])];
const overlaps=(left,right)=>left.some(channel=>right.includes(channel));
const authorityOf=action=>Number(action?.metadata?.actorBrainPlan?.authorityTier??action?.priority??0)||0;
const utilityOf=(action,context)=>Number(action?.continuationUtility?.(context)??action?.metadata?.utilityScore??0)||0;

function cloneCandidate(candidate){
  if(!candidate)return null;
  return{
    id:candidate.id,
    actorId:candidate.actorId,
    actionType:candidate.action?.type??candidate.actionType,
    channels:cloneChannels(candidate.action?.channels??candidate.channels),
    score:candidate.score,
    urgency:candidate.urgency,
    authorityTier:candidate.authorityTier,
    authorityLabel:candidate.authorityLabel,
    reason:candidate.reason,
    source:candidate.source,
    concernId:candidate.concernId??null,
    desiredEffect:candidate.desiredEffect??null,
    status:candidate.status??"proposed",
    resultReason:candidate.resultReason??null
  };
}

let nextBrainProposal=1;

/**
 * The only behavior-facing gateway allowed to forward physical action requests.
 * Other runtimes publish candidates and cancellation requests here; the brain
 * compares them against one another and against the actor's continuing plan,
 * then forwards a coherent channel-compatible set to the execution arbiter.
 */
export class UnifiedActorBrain{
  constructor({scheduler,arbiter,decisionLog=null,switchMargin=DEFAULT_SWITCH_MARGIN}={}){
    this.scheduler=scheduler;
    this.arbiter=arbiter;
    this.decisionLog=decisionLog;
    this.switchMargin=Math.max(0,Number(switchMargin)||DEFAULT_SWITCH_MARGIN);
    this.pending=new Map();
    this.cancellations=[];
    this.plans=new Map();
    this.traces=new Map();
    this.frame=0;
    this.now=0;
    this.context={};
  }

  beginFrame({now=0,context={}}={}){
    this.pending.clear();
    this.cancellations=[];
    this.frame+=1;
    this.now=now;
    this.context=context;
    this.arbiter?.beginFrame?.({now});
  }

  submit({
    actorId,action,score=0,urgency=0,
    authorityTier=ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,
    authorityLabel="Ambient autonomy",reason=null,source="unknown",
    concernId=null,desiredEffect=null,
    operationId=null,missionId=null,governingIntentId=null,supportingIntentId=null,
    procedureId=null,roleId=null,onGranted=null,onRejected=null
  }={}){
    if(!actorId||!action)return null;
    const candidate={
      id:`actor_brain_proposal_${nextBrainProposal++}`,
      actorId,action,score:Number(score)||0,urgency:Number(urgency)||0,
      authorityTier:Number(authorityTier)||0,authorityLabel,
      reason:reason??action.purpose??"No explanation supplied",source,
      concernId,desiredEffect,operationId,missionId,governingIntentId,supportingIntentId,
      procedureId,roleId,onGranted,onRejected,status:"proposed",resultReason:null
    };
    action.metadata={
      ...(action.metadata??{}),
      utilityScore:candidate.score,
      actorBrainPlan:{
        proposalId:candidate.id,authorityTier:candidate.authorityTier,
        authorityLabel:candidate.authorityLabel,urgency:candidate.urgency,source:candidate.source,
        concernId,desiredEffect,reason:candidate.reason,createdAt:this.now
      }
    };
    if(!this.pending.has(actorId))this.pending.set(actorId,[]);
    this.pending.get(actorId).push(candidate);
    return candidate.id;
  }

  requestCancel(actorId,actionOrType,{reason="actor_brain_cancel_requested",onCancelled=null}={}){
    if(!actorId||!actionOrType)return false;
    this.cancellations.push({actorId,actionOrType,reason,onCancelled});
    return true;
  }

  resolve({now=this.now,context=this.context}={}){
    this.now=now;
    this.context=context;
    this.#applyCancellationRequests(now,context);
    const actorIds=new Set([
      ...this.pending.keys(),
      ...(this.scheduler?.activeByActor?.keys?.()??[]),
      ...this.plans.keys()
    ]);

    for(const actorId of actorIds){
      const candidates=(this.pending.get(actorId)??[]).sort((a,b)=>
        b.authorityTier-a.authorityTier||b.urgency-a.urgency||b.score-a.score||String(a.action.type).localeCompare(String(b.action.type))
      );
      const accepted=[];
      const rejected=[];
      const claimedChannels=new Set();
      const active=this.scheduler?.getActions?.(actorId)??[];

      for(const candidate of candidates){
        const channels=cloneChannels(candidate.action.channels);
        if(channels.some(channel=>claimedChannels.has(channel))){
          this.#reject(candidate,"higher_value_brain_candidate_owns_channel",rejected,now);
          continue;
        }
        const incumbentConflicts=active.filter(action=>overlaps(channels,action.channels??[]));
        const sameType=incumbentConflicts.find(action=>action.type===candidate.action.type)??null;
        const blocking=incumbentConflicts.filter(action=>action!==sameType);
        const replacement=this.#replacementDecision(candidate,blocking,context);
        if(!replacement.ok){
          this.#reject(candidate,replacement.reason,rejected,now);
          continue;
        }
        if(!candidate.action.canStart?.(context)){
          this.#reject(candidate,"action_start_condition_failed",rejected,now);
          continue;
        }
        for(const action of replacement.replace){
          this.scheduler.cancelAction(actorId,action,{now,reason:`actor_brain_replanned_to:${candidate.action.type}`,context});
          this.#record("actor_brain_incumbent_replaced",candidate,now,{replacedActionId:action.id,replacedActionType:action.type,incumbentUtility:utilityOf(action,context)});
        }
        for(const channel of channels)claimedChannels.add(channel);
        accepted.push(candidate);
        this.arbiter?.submit?.({
          actorId:candidate.actorId,action:candidate.action,score:candidate.score,urgency:candidate.urgency,
          authorityTier:candidate.authorityTier,authorityLabel:candidate.authorityLabel,
          reason:candidate.reason,source:candidate.source,operationId:candidate.operationId,
          missionId:candidate.missionId,governingIntentId:candidate.governingIntentId,
          supportingIntentId:candidate.supportingIntentId,procedureId:candidate.procedureId,roleId:candidate.roleId,
          onGranted:(result,proposal)=>{
            candidate.status=result?.preserved?"preserved":"granted";
            candidate.resultReason=result?.amended?"matching_action_amended":result?.preserved?"matching_action_preserved":"execution_granted";
            candidate.onGranted?.(result,proposal??candidate);
          },
          onRejected:(reason,proposal)=>{
            candidate.status="rejected";candidate.resultReason=reason;
            candidate.onRejected?.(reason,proposal??candidate);
          }
        });
      }

      this.traces.set(actorId,{
        actorId,frame:this.frame,evaluatedAt:now,
        accepted:accepted.map(cloneCandidate),rejected:rejected.map(cloneCandidate),
        incumbents:(this.scheduler?.getActions?.(actorId)??[]).map(action=>({
          actionId:action.id,actionType:action.type,channels:cloneChannels(action.channels),
          utility:utilityOf(action,context),authorityTier:authorityOf(action),purpose:action.purpose
        }))
      });
    }

    this.arbiter?.resolve?.({now,context});
    this.#refreshPlans(now,context);
  }

  getPlan(actorId){
    const plan=this.plans.get(actorId);
    return plan?{...plan,actions:plan.actions.map(item=>({...item,channels:[...item.channels]})),concernIds:[...plan.concernIds],availableConcerns:(plan.availableConcerns??[]).map(item=>({...item}))}:null;
  }

  getTrace(actorId){
    const trace=this.traces.get(actorId);
    return trace?{
      ...trace,
      accepted:trace.accepted.map(item=>({...item,channels:[...item.channels]})),
      rejected:trace.rejected.map(item=>({...item,channels:[...item.channels]})),
      incumbents:trace.incumbents.map(item=>({...item,channels:[...item.channels]}))
    }:null;
  }

  summary(){return[...this.plans.keys()].map(actorId=>this.getPlan(actorId));}
  traceSummary(){return[...this.traces.keys()].map(actorId=>this.getTrace(actorId));}

  #replacementDecision(candidate,incumbents,context){
    const replace=[];
    for(const incumbent of incumbents){
      if(!incumbent.interruptible)return{ok:false,reason:`incumbent_uninterruptible:${incumbent.type}`,replace:[]};
      const incumbentAuthority=authorityOf(incumbent);
      const incumbentUtility=utilityOf(incumbent,context);
      if(candidate.authorityTier>incumbentAuthority){replace.push(incumbent);continue;}
      if(candidate.authorityTier<incumbentAuthority)return{ok:false,reason:`incumbent_higher_authority:${incumbent.type}`,replace:[]};
      const urgencyAdvantage=candidate.urgency-(Number(incumbent.metadata?.actorBrainPlan?.urgency)||0);
      if(candidate.score+Math.max(0,urgencyAdvantage*.2)<incumbentUtility+this.switchMargin){
        return{ok:false,reason:`incumbent_continuation_utility:${incumbent.type}`,replace:[]};
      }
      replace.push(incumbent);
    }
    return{ok:true,replace};
  }

  #applyCancellationRequests(now,context){
    for(const request of this.cancellations){
      const cancelled=this.scheduler?.cancelAction?.(request.actorId,request.actionOrType,{now,reason:request.reason,context})??false;
      if(cancelled)request.onCancelled?.();
    }
  }

  #refreshPlans(now,context){
    const live=new Set();
    for(const actorId of this.scheduler?.activeByActor?.keys?.()??[]){
      const actions=this.scheduler.getActions(actorId);
      if(!actions.length)continue;
      live.add(actorId);
      const actor=context?.game?.actors?.find?.(candidate=>candidate.id===actorId)??null;
      const availableConcerns=actor?.teamId
        ?(context?.services?.teamConcerns?.getActive?.(actor.teamId)??[]).map(concern=>({id:concern.id,kind:concern.kind,importance:concern.importance,urgency:concern.urgency,desiredEffect:concern.desiredEffect}))
        :[];
      const concernIds=[...new Set(actions.map(action=>action.metadata?.actorBrainPlan?.concernId).filter(Boolean))];
      const plan={
        actorId,status:"active",updatedAt:now,concernIds,availableConcerns,
        authorityTier:Math.max(...actions.map(authorityOf),0),
        utility:Math.max(...actions.map(action=>utilityOf(action,context)),0),
        actions:actions.map(action=>({
          actionId:action.id,actionType:action.type,channels:cloneChannels(action.channels),
          purpose:action.purpose,utility:utilityOf(action,context),authorityTier:authorityOf(action),
          source:action.metadata?.actorBrainPlan?.source??action.metadata?.provenance?.owner??null,
          desiredEffect:action.metadata?.actorBrainPlan?.desiredEffect??null
        }))
      };
      this.plans.set(actorId,plan);
      if(actor)actor.aiV2ActorPlan=this.getPlan(actorId);
    }
    for(const actorId of [...this.plans.keys()])if(!live.has(actorId))this.plans.delete(actorId);
  }

  #reject(candidate,reason,rejected,now){
    candidate.status="rejected";candidate.resultReason=reason;
    candidate.onRejected?.(reason,candidate);
    rejected.push(candidate);
    this.#record("actor_brain_candidate_rejected",candidate,now,{reason});
  }

  #record(type,candidate,now,data={}){
    this.decisionLog?.record?.({
      type,time:now,actorId:candidate.actorId,actionType:candidate.action?.type,
      data:{proposalId:candidate.id,source:candidate.source,authorityTier:candidate.authorityTier,score:candidate.score,urgency:candidate.urgency,reason:candidate.reason,concernId:candidate.concernId,desiredEffect:candidate.desiredEffect,...data}
    });
  }
}
