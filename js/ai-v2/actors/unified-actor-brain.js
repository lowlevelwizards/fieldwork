import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
import { ActorReplanningPolicy, REPLAN_DECISIONS } from "./actor-replanning-policy.js";

const DEFAULT_SWITCH_MARGIN=.08;
const cloneChannels=channels=>[...(channels??[])];
const overlaps=(left,right)=>left.some(channel=>right.includes(channel));
const authorityOf=action=>Number(action?.metadata?.actorBrainPlan?.authorityTier??action?.priority??0)||0;
const utilityOf=(action,context)=>Number(action?.continuationUtility?.(context)??action?.metadata?.utilityScore??0)||0;
const softReplacementReason=reason=>String(reason??"").startsWith("procedural_role_requires_");

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
    obligationId:candidate.obligationId??null,
    desiredEffect:candidate.desiredEffect??null,
    status:candidate.status??"proposed",
    resultReason:candidate.resultReason??null
  };
}

function cloneReplanning(item){
  return item?{
    ...item,
    channels:cloneChannels(item.channels),
    details:item.details?{...item.details}:null
  }:null;
}

let nextBrainProposal=1;

/**
 * The only behavior-facing gateway allowed to forward physical action requests.
 * Other runtimes publish candidates and cancellation requests here; the brain
 * continuously compares them against one another and against the actor's
 * currently executing actions, then forwards one coherent channel-compatible
 * physical plan to the execution arbiter.
 */
