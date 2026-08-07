import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class SelfAidAction extends AIV2Action{
  constructor({actorId,duration=2.8,allowExposed=false}={}){
    super({
      type:"SelfAid",
      actorId,
      purpose:"Stop unsafe mission movement and control the actor's own bleeding.",
      channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS,ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,
      displayPriority:190,
      priority:1200,
      interruptible:false,
      metadata:{provenance:{owner:"actor_initiative",source:"personal_wound_state"}}
    });
    this.duration=Math.max(.8,Number(duration)||2.8);
    this.allowExposed=Boolean(allowExposed);
    this.elapsed=0;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const need=actor?game?.wounds?.getTreatmentNeed?.(actor):null;
    const catastrophic=Number(actor?.medical?.bleedingRate??0)>1.2||actor?.medical?.condition==="critical";
    const treatmentSafe=actor?.aiV2TacticalPicture?.treatmentSafe!==false;
    const controller=actor?services?.casualtyCare?.getController?.(actor.id)??null:null;
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&(!controller||controller===actor.id)&&need&&Number(actor.aiV2MedicalSupplies?.[need.type]??0)>0&&(catastrophic||treatmentSafe||this.allowExposed));
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&game?.wounds?.getTreatmentNeed?.(actor));
  }

  start(now,{game,services}={}){
    super.start(now,{game,services});
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(actor){
      services?.locomotion?.stop?.(actor,{pose:"medical"});
      actor.operationPausedByEncounter=true;
      actor.currentAction="Applying self aid";
      actor.workPose="medical";
      actor.workProp="medical_bag";
      actor.workMedicalItem=game?.wounds?.getTreatmentNeed?.(actor)?.type??"pressure_dressing";
      actor.aiV2SelfAid={status:"active",startedAt:now,progress:0};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    services?.locomotion?.stop?.(actor,{pose:"medical"});
    this.elapsed+=Math.max(0,delta);
    this.progress=Math.min(1,this.elapsed/this.duration);
    actor.currentAction="Controlling own bleeding";
    actor.workPose="medical";
    actor.aiV2SelfAid={status:"active",startedAt:this.startedAt,progress:this.progress};
    if(this.progress<1)return null;
    const result=services?.casualtyCare?.stabilize?.({game,provider:actor,patient:actor})??{ok:false,reason:"care_executor_missing"};
    if(!result.ok)return{status:"failed",reason:result.reason};
    actor.operationPausedByEncounter=false;
    actor.workPose=null;actor.workProp=null;actor.workMedicalItem=null;
    actor.aiV2SelfAid={status:"completed",completedAt:now,progress:1,treatmentType:result.treatmentType};
    return{status:"completed",reason:"self_aid_completed",data:{treatmentType:result.treatmentType}};
  }

  onInterrupted({game}={}){this.#release(game,"interrupted");}
  onCancelled({game}={}){this.#release(game,"cancelled");}
  #release(game,status){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.operationPausedByEncounter=false;
    actor.workPose=null;actor.workProp=null;actor.workMedicalItem=null;
    actor.aiV2SelfAid={...(actor.aiV2SelfAid??{}),status};
  }
}
