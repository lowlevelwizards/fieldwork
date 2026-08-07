import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

export const REPLAN_DECISIONS=Object.freeze({
  PRESERVE:"preserve",
  AMEND:"amend",
  REPLACE:"replace"
});

const authorityOf=action=>Number(action?.metadata?.actorBrainPlan?.authorityTier??action?.priority??0)||0;
const utilityOf=(action,context)=>Number(action?.continuationUtility?.(context)??action?.metadata?.utilityScore??0)||0;
const urgencyOf=action=>Number(action?.metadata?.actorBrainPlan?.urgency??0)||0;
const point=value=>value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))?{x:Number(value.x),y:Number(value.y)}:null;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function directiveSignature(action){
  const directive=action?.directive??action?.metadata?.directive??{};
  const goal=point(directive.destination??directive.goal??directive.waypoint??directive.approachPoint??directive.recoveryPoint??directive.intent?.goal??directive.intent?.region?.center);
  const focus=point(directive.focus??directive.targetPoint??directive.threatPoint);
  return{
    kind:directive.kind??directive.intent?.kind??null,
    waypointId:directive.waypoint?.id??directive.waypointId??null,
    subjectTeamId:directive.subjectTeamId??null,
    targetActorId:directive.targetActorId??directive.patientId??null,
    goal,
    focus
  };
}

function directiveChanged(candidateAction,incumbent){
  const next=directiveSignature(candidateAction),prior=directiveSignature(incumbent);
  if(next.kind!==prior.kind||next.waypointId!==prior.waypointId||next.subjectTeamId!==prior.subjectTeamId||next.targetActorId!==prior.targetActorId)return true;
  if(Boolean(next.goal)!==Boolean(prior.goal)||Boolean(next.focus)!==Boolean(prior.focus))return true;
  if(next.goal&&prior.goal&&distance(next.goal,prior.goal)>36)return true;
  if(next.focus&&prior.focus&&distance(next.focus,prior.focus)>44)return true;
  return false;
}

function materialChange(candidate,incumbent,liveness){
  const prior=incumbent?.metadata?.actorBrainPlan??{};
  if(candidate.authorityTier>authorityOf(incumbent))return true;
  if(candidate.obligationId&&candidate.obligationId!==prior.obligationId)return true;
  if(candidate.concernId&&candidate.concernId!==prior.concernId)return true;
  if(candidate.desiredEffect&&prior.desiredEffect&&candidate.desiredEffect!==prior.desiredEffect)return true;
  if(candidate.urgency-(Number(prior.urgency)||0)>=.24)return true;
  if(liveness?.status==="warning"||liveness?.status==="invalid")return true;
  return directiveChanged(candidate.action,incumbent);
}

function minimumCommitment(action){
  const directive=action?.directive??action?.metadata?.directive??{};
  return Math.max(0,Number(directive.minimumCommitment??action?.metadata?.minimumCommitment??0)||0);
}

export class ActorReplanningPolicy{
  constructor({baseSwitchMargin=.08,freshCommitmentSeconds=1.1,switchCooldownSeconds=1.15}={}){
    this.baseSwitchMargin=Math.max(0,Number(baseSwitchMargin)||.08);
    this.freshCommitmentSeconds=Math.max(.25,Number(freshCommitmentSeconds)||1.1);
    this.switchCooldownSeconds=Math.max(.35,Number(switchCooldownSeconds)||1.15);
    this.lastSwitchByActorChannel=new Map();
  }

