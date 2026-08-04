import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
export class AssistObjectiveWorkAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"AssistObjectiveWork",actorId,purpose:directive?.reason??"Assist the active field technician",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:56,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive,assistPoint:directive?.assistPoint?{...directive.assistPoint}:null};this.claimed=false;
  }
  canStart({game}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive.assistPoint);}
  canContinue({game,services}={}){const actor=game?.actors?.find(item=>item.id===this.actorId);const role=services?.teamProcedures?.getActorRole?.(this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.phase?.id==="perform_objective_work");}
  start(now,{game,services}={}){super.start(now,{game,services});const actor=game.actors.find(item=>item.id===this.actorId);this.claimed=services.objectives.claimAssist({objectiveId:this.directive.objectiveId,actorId:this.actorId,teamId:actor?.teamId,now});if(actor)actor.currentAction=this.claimed?"Moving to assist technical work":"Assistance position unavailable";}
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(item=>item.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};if(!this.claimed)return{status:"failed",reason:"assist_claim_rejected"};
    services.objectives.renewAssist(this.directive.objectiveId,actor.id,{now});
    if(distance(actor,this.directive.assistPoint)>26){const result=services.locomotion.moveToward(actor,this.directive.assistPoint,delta,{game,speedMultiplier:.62,arrivalRadius:18,task:"Moving to assist field work",pose:"walk"});if(result.failed)return{status:"failed",reason:result.reason};if(!result.arrived)return null;services.locomotion.stop(actor);}
    services.attention.turnToward(actor,this.directive.objectivePoint,delta,{pose:"work",turnRate:4});actor.currentAction="Assisting technical work";actor.aiV2Objective={status:"assisting",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId};this.progress=.5;return null;
  }
  onInterrupted({services,now=0}={}){services?.objectives?.releaseAssist?.(this.directive.objectiveId,this.actorId,{now,reason:"interrupted"});}
  onCancelled({services,now=0}={}){services?.objectives?.releaseAssist?.(this.directive.objectiveId,this.actorId,{now,reason:"cancelled"});}
}