export class UnifiedActorBrain{
  constructor({scheduler,arbiter,decisionLog=null,switchMargin=DEFAULT_SWITCH_MARGIN,replanningPolicy=null}={}){
    this.scheduler=scheduler;
    this.arbiter=arbiter;
    this.decisionLog=decisionLog;
    this.switchMargin=Math.max(0,Number(switchMargin)||DEFAULT_SWITCH_MARGIN);
    this.replanningPolicy=replanningPolicy??new ActorReplanningPolicy({baseSwitchMargin:this.switchMargin});
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
    concernId=null,obligationId=null,desiredEffect=null,
    operationId=null,missionId=null,governingIntentId=null,supportingIntentId=null,
    procedureId=null,roleId=null,onGranted=null,onRejected=null
  }={}){
    if(!actorId||!action)return null;
    const candidate={
      id:`actor_brain_proposal_${nextBrainProposal++}`,
      actorId,action,score:Number(score)||0,urgency:Number(urgency)||0,
      authorityTier:Number(authorityTier)||0,authorityLabel,
      reason:reason??action.purpose??"No explanation supplied",source,
      concernId,obligationId,desiredEffect,operationId,missionId,governingIntentId,supportingIntentId,
      procedureId,roleId,onGranted,onRejected,status:"proposed",resultReason:null
    };
    action.metadata={
      ...(action.metadata??{}),
      utilityScore:candidate.score,
      actorBrainPlan:{
        proposalId:candidate.id,authorityTier:candidate.authorityTier,
        authorityLabel:candidate.authorityLabel,urgency:candidate.urgency,source:candidate.source,
        concernId,obligationId,desiredEffect,reason:candidate.reason,createdAt:this.now
      }
    };
    if(!this.pending.has(actorId))this.pending.set(actorId,[]);
    this.pending.get(actorId).push(candidate);
    return candidate.id;
  }

  requestCancel(actorId,actionOrType,{reason="actor_brain_cancel_requested",onCancelled=null}={}){
    if(!actorId||!actionOrType)return false;
    this.cancellations.push({actorId,actionOrType,reason,onCancelled,mode:softReplacementReason(reason)?"soft_replan":"hard"});
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
      const replanning=[];
      const claimedChannels=new Set();

      for(const candidate of candidates){
        const channels=cloneChannels(candidate.action.channels);
        if(channels.some(channel=>claimedChannels.has(channel))){
          this.#reject(candidate,"higher_value_brain_candidate_owns_channel",rejected,now);
          continue;
        }

        const active=this.scheduler?.getActions?.(actorId)??[];
        const incumbentConflicts=active.filter(action=>overlaps(channels,action.channels??[]));
        const decisions=incumbentConflicts.map(incumbent=>({
          incumbent,
          result:this.replanningPolicy.evaluate({candidate,incumbent,now,context,scheduler:this.scheduler})
        }));
        for(const item of decisions)replanning.push(this.#replanningTrace(candidate,item.incumbent,item.result,channels));

        const preserving=decisions.find(item=>item.result.decision===REPLAN_DECISIONS.PRESERVE)??null;
        if(preserving){
          this.#reject(candidate,`incumbent_continuation_utility:${preserving.incumbent.type}:${preserving.result.reason}`,rejected,now);
          continue;
        }

        const amendments=decisions.filter(item=>item.result.decision===REPLAN_DECISIONS.AMEND);
        if(amendments.length){
          if(decisions.length!==1||amendments.length!==1){
            this.#reject(candidate,"multi_channel_amend_requires_stable_incumbents",rejected,now);
            continue;
          }
          const incumbent=amendments[0].incumbent;
          const amended=Boolean(incumbent.amendFrom?.(candidate.action,{now,context,candidate}));
          if(!amended){
            this.#reject(candidate,"same_type_amend_rejected_by_action",rejected,now);
            continue;
          }
          const priorPlan=incumbent.metadata?.actorBrainPlan??{};
          incumbent.metadata={
            ...(incumbent.metadata??{}),
            utilityScore:candidate.score,
            actorBrainPlan:{
              ...priorPlan,
              authorityTier:candidate.authorityTier,authorityLabel:candidate.authorityLabel,
              urgency:candidate.urgency,source:candidate.source,concernId:candidate.concernId,
              obligationId:candidate.obligationId,desiredEffect:candidate.desiredEffect,reason:candidate.reason,
              lastReplannedAt:now
            }
          };
          candidate.status="preserved";
          candidate.resultReason="matching_action_amended_by_replanning_policy";
          for(const channel of channels)claimedChannels.add(channel);
          accepted.push(candidate);
          candidate.onGranted?.({ok:true,preserved:true,amended:true,action:incumbent},candidate);
          this.#record("actor_brain_incumbent_amended",candidate,now,{actionId:incumbent.id,replanning:amendments[0].result});
          continue;
        }

        if(!this.#candidateViable(candidate,context,now)){
          this.#reject(candidate,"action_start_condition_failed",rejected,now);
          continue;
        }

        const replacements=decisions.filter(item=>item.result.decision===REPLAN_DECISIONS.REPLACE);
        for(const {incumbent,result} of replacements){
          const incumbentUtility=utilityOf(incumbent,context);
          this.scheduler.cancelAction(actorId,incumbent,{now,reason:`actor_brain_replanned_to:${candidate.action.type}`,context});
          this.replanningPolicy.noteSwitch(actorId,incumbent.channels,{now,fromActionType:incumbent.type,toActionType:candidate.action.type});
          this.#record("actor_brain_incumbent_replaced",candidate,now,{replacedActionId:incumbent.id,replacedActionType:incumbent.type,incumbentUtility,replanning:result});
        }

        for(const channel of channels)claimedChannels.add(channel);
        accepted.push(candidate);
        this.arbiter?.submit?.({
          actorId:candidate.actorId,action:candidate.action,score:candidate.score,urgency:candidate.urgency,
          authorityTier:candidate.authorityTier,authorityLabel:candidate.authorityLabel,
          reason:candidate.reason,source:candidate.source,operationId:candidate.operationId,
          missionId:candidate.missionId,governingIntentId:candidate.governingIntentId,
          supportingIntentId:candidate.supportingIntentId,procedureId:candidate.procedureId,roleId:candidate.roleId,obligationId:candidate.obligationId,
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
        accepted:accepted.map(cloneCandidate),rejected:rejected.map(cloneCandidate),replanning:replanning.map(cloneReplanning),
        incumbents:(this.scheduler?.getActions?.(actorId)??[]).map(action=>({
          actionId:action.id,actionType:action.type,channels:cloneChannels(action.channels),
          utility:utilityOf(action,context),authorityTier:authorityOf(action),purpose:action.purpose,
          liveness:this.scheduler?.liveness?.byAction?.get?.(action.id)?.status??"healthy"
        }))
      });
    }

    this.arbiter?.resolve?.({now,context});
    this.#refreshPlans(now,context);
  }

  getPlan(actorId){
    const plan=this.plans.get(actorId);
    return plan?{...plan,actions:plan.actions.map(item=>({...item,channels:[...item.channels]})),concernIds:[...plan.concernIds],obligationIds:[...(plan.obligationIds??[])],availableConcerns:(plan.availableConcerns??[]).map(item=>({...item})),recentReplanning:(plan.recentReplanning??[]).map(cloneReplanning)}:null;
  }

  getTrace(actorId){
    const trace=this.traces.get(actorId);
    return trace?{
      ...trace,
      accepted:trace.accepted.map(item=>({...item,channels:[...item.channels]})),
      rejected:trace.rejected.map(item=>({...item,channels:[...item.channels]})),
      replanning:(trace.replanning??[]).map(cloneReplanning),
      incumbents:trace.incumbents.map(item=>({...item,channels:[...item.channels]}))
    }:null;
  }

  summary(){return[...this.plans.keys()].map(actorId=>this.getPlan(actorId));}
  traceSummary(){return[...this.traces.keys()].map(actorId=>this.getTrace(actorId));}

  #candidateViable(candidate,context,now){
    if(candidate.action.canStart?.(context)===false)return false;
    const liveness=this.scheduler?.liveness?.canStart?.(candidate.action,context,now)??{ok:true};
    return liveness.ok!==false;
  }

  #applyCancellationRequests(now,context){
    for(const request of this.cancellations){
      if(request.mode==="soft_replan"){
        this.decisionLog?.record?.({type:"actor_brain_soft_replan_requested",time:now,actorId:request.actorId,data:{reason:request.reason}});
        continue;
      }
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
        ?(context?.services?.teamConcerns?.getActive?.(actor.teamId)??[]).map(concern=>({id:concern.id,kind:concern.kind,importance:concern.importance,urgency:concern.urgency,desiredEffect:concern.desiredEffect,staffedResponsibilities:(context?.services?.concernStaffing?.getActorAssignments?.(actorId)??[]).filter(item=>item.concernId===concern.id).map(item=>item.responsibility)}))
        :[];
      const concernIds=[...new Set(actions.map(action=>action.metadata?.actorBrainPlan?.concernId).filter(Boolean))];
      const obligationIds=[...new Set(actions.map(action=>action.metadata?.actorBrainPlan?.obligationId).filter(Boolean))];
      const recentReplanning=(this.traces.get(actorId)?.replanning??[]).slice(-8).map(cloneReplanning);
      const plan={
        actorId,status:"active",updatedAt:now,concernIds,obligationIds,availableConcerns,recentReplanning,
        authorityTier:Math.max(...actions.map(authorityOf),0),
        utility:Math.max(...actions.map(action=>utilityOf(action,context)),0),
        actions:actions.map(action=>({
          actionId:action.id,actionType:action.type,channels:cloneChannels(action.channels),
          purpose:action.purpose,utility:utilityOf(action,context),authorityTier:authorityOf(action),
          source:action.metadata?.actorBrainPlan?.source??action.metadata?.provenance?.owner??null,
          desiredEffect:action.metadata?.actorBrainPlan?.desiredEffect??null,
          obligationId:action.metadata?.actorBrainPlan?.obligationId??null,
          liveness:this.scheduler?.liveness?.byAction?.get?.(action.id)?.status??"healthy"
        }))
      };
      this.plans.set(actorId,plan);
      if(actor)actor.aiV2ActorPlan=this.getPlan(actorId);
    }
    for(const actorId of [...this.plans.keys()])if(!live.has(actorId))this.plans.delete(actorId);
  }

  #replanningTrace(candidate,incumbent,result,channels){
    return{
      candidateId:candidate.id,candidateActionType:candidate.action?.type??null,
      incumbentActionId:incumbent.id,incumbentActionType:incumbent.type,
      channels:cloneChannels(channels),decision:result.decision,reason:result.reason,
      details:{
        incumbentUtility:result.incumbentUtility,challengerUtility:result.challengerUtility,
        effectiveChallenger:result.effectiveChallenger??result.challengerUtility,
        effectiveMargin:Number.isFinite(result.effectiveMargin)?result.effectiveMargin:null,
        incumbentAuthority:result.incumbentAuthority,challengerAuthority:result.challengerAuthority,
        incumbentUrgency:result.incumbentUrgency,challengerUrgency:result.challengerUrgency,
        age:result.age,livenessStatus:result.livenessStatus,materialChange:result.materialChange
      }
    };
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
      data:{proposalId:candidate.id,source:candidate.source,authorityTier:candidate.authorityTier,score:candidate.score,urgency:candidate.urgency,reason:candidate.reason,concernId:candidate.concernId,obligationId:candidate.obligationId,desiredEffect:candidate.desiredEffect,...data}
    });
  }
}
