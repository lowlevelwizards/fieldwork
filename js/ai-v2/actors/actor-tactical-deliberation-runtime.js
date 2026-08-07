import { TacticalRepositionAction } from "../actions/tactical-reposition-action.js";
import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { ContactFireAction } from "../actions/contact-fire-action.js";
import { ReloadWeaponAction } from "../actions/reload-weapon-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
import { ActorTacticalCommitmentStore } from "./actor-tactical-commitment-store.js";
import { ActorUtilityEvaluationService } from "./actor-utility-evaluation-service.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const stableAngle=text=>{let hash=2166136261;for(const ch of String(text)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}return((hash>>>0)%6283)/1000;};

export class ActorTacticalDeliberationRuntime{
  constructor({brain=null,arbiter=null,commitments=null,utilityEvaluation=null,positionSlots=null,decisionLog=null}={}){
    this.brain=brain??arbiter;this.commitments=commitments??new ActorTacticalCommitmentStore({decisionLog});
    this.utilityEvaluation=utilityEvaluation??new ActorUtilityEvaluationService({decisionLog});this.positionSlots=positionSlots;this.decisionLog=decisionLog;this.byActor=new Map();
  }
  update({game,tacticalPictures,teamProcedures,teamAgenda,actorObligations=null,now=0}={}){
    const live=[];
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||actor.medical?.condition==="critical")continue;live.push(actor.id);
      const picture=tacticalPictures?.get?.(actor.id);if(!picture)continue;
      const role=teamProcedures?.getActorRole?.(actor.id)??null,agenda=teamAgenda?.get?.(actor.teamId)??null;
      const liveClosure=game?.scenarioMode==="live"&&Boolean(game?.livingSandbox?.liveMode);
      const selfAidObligation=actorObligations?.findForActor?.(actor.id,{kind:"self_aid"})??null;
      const casualtyCareObligation=liveClosure?actorObligations?.findForActor?.(actor.id,{concernKind:"friendly_casualty",responsibility:"carrier_or_aid_provider"})??null:null;
      const contactObligation=actorObligations?.findForActor?.(actor.id,{concernKind:["hostile_contact","uncertain_contact"]})??null;
      const protectedCareDuty=Boolean(casualtyCareObligation?.required);
      const defensiveProcedure=role?.procedureId==="defensive_position";
      const procedureOwnsMovement=Boolean(liveClosure&&role?.permissions?.relocate&&["protective_breakaway","break_contact_quietly","casualty_evacuation","casualty_recovery"].includes(role?.procedureId));
      const responsibilityId=role?`${role.procedureId}:${role.roleId}`:agenda?.intentId??null;
      const threatTrackId=picture.bestThreat?.subjectId??picture.bestThreat?.subjectTeamId??null;
      const existing=this.commitments?.get?.(actor.id)??null;
      if(existing&&existing.responsibilityId&&responsibilityId&&existing.responsibilityId!==responsibilityId)this.commitments.release(actor.id,{now,reason:"governing_responsibility_changed"});
      const activeActions=this.brain?.scheduler?.getActions?.(actor.id)??[];
      const activeAction=this.brain?.scheduler?.getPrimaryAction?.(actor.id)??activeActions[0]??null;
      const utility=this.utilityEvaluation.evaluate({game,actor,picture,currentAction:activeAction,currentCommitment:existing,role,agenda,now});
      actor.aiV2UtilityEvaluation=utility;
      // 3.2B: deliberation remains live while the actor is already moving,
      // treating, firing, or otherwise occupied. Channel ownership and the
      // centralized replanning policy decide whether a new candidate may act;
      // being busy is no longer equivalent to being unable to reconsider.
      const common={operationId:actor.operationId??null,missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null};
      const contactPressure=utility.contactPressure??0;
      if(contactPressure>=.34){actor.operationPausedByEncounter=true;actor.aiV2ContactSalience={status:"material",pressure:contactPressure,subjectTeamId:picture.bestThreat?.subjectTeamId??null,updatedAt:now};}
      const personallyVisible=picture.visibleThreats?.filter(item=>!["friendly","cooperating","same_faction"].includes(item.relationship))?.[0]??null;
      if(personallyVisible&&contactPressure>=.34&&picture.weaponReadiness?.ammoInMagazine>0){
        const threatDistance=Math.hypot((personallyVisible.approximatePosition?.x??actor.x)-actor.x,(personallyVisible.approximatePosition?.y??actor.y)-actor.y);
        const immediate=Boolean(picture.incomingFire?.length||threatDistance<230);
        const reactiveFire=new ContactFireAction({actorId:actor.id,directive:{subjectTeamId:personallyVisible.subjectTeamId,targetActorId:personallyVisible.subjectId,targetPoint:{...personallyVisible.approximatePosition},maximumRounds:immediate?2:1,reason:immediate?"A personally visible hostile is dangerously close or firing; return a finite reflexive burst while locomotion remains free to seek protection.":"Maintain one bounded personally justified shot while independently improving position.",provenance:{owner:"actor_tactical_deliberation",source:"personal_threat_reflex"}}});
        if(immediate||!protectedCareDuty)this.brain?.submit?.({actorId:actor.id,action:reactiveFire,score:.82+contactPressure*.12,urgency:immediate?.99:.72,authorityTier:immediate?ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,authorityLabel:immediate?"Immediate personal threat":"Actor combat execution",reason:reactiveFire.purpose,source:"actor_personal_threat_reflex",...common});
      }
      let proposal=null;
      const bestCover=picture.bestCover;
      const currentProtection=picture.currentCover?.protection??0;
      const coverImprovement=(bestCover?.utility?.protection??0)-currentProtection;
      const treatmentNeedsCover=Boolean(picture.selfAidNeed&&picture.exposed&&!((picture.woundState?.bleeding??0)>1.2));
      const contactNeedsCover=Boolean(contactPressure>=.34&&picture.exposed&&!protectedCareDuty);
      if(!defensiveProcedure&&bestCover?.point&&(treatmentNeedsCover||contactNeedsCover||utility.selected?.kind==="seek_cover")&&(coverImprovement>=.08||picture.exposed)){
        const emergency=Boolean(picture.incomingFire?.length||["pinned","breaking"].includes(picture.suppressionState));
        if(!liveClosure){
          const action=new TacticalRepositionAction({actorId:actor.id,directive:{kind:treatmentNeedsCover?"seek_treatment_cover":"seek_cover",label:treatmentNeedsCover?"Creating a treatment window":"Reacting to material contact",destination:{...bestCover.point},threatPoint:picture.threatPoint?{...picture.threatPoint}:null,speedMultiplier:emergency?.96:.78,minimumCommitment:1.2,reason:treatmentNeedsCover?"Self aid is useful but unsafe here; first occupy a distinct protected slot.":"Material hostile contact makes unchanged exposed travel low utility; move to a claimed directional-cover slot.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_utility"}}});
          proposal={action,score:Math.max(.74,utility.candidates.find(x=>x.kind==="seek_cover")?.score??0),urgency:emergency?.98:Math.max(.58,contactPressure),tier:emergency?ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,label:emergency?"Immediate survival":"Material contact response",kind:treatmentNeedsCover?"acquire_treatment_cover":"acquire_directional_cover",desiredEffect:treatmentNeedsCover?"create_treatment_window":"break_exposed_contact_route",minimumUntil:now+1.4,maximumUntil:now+10,anchorPoint:bestCover.point,slot:bestCover,...common};
        }else if(!procedureOwnsMovement||emergency){
          const coverKind=treatmentNeedsCover?"acquire_treatment_cover":"acquire_directional_cover";
          const stickyCover=existing?.kind===coverKind&&existing.anchorPoint&&existing.threatTrackId===threatTrackId&&now<(existing.minimumUntil??0);
          const destination=stickyCover?{...existing.anchorPoint}:{...bestCover.point};
          const action=new TacticalRepositionAction({actorId:actor.id,directive:{kind:treatmentNeedsCover?"seek_treatment_cover":"seek_cover",label:treatmentNeedsCover?"Creating a treatment window":"Reacting to material contact",destination,coverSlot:stickyCover?null:bestCover,threatPoint:picture.threatPoint?{...picture.threatPoint}:null,speedMultiplier:emergency?.96:.78,minimumCommitment:1.2,reason:treatmentNeedsCover?"Self aid is useful but unsafe here; first occupy a stable protected treatment position.":"Material hostile contact makes unchanged exposed travel low utility; commit briefly to one useful protected position, then keep reconsidering the method.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_utility"}}});
          proposal={action,score:Math.max(.74,utility.candidates.find(x=>x.kind==="seek_cover")?.score??0),urgency:emergency?.98:Math.max(.58,contactPressure),tier:emergency?ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,label:emergency?"Immediate survival":"Material contact response",kind:coverKind,desiredEffect:treatmentNeedsCover?"create_treatment_window":"break_exposed_contact_route",minimumUntil:now+1.4,maximumUntil:now+8,anchorPoint:destination,slot:stickyCover?null:bestCover,...common};
        }
      }
      if(!proposal&&!protectedCareDuty&&picture.weaponReadiness?.reloadAdvised&&picture.currentCover?.protected&&!actor.reloading){
        const action=new ReloadWeaponAction({actorId:actor.id,directive:{duration:1.65,reason:"Weapon readiness is low and protected reload utility exceeds continued exposure or empty fire attempts.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_utility"}}});
        proposal={action,score:utility.candidates.find(x=>x.kind==="reload_safely")?.score??.63,urgency:picture.weaponReadiness.reloadRequired?.78:.34,tier:picture.weaponReadiness.reloadRequired?ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT,label:"Weapon readiness",kind:"reload_safely",desiredEffect:"restore_weapon_readiness",minimumUntil:now+1.5,maximumUntil:now+4,...common};
      }
      const visible=personallyVisible;
      if(!proposal&&!protectedCareDuty&&visible&&picture.currentCover?.protected&&picture.weaponReadiness?.ammoInMagazine>0&&contactPressure>=.34){
        const action=new ContactFireAction({actorId:actor.id,directive:{subjectTeamId:visible.subjectTeamId,targetActorId:visible.subjectId,targetPoint:{...visible.approximatePosition},maximumRounds:Math.min(3,picture.weaponReadiness.ammoInMagazine),reason:"A personally visible materially hostile contact justifies one finite burst before utility is recomputed.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_utility_bounded_fire"}}});
        proposal={action,score:.76+contactPressure*.12,urgency:.64+contactPressure*.22,tier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,label:"Material contact response",kind:"maintain_security_sector",desiredEffect:"interrupt_visible_hostile_activity",minimumUntil:now+1,maximumUntil:now+5,anchorPoint:{x:actor.x,y:actor.y},...common};
      }
      if(!proposal&&!defensiveProcedure&&!role&&!picture.bestThreat&&actor.aiV2Assignment?.action!=="observe_sector"&&contactPressure<.18&&!actor.aiV2CoverOccupancy?.status?.includes("protected")&&(utility.selected?.kind==="restore_spacing"||utility.selected?.kind==="break_stagnation")){
        const teammateId=picture.nearestFriendly?.actorId;const teammate=game.actors.find(candidate=>candidate.id===teammateId);
        let destination=null;
        const stickySpacing=Boolean(liveClosure&&existing?.kind==="restore_safe_spacing"&&existing.anchorPoint&&now<(existing.minimumUntil??0));
        if(stickySpacing)destination={...existing.anchorPoint};
        else if(teammate){let dx=actor.x-teammate.x,dy=actor.y-teammate.y;const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;destination={x:actor.x+dx*96,y:actor.y+dy*96};}
        else destination=null;
        if(destination&&stickySpacing&&Math.hypot(destination.x-actor.x,destination.y-actor.y)<32){this.byActor.set(actor.id,{...existing,status:"satisfied",utility});continue;}
        if(!destination){if(existing)this.byActor.set(actor.id,{...existing,status:"maintaining",utility});continue;}
        const action=new TacticalRepositionAction({actorId:actor.id,directive:{kind:"clear_congestion",label:"Redistributing from congested cover",destination,threatPoint:picture.threatPoint,speedMultiplier:.62,minimumCommitment:.9,reason:"The current cluster is crowded or stagnant; local redistribution now has greater utility than remaining stacked.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_utility"}}});
        proposal={action,score:Math.max(.5,utility.selected?.score??0),urgency:.24,tier:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT,label:"Local tactical improvement",kind:"restore_safe_spacing",desiredEffect:"clear_congestion",minimumUntil:now+1,maximumUntil:now+5,anchorPoint:destination,...common};
      }
      if(!proposal&&(contactPressure>=.18||utility.selected?.kind==="scan")){
        const focus=picture.threatPoint??(()=>{const angle=stableAngle(`${actor.id}:${Math.floor(now/2.5)}`);return{x:actor.x+Math.cos(angle)*260,y:actor.y+Math.sin(angle)*260};})();
        const action=new HoldReadyAction({actorId:actor.id,directive:{label:picture.threatPoint?"Tracking material contact":"Active route scan",focus,reason:picture.threatPoint?"Maintain visual attention on the contact while the next physical response is weighed.":"Use unclaimed attention to scan continuously rather than facing rigidly along the route.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_attention"}}});
        proposal={action,score:utility.candidates.find(x=>x.kind==="scan")?.score??.34,urgency:contactPressure*.45,tier:contactPressure>=.34?ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN:ACTION_AUTHORITY_TIERS.AMBIENT_AUTONOMY,label:contactPressure>=.34?"Supporting tactical concern":"Ambient autonomy",kind:"maintain_security_sector",desiredEffect:"actively_observe",minimumUntil:now+.8,maximumUntil:now+4,anchorPoint:{x:actor.x,y:actor.y},...common};
      }
      if(!proposal){if(existing)this.byActor.set(actor.id,{...existing,status:"maintaining",utility});continue;}
      const obligation=proposal.kind==="acquire_treatment_cover"?selfAidObligation:["acquire_directional_cover","reload_safely","maintain_security_sector"].includes(proposal.kind)?contactObligation:null;
      if(obligation){proposal.obligationId=obligation.id;proposal.tier=Math.max(proposal.tier,obligation.authorityTier??proposal.tier);proposal.score=Math.max(proposal.score,obligation.priority??0);proposal.urgency=Math.max(proposal.urgency,obligation.urgency??0);}
      this.brain?.submit?.({actorId:actor.id,action:proposal.action,score:proposal.score,urgency:proposal.urgency,authorityTier:proposal.tier,authorityLabel:proposal.label,reason:proposal.action.purpose,source:"actor_tactical_deliberation",obligationId:proposal.obligationId??null,operationId:proposal.operationId,missionId:proposal.missionId,governingIntentId:proposal.governingIntentId,procedureId:proposal.procedureId,roleId:proposal.roleId,onGranted:()=>{
        if(proposal.slot)this.positionSlots?.claim?.({actorId:actor.id,slot:proposal.slot,now,duration:12,purpose:proposal.kind});
        const record=this.commitments.commit({actorId:actor.id,kind:proposal.kind,responsibilityId,procedureId:proposal.procedureId,roleId:proposal.roleId,threatTrackId,anchorPoint:proposal.anchorPoint,threatPoint:picture.threatPoint,desiredEffect:proposal.desiredEffect,minimumUntil:proposal.minimumUntil,maximumUntil:proposal.maximumUntil,reason:proposal.action.purpose,provenance:{owner:"actor_tactical_deliberation",authorityTier:proposal.tier}}, {now});
        this.byActor.set(actor.id,{...record,status:"acting",actionType:proposal.action.type,utility});actor.aiV2TacticalCommitment={...record};
      }});
    }
    this.commitments?.prune?.(live,{now});this.utilityEvaluation?.prune?.(live);for(const actorId of [...this.byActor.keys()])if(!live.includes(actorId))this.byActor.delete(actorId);
  }
  summary(){return this.commitments?.summary?.()??[...this.byActor.values()].map(item=>({...item}));}
}