  evaluate({candidate,incumbent,now=0,context={},scheduler=null}={}){
    if(!candidate||!incumbent)return{decision:REPLAN_DECISIONS.REPLACE,reason:"no_incumbent",effectiveMargin:0};
    const incumbentAuthority=authorityOf(incumbent);
    const incumbentUtility=utilityOf(incumbent,context);
    const challengerUtility=Number(candidate.score)||0;
    const incumbentUrgency=urgencyOf(incumbent);
    const urgencyAdvantage=candidate.urgency-incumbentUrgency;
    const liveness=scheduler?.liveness?.byAction?.get?.(incumbent.id)??null;
    const age=Math.max(0,now-(incumbent.startedAt??now));
    const changed=materialChange(candidate,incumbent,liveness);
    const sameType=incumbent.type===candidate.action?.type;

    const common={
      incumbentUtility,challengerUtility,incumbentAuthority,challengerAuthority:candidate.authorityTier,
      incumbentUrgency,challengerUrgency:candidate.urgency,urgencyAdvantage,age,
      livenessStatus:liveness?.status??"healthy",materialChange:changed
    };

    if(!incumbent.interruptible)return{decision:REPLAN_DECISIONS.PRESERVE,reason:`incumbent_uninterruptible:${incumbent.type}`,effectiveMargin:Infinity,...common};
    if(candidate.authorityTier>incumbentAuthority)return{decision:REPLAN_DECISIONS.REPLACE,reason:"higher_authority_challenger",effectiveMargin:0,...common};
    if(candidate.authorityTier<incumbentAuthority)return{decision:REPLAN_DECISIONS.PRESERVE,reason:`incumbent_higher_authority:${incumbent.type}`,effectiveMargin:Infinity,...common};

    let margin=this.baseSwitchMargin;
    if(age<this.freshCommitmentSeconds)margin+=.07;
    const minimum=minimumCommitment(incumbent);
    if(minimum>0&&age<minimum)margin+=.08;

    if(liveness?.status==="warning")margin-=.07;
    if(liveness?.status==="invalid")margin-=.16;
    const signals=liveness?.signals??{};
    if(Number(signals.recentReversals??0)>=2)margin-=.035;
    if(Number(signals.stalledFor??0)>.9)margin-=.04;
    if(Number(signals.regression??0)>28)margin-=.035;
    if(changed)margin-=.035;

    const channels=candidate.action?.channels??[];
    const recentSwitch=this.#latestSwitch(candidate.actorId,channels);
    if(recentSwitch&&now-recentSwitch.at<this.switchCooldownSeconds&&!changed)margin+=.075;

    margin=Math.max(.01,margin);
    const urgencyBoost=Math.max(0,urgencyAdvantage)*.2;
    const effectiveChallenger=challengerUtility+urgencyBoost;

    if(sameType){
      if(!directiveChanged(candidate.action,incumbent))return{decision:REPLAN_DECISIONS.PRESERVE,reason:"equivalent_same_type_incumbent",effectiveMargin:margin,effectiveChallenger,...common};
      if(typeof incumbent.amendFrom==="function"&&effectiveChallenger>=incumbentUtility-Math.max(.025,margin*.35)){
        return{decision:REPLAN_DECISIONS.AMEND,reason:changed?"material_same_type_update":"same_type_update_within_continuity_band",effectiveMargin:margin,effectiveChallenger,...common};
      }
    }

    if(effectiveChallenger>=incumbentUtility+margin){
      return{decision:REPLAN_DECISIONS.REPLACE,reason:changed?"materially_better_challenger":"challenger_exceeds_switch_margin",effectiveMargin:margin,effectiveChallenger,...common};
    }
    return{decision:REPLAN_DECISIONS.PRESERVE,reason:liveness?.status==="warning"?"warning_incumbent_still_preferred":"challenger_below_switch_margin",effectiveMargin:margin,effectiveChallenger,...common};
  }

  noteSwitch(actorId,channels,{now=0,fromActionType=null,toActionType=null}={}){
    for(const channel of channels??[])this.lastSwitchByActorChannel.set(`${actorId}:${channel}`,{at:now,fromActionType,toActionType});
  }

  #latestSwitch(actorId,channels){
    let latest=null;
    for(const channel of channels??[]){
      const item=this.lastSwitchByActorChannel.get(`${actorId}:${channel}`);
      if(item&&(!latest||item.at>latest.at))latest=item;
    }
    return latest;
  }
}
