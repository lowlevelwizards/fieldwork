import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class InspectObjectiveAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"InspectObjective",actorId,
      purpose:directive?.reason??"Inspect the assigned objective before beginning work",
      channels:[ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.HANDS],primary:true,displayPriority:72,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive,objectivePoint:directive?.objectivePoint?{...directive.objectivePoint}:null};
    this.elapsed=0;
    this.claimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const objective=services?.objectives?.get?.(this.directive.objectiveId);
    return Boolean(actor&&objective&&!actor.medical?.dead&&!actor.medical?.unconscious&&distance(actor,objective)<=Math.max(48,objective.interactionRadius??78));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    const objective=services?.objectives?.get?.(this.directive.objectiveId);
    return Boolean(actor&&objective&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="inspect_objective"&&distance(actor,objective)<=Math.max(48,objective.interactionRadius??78));
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    this.claimed=Boolean(context.services.objectives.claimWork({objectiveId:this.directive.objectiveId,actorId:this.actorId,teamId:actor?.teamId,purpose:"inspect",now})?.ok);
    if(actor){
      actor.currentAction=this.claimed?"Inspecting field objective":"Objective inspection blocked";
      actor.aiV2Objective={status:this.claimed?"inspecting":"blocked",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId,progress:0};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    if(!this.claimed)return{status:"failed",reason:"objective_inspection_claim_rejected"};
    services.objectives.renewWork(this.directive.objectiveId,actor.id,{now});
    services.attention.turnToward(actor,this.directive.objectivePoint,delta,{pose:"work",turnRate:4});
    this.elapsed+=delta;
    const duration=Math.max(.25,this.directive.duration??1.2);
    this.progress=Math.min(1,this.elapsed/duration);
    actor.currentAction="Inspecting field objective";
    actor.aiV2Objective={status:"inspecting",objectiveId:this.directive.objectiveId,roleId:this.directive.roleId,progress:this.progress};
    if(this.elapsed<duration)return null;
    const result=services.objectives.inspect({objectiveId:this.directive.objectiveId,actorId:actor.id,now});
    services.objectives.releaseWork(this.directive.objectiveId,actor.id,{now,reason:"inspection_complete"});
    if(!result.ok)return{status:"failed",reason:result.reason};
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"objective_inspected",now,data:{actorId:actor.id,objectiveId:this.directive.objectiveId,state:result.objective?.state}});
    actor.currentAction="Objective inspected";
    return{status:"completed",reason:"objective_inspected",data:{objectiveId:this.directive.objectiveId}};
  }
}
