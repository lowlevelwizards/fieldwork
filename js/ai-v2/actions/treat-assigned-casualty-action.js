import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

/**
 * Obligation-driven treatment atom. The durable casualty obligation owns why
 * care is required; this action only owns one physical treatment window.
 */
export class TreatAssignedCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"TreatAssignedCasualty",actorId,
      purpose:directive?.reason??"Treat the staffed friendly casualty",
      channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS,ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],
      primary:true,displayPriority:172,priority:940,interruptible:true,
      metadata:{directive:{...directive},provenance:directive?.provenance??null,casualtyId:directive?.casualtyId??null}
    });
    this.directive={...directive};this.elapsed=0;this.duration=Math.max(.8,Number(directive?.duration)||2.6);this.patientClaimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty||actor.medical?.dead||actor.medical?.unconscious||casualty.medical?.dead)return false;
    if(distance(actor,casualty)>Math.max(48,Number(this.directive.interactionRange)||92))return false;
    const need=game?.wounds?.getTreatmentNeed?.(casualty)??null;if(!need||Number(actor.aiV2MedicalSupplies?.[need.type]??0)<=0)return false;
    const controller=services?.casualtyCare?.getController?.(casualty.id)??null;return !controller||controller===actor.id;
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const obligation=this.directive.obligationId?services?.actorObligations?.getById?.(this.directive.obligationId)??null:null;
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&
      (!this.directive.obligationId||obligation&&!["resolved","abandoned"].includes(obligation.status))&&
      distance(actor,casualty)<=Math.max(56,Number(this.directive.interactionRange)||92)&&game?.wounds?.getTreatmentNeed?.(casualty)&&this.elapsed<this.duration+.5);
  }

  start(now,{game,services}={}){
    super.start(now,{game,services});const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    this.patientClaimed=Boolean(services?.casualtyCare?.claimPatient?.({patientId:casualty?.id,actorId:actor?.id})?.ok);
    if(!actor||!casualty)return;services?.locomotion?.stop?.(actor,{pose:"medical"});actor.operationPausedByEncounter=true;actor.currentAction=`Treating ${casualty.name??"casualty"}`;actor.workPose="medical";actor.workProp="medical_bag";actor.workMedicalItem=game?.wounds?.getTreatmentNeed?.(casualty)?.type??"pressure_dressing";
    actor.aiV2DirectCare={status:this.patientClaimed?"treating":"blocked",casualtyId:casualty.id,obligationId:this.directive.obligationId,startedAt:now,progress:0};
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"care_subject_missing"};if(!this.patientClaimed)return{status:"failed",reason:"patient_claim_rejected"};
    if(distance(actor,casualty)>Math.max(56,Number(this.directive.interactionRange)||92))return{status:"failed",reason:"casualty_moved_out_of_reach"};
    services?.locomotion?.stop?.(actor,{pose:"medical"});services?.attention?.turnToward?.(actor,casualty,delta,{pose:"medical",turnRate:7});
    this.elapsed+=Math.max(0,delta);this.progress=Math.min(1,this.elapsed/this.duration);actor.currentAction=`Treating ${casualty.name??"casualty"}`;actor.aiV2DirectCare={status:"treating",casualtyId:casualty.id,obligationId:this.directive.obligationId,startedAt:this.startedAt,progress:this.progress};
    if(this.progress<1)return null;
    const result=services?.casualtyCare?.stabilize?.({game,provider:actor,patient:casualty})??{ok:false,reason:"care_executor_missing"};
    if(!result.ok){this.#release(actor,casualty,services,"failed");return{status:"failed",reason:result.reason};}
    const assessment=services?.casualtyCare?.assess?.(game,casualty)??null;
    if(assessment&&services?.casualtyKnowledge){
      const recipients=services?.communication?.findVoiceRecipients?.(game,actor,{range:this.directive.reportRange??520})?.map?.(item=>item.id)??[];
      services.casualtyKnowledge.recordAssessment({assessor:actor,casualty,assessment,recipientIds:recipients,method:"local_voice",now});
    }
    this.#release(actor,casualty,services,"completed");actor.aiV2DirectCare={status:"completed",casualtyId:casualty.id,obligationId:this.directive.obligationId,completedAt:now,progress:1,treatmentType:result.treatmentType};
    if(this.directive.procedureId)services?.teamProcedures?.notifyEvent?.({teamId:actor.teamId,event:"casualty_stabilized",now,data:{actorId:actor.id,casualtyId:casualty.id,treatmentType:result.treatmentType,condition:assessment?.condition??null,bleeding:assessment?.bleeding??null}});
    return{status:"completed",reason:"staffed_casualty_treated",data:{casualtyId:casualty.id,treatmentType:result.treatmentType}};
  }

  onInterrupted({game,services}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);this.#release(actor,casualty,services,"interrupted");}
  onCancelled(context={}){this.onInterrupted(context);}
  #release(actor,casualty,services,status){if(casualty)services?.casualtyCare?.releasePatient?.(casualty.id,this.actorId);if(!actor)return;actor.operationPausedByEncounter=false;actor.workPose=null;actor.workProp=null;actor.workMedicalItem=null;actor.aiV2DirectCare={...(actor.aiV2DirectCare??{}),status};this.patientClaimed=false;}
}
