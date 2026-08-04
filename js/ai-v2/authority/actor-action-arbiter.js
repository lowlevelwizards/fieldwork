export const ACTION_AUTHORITY_TIERS=Object.freeze({
  IMMEDIATE_SURVIVAL:600,
  GOVERNING_RESPONSE:500,
  MISSION_RESPONSIBILITY:400,
  SUPPORTING_CONCERN:300,
  LOCAL_IMPROVEMENT:200,
  AMBIENT_AUTONOMY:100
});

function cloneProvenance(value){return value?{...value}:null;}
function cloneProposal(proposal){
  return proposal?{
    id:proposal.id,
    actorId:proposal.actorId,
    actionType:proposal.actionType,
    channels:[...(proposal.channels??[])],
    score:proposal.score,
    urgency:proposal.urgency,
    authorityTier:proposal.authorityTier,
    authorityLabel:proposal.authorityLabel,
    reason:proposal.reason,
    source:proposal.source,
    operationId:proposal.operationId??null,
    missionId:proposal.missionId??null,
    governingIntentId:proposal.governingIntentId??null,
    supportingIntentId:proposal.supportingIntentId??null,
    procedureId:proposal.procedureId??null,
    roleId:proposal.roleId??null,
    provenance:cloneProvenance(proposal.provenance),
    status:proposal.status??"proposed",
    resultReason:proposal.resultReason??null
  }:null;
}

let nextProposalId=1;

export class ActorActionArbiter{
  constructor({scheduler,decisionLog=null,switchMargin=.06}={}){
    this.scheduler=scheduler;
    this.decisionLog=decisionLog;
    this.switchMargin=Math.max(0,Number(switchMargin)||0);
    this.pending=new Map();
    this.traces=new Map();
    this.frame=0;
    this.now=0;
  }

  beginFrame({now=0}={}){
    this.pending.clear();
    this.frame+=1;
    this.now=now;
  }

  submit({
    actorId,
    action,
    score=0,
    urgency=0,
    authorityTier=ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,
    authorityLabel="Ambient autonomy",
    reason=null,
    source="unknown",
    operationId=null,
    missionId=null,
    governingIntentId=null,
    supportingIntentId=null,
    procedureId=null,
    roleId=null,
    onGranted=null,
    onRejected=null
  }={}){
    if(!actorId||!action)return null;
    if(authorityTier>=ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN){
      action.priority=Math.max(Number(action.priority)||0,Number(authorityTier)||0);
      action.displayPriority=Math.max(Number(action.displayPriority)||0,Math.round((Number(authorityTier)||0)/10));
    }
    const proposal={
      id:`v2_proposal_${nextProposalId++}`,
      actorId,
      action,
      actionType:action.type,
      channels:[...(action.channels??[])],
      score:Number(score)||0,
      urgency:Number(urgency)||0,
      authorityTier:Number(authorityTier)||0,
      authorityLabel,
      reason:reason??action.purpose??"No explanation supplied",
      source,
      operationId,
      missionId,
      governingIntentId,
      supportingIntentId,
      procedureId,
      roleId,
      provenance:cloneProvenance(action.metadata?.provenance),
      onGranted,
      onRejected,
      status:"proposed",
      resultReason:null
    };
    if(!this.pending.has(actorId))this.pending.set(actorId,[]);
    this.pending.get(actorId).push(proposal);
    return proposal.id;
  }

  resolve({now=this.now,context={}}={}){
    const actorIds=new Set([...this.pending.keys(),...this.traces.keys()]);
    for(const actorId of actorIds){
      const proposals=(this.pending.get(actorId)??[]).sort((a,b)=>
        b.authorityTier-a.authorityTier||
        b.urgency-a.urgency||
        b.score-a.score||
        String(a.actionType).localeCompare(String(b.actionType))
      );
      const granted=[];
      const rejected=[];
      const claimedChannels=new Set();
      for(const proposal of proposals){
        const overlaps=proposal.channels.some(channel=>claimedChannels.has(channel));
        if(overlaps){
          proposal.status="rejected";
          proposal.resultReason="higher_authority_proposal_owns_channel";
          proposal.onRejected?.(proposal.resultReason,proposal);
          rejected.push(proposal);
          this.#record("action_proposal_rejected",proposal,now);
          continue;
        }
        const current=this.scheduler.getAction(actorId,proposal.actionType);
        if(current){
          proposal.status="preserved";
          proposal.resultReason="matching_action_already_active";
          for(const channel of proposal.channels)claimedChannels.add(channel);
          granted.push(proposal);
          proposal.onGranted?.({ok:true,preserved:true,action:current},proposal);
          this.#record("action_proposal_preserved",proposal,now,{actionId:current.id});
          continue;
        }
        const result=this.scheduler.start(proposal.action,{now,context});
        if(result.ok){
          proposal.status="granted";
          proposal.resultReason="scheduler_granted";
          for(const channel of proposal.channels)claimedChannels.add(channel);
          granted.push(proposal);
          proposal.onGranted?.(result,proposal);
          this.#record("action_proposal_granted",proposal,now,{actionId:proposal.action.id,preempted:result.preempted??[]});
        }else{
          proposal.status="rejected";
          proposal.resultReason=result.reason??"scheduler_rejected";
          proposal.onRejected?.(proposal.resultReason,proposal);
          rejected.push(proposal);
          this.#record("action_proposal_rejected",proposal,now,{blockingActionType:result.blockingActionType??null});
        }
      }
      const active=this.scheduler.getActions(actorId).map(action=>({
        actionId:action.id,
        actionType:action.type,
        channels:[...(action.channels??[])],
        purpose:action.purpose,
        priority:action.priority,
        provenance:cloneProvenance(action.metadata?.provenance)
      }));
      this.traces.set(actorId,{
        actorId,
        frame:this.frame,
        evaluatedAt:now,
        granted:granted.map(cloneProposal),
        rejected:rejected.map(cloneProposal),
        active
      });
    }
  }

  getTrace(actorId){
    const trace=this.traces.get(actorId);
    return trace?{
      ...trace,
      granted:trace.granted.map(cloneProposal),
      rejected:trace.rejected.map(cloneProposal),
      active:trace.active.map(item=>({...item,channels:[...item.channels],provenance:cloneProvenance(item.provenance)}))
    }:null;
  }

  summary(){return[...this.traces.values()].map(trace=>this.getTrace(trace.actorId));}

  #record(type,proposal,time,data={}){
    this.decisionLog?.record?.({
      type,
      time,
      actorId:proposal.actorId,
      actionType:proposal.actionType,
      data:{
        proposalId:proposal.id,
        source:proposal.source,
        authorityTier:proposal.authorityTier,
        authorityLabel:proposal.authorityLabel,
        score:proposal.score,
        urgency:proposal.urgency,
        reason:proposal.reason,
        resultReason:proposal.resultReason,
        operationId:proposal.operationId,
        missionId:proposal.missionId,
        governingIntentId:proposal.governingIntentId,
        supportingIntentId:proposal.supportingIntentId,
        procedureId:proposal.procedureId,
        roleId:proposal.roleId,
        channels:[...proposal.channels],
        ...data
      }
    });
  }
}
