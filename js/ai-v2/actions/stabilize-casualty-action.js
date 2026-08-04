import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class StabilizeCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"StabilizeCasualty",actorId,purpose:directive?.reason??"Stabilize the casualty at the recovery point",channels:[ACTION_CHANNELS.HANDS,ACTION_CHANNELS.ATTENTION],primary:true,displayPriority:90,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive};this.elapsed=0;this.duration=directive?.duration??3.4;this.patientClaimed=false;
  }
  canStart({game,services}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&Math.hypot(actor.x-casualty.x,actor.y-casualty.y)<=this.directive.interactionRange&&!services?.casualtyCare?.getController?.(casualty.id));}
  canContinue({game,services}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);const role=services?.teamProcedures?.getActorRole?.(this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="stabilize");}
  start(now,context){super.start(now,context);const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);this.patientClaimed=Boolean(context.services.casualtyCare.claimPatient({patientId:this.directive.casualtyId,actorId:this.actorId})?.ok);if(actor){actor.currentAction="Stabilizing casualty";actor.workPose="medical";actor.workProp="medical_bag";actor.workMedicalItem="pressure_dressing";actor.aiV2Recovery={status:this.patientClaimed?"stabilizing":"blocked",phase:"stabilize",casualtyId:this.directive.casualtyId,progress:0,startedAt:now};}}
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};if(!this.patientClaimed)return{status:"failed",reason:"patient_claim_rejected"};
    this.elapsed+=delta;this.progress=Math.min(1,this.elapsed/this.duration);actor.aiV2Recovery={status:"stabilizing",phase:"stabilize",casualtyId:casualty.id,progress:this.progress,startedAt:this.startedAt};
    if(this.progress<1)return null;
    const result=services.casualtyCare.stabilize({game,provider:actor,patient:casualty});services.casualtyCare.releasePatient(casualty.id,actor.id);actor.workPose=null;actor.workProp=null;actor.workMedicalItem=null;
    if(!result.ok){services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_recovery_failed",now,data:{actorId:actor.id,phase:"stabilize",reason:result.reason}});return{status:"failed",reason:result.reason};}
    const assessment=services.casualtyCare.assess(game,casualty);services.casualtyKnowledge.recordAssessment({assessor:actor,casualty,assessment,recipientIds:services.communication.findVoiceRecipients(game,actor,{range:this.directive.reportRange??650}).map(item=>item.id),method:"local_voice",now});
    actor.currentAction="Casualty stabilized";actor.aiV2Recovery={status:"stabilized",phase:"recovery_complete",casualtyId:casualty.id,progress:1,treatmentType:result.treatmentType,completedAt:now};
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_stabilized",now,data:{actorId:actor.id,casualtyId:casualty.id,treatmentType:result.treatmentType,condition:assessment?.condition??null,bleeding:assessment?.bleeding??null,blood:assessment?.blood??null}});
    return{status:"completed",reason:"casualty_stabilized",data:{treatmentType:result.treatmentType,condition:assessment?.condition??null,bleeding:assessment?.bleeding??null}};
  }
}
