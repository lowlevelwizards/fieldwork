import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class PerformObjectiveWorkAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"PerformObjectiveWork",actorId,
      purpose:directive?.reason??"Complete the assigned field objective work",
      channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:78,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive,objectivePoint:directive?.objectivePoint?{...directive.objectivePoint}:null};
    this.claimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const objective=services?.objectives?.get?.(this.directive.objectiveId);
    return Boolean(actor&&objective&&!actor.medical?.dead&&!actor.medical?.unconscious&&["repairable","being_restored"].includes(objective.state)&&distance(actor,objective)<=Math.max(48,objective.interactionRadius??78));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    const objective=services?.objectives?.get?.(this.directive.objectiveId);
    return Boolean(actor&&objective&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="perform_objective_work"&&distance(actor,objective)<=Math.max(48,objective.interactionRadius??78));
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    this.claimed=Boolean(context.services.objectives.claimWork({objectiveId:this.directive.objectiveId,actorId:this.actorId,teamId:actor?.teamId,purpose:"restore",now})?.ok);
    if(actor){
      actor.currentAction=this.claimed?"Restoring field objective":"Objective work blocked";
      actor.aiV2Objective={status:this.claimed?"working":"blocked",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId,progress:0};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimed)return{status:"failed",reason:"objective_work_claim_rejected"};
    services.objectives.renewWork(this.directive.objectiveId,actor.id,{now});
    services.attention.turnToward(actor,this.directive.objectivePoint,delta,{pose:"work",turnRate:4});
    const result=services.objectives.advanceWork({objectiveId:this.directive.objectiveId,actorId:actor.id,teamId:actor.teamId,delta,now});
    if(!result.ok){
      services.objectives.releaseWork(this.directive.objectiveId,actor.id,{now,reason:"objective_work_failed"});
      return{status:"failed",reason:result.reason};
    }
    this.progress=result.objective?.progress??this.progress;
    actor.currentAction="Restoring field objective";
    actor.aiV2Objective={status:result.completed?"operational":"working",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId,progress:this.progress};
    if(!result.completed)return null;
    services.objectives.releaseWork(this.directive.objectiveId,actor.id,{now,reason:"objective_restored"});
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"objective_restored",now,data:{actorId:actor.id,objectiveId:this.directive.objectiveId,state:result.objective?.state}});
    actor.currentAction="Field objective operational";
    return{status:"completed",reason:"objective_restored",data:{objectiveId:this.directive.objectiveId,state:result.objective?.state}};
  }
}
