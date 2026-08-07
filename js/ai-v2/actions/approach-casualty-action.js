import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class ApproachCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"ApproachCasualty",actorId,purpose:directive?.reason??"Reach the assigned casualty",channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:70,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,policy:directive?.policy?{...directive.policy}:null};
    this.initialDistance=directive?.initialDistance??0;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty||actor.medical?.dead||actor.medical?.unconscious||casualty.medical?.dead)return false;
    if(this.directive.obligationId){
      const obligation=services?.actorObligations?.getById?.(this.directive.obligationId)??null;
      return Boolean(obligation&&!["resolved","abandoned"].includes(obligation.status)&&distance(actor,casualty)>Math.max(48,Number(this.directive.interactionRange)||92));
    }
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="reach_casualty");
  }

  amendFrom(next){
    if(!(next instanceof ApproachCasualtyAction)||next.directive?.casualtyId!==this.directive.casualtyId)return false;
    if(this.directive.obligationId&&next.directive?.obligationId!==this.directive.obligationId)return false;
    this.directive={...this.directive,...next.directive,policy:next.directive?.policy?{...next.directive.policy}:this.directive.policy};
    this.metadata={...(this.metadata??{}),directive:{...this.directive},provenance:this.directive.provenance??this.metadata?.provenance??null};
    this.initialDistance=Math.max(1,Number(next.initialDistance)||this.initialDistance||1);
    return true;
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    if(actor){actor.currentAction="Approaching casualty";actor.aiV2Recovery={status:"approaching",phase:"desired_effect_access",casualtyId:this.directive.casualtyId,progress:0,startedAt:now};}
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    const interactionRange=Math.max(48,Number(this.directive.interactionRange)||92);
    const currentDistance=distance(actor,casualty);
    if(currentDistance<=interactionRange){services.locomotion.stop(actor);actor.currentAction="At casualty";actor.aiV2Recovery={status:"at_casualty",phase:"desired_effect_access",casualtyId:casualty.id,progress:1,distance:currentDistance,startedAt:this.startedAt};return{status:"completed",reason:"casualty_access_established"};}
    const intent={
      kind:"casualty_approach",goal:{x:casualty.x,y:casualty.y},
      region:{type:"circle",center:{x:casualty.x,y:casualty.y},innerRadius:0,outerRadius:interactionRange*.82,preferredRadius:interactionRange*.68},
      acceptanceRadius:interactionRange*.82,preferredSeparationMin:42,preferredSeparationMax:170,
      separationWeight:1.4,cohesion:true,lookAhead:84,
      threatPoint:actor.aiV2TacticalPicture?.threatPoint?{...actor.aiV2TacticalPicture.threatPoint}:null,
      dangerRadius:340,threatRepulsionWeight:1.5
    };
    const result=services.locomotion.moveWithIntent(actor,intent,delta,{game,now,speedMultiplier:this.directive.policy?.speedMultiplier??.78,arrivalRadius:this.directive.policy?.arrivalRadius??10,task:"Reaching casualty",pose:"walk"});
    const remaining=distance(actor,casualty);
    this.progress=Math.max(0,Math.min(1,1-remaining/Math.max(1,this.initialDistance||remaining)));
    actor.aiV2Recovery={status:remaining<=interactionRange?"at_casualty":"approaching",phase:"desired_effect_access",casualtyId:casualty.id,destination:{x:casualty.x,y:casualty.y},progress:this.progress,distance:remaining,startedAt:this.startedAt};
    if(result.failed)return{status:"failed",reason:result.reason};
    if(remaining>interactionRange)return null;
    services.locomotion.stop(actor);actor.currentAction="At casualty";
    return{status:"completed",reason:"casualty_access_established"};
  }
}
