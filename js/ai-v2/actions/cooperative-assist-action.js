import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class CooperativeAssistAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"CooperativeAssist",actorId,purpose:directive?.reason??"Provide bounded assistance to another field team",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:54,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,assistPoint:directive?.assistPoint?{...directive.assistPoint}:null,objectivePoint:directive?.objectivePoint?{...directive.objectivePoint}:null};
    this.claimed=false;
  }
  canStart({game,services}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);return Boolean(actor&&this.directive.assistPoint&&services?.relationships?.getContract?.(actor.teamId,this.directive.subjectTeamId,{now:game.aiV2?.elapsed??0}));}
  canContinue({game,services,now=0}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);const contract=actor?services?.relationships?.getContract?.(actor.teamId,this.directive.subjectTeamId,{now}):null;const role=actor?services?.teamProcedures?.getActorRole?.(actor.id):null;return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&contract&&["parallel_work","shared_security","cooperate"].includes(contract.type)&&role?.roleId===this.directive.roleId&&role?.procedureId===this.directive.procedureId&&(!this.directive.phaseId||role?.phase?.id===this.directive.phaseId));}
  start(now,{game,services}={}){super.start(now,{game,services});const actor=game.actors.find(item=>item.id===this.actorId);this.claimed=services.objectives.claimAssist({objectiveId:this.directive.objectiveId,actorId:this.actorId,teamId:actor?.teamId,now});if(actor)actor.currentAction=this.claimed?"Moving to assist neighboring team":"Cooperative assist position unavailable";}
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(item=>item.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};if(!this.claimed)return{status:"failed",reason:"assist_claim_rejected"};
    services.objectives.renewAssist(this.directive.objectiveId,actor.id,{now});
    if(distance(actor,this.directive.assistPoint)>28){const result=services.locomotion.moveToward(actor,this.directive.assistPoint,delta,{game,speedMultiplier:.62,arrivalRadius:19,task:"Moving to assist nearby operation",pose:"walk"});if(result.failed)return{status:"failed",reason:result.reason};if(!result.arrived)return null;services.locomotion.stop(actor);}
    services.attention.turnToward(actor,this.directive.objectivePoint,delta,{pose:"work",turnRate:4});
    actor.currentAction="Assisting neighboring field team";actor.aiV2Cooperation={status:"assisting",subjectTeamId:this.directive.subjectTeamId,objectiveId:this.directive.objectiveId,contractId:this.directive.contractId};this.progress=.5;return null;
  }
  onInterrupted({services,now=0}={}){services?.objectives?.releaseAssist?.(this.directive.objectiveId,this.actorId,{now,reason:"interrupted"});}
  onCancelled({services,now=0}={}){services?.objectives?.releaseAssist?.(this.directive.objectiveId,this.actorId,{now,reason:"cancelled"});}
}
