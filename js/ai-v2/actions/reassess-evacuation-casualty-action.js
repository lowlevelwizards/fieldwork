import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class ReassessEvacuationCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"ReassessEvacuationCasualty",actorId,purpose:directive?.reason??"Confirm the casualty remains stable before the next route leg",channels:[ACTION_CHANNELS.HANDS,ACTION_CHANNELS.ATTENTION],primary:true,displayPriority:88,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive};
    this.duration=Math.max(.45,directive?.duration??1.25);
    this.patientClaimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&!services?.casualtyCare?.getController?.(casualty.id));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="reassess_casualty");
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    this.patientClaimed=Boolean(context.services.casualtyCare.claimPatient({patientId:this.directive.casualtyId,actorId:this.actorId})?.ok);
    if(actor){
      actor.currentAction="Reassessing casualty at waypoint";
      actor.aiV2Evacuation={status:this.patientClaimed?"reassessing":"blocked",phase:"reassess_casualty",casualtyId:this.directive.casualtyId,legIndex:this.directive.legIndex,progress:0,startedAt:now};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    if(!this.patientClaimed)return{status:"failed",reason:"patient_claim_rejected"};
    this.progress=Math.min(1,this.progress+delta/this.duration);
    actor.aiV2Evacuation={status:"reassessing",phase:"reassess_casualty",casualtyId:casualty.id,legIndex:this.directive.legIndex,progress:this.progress,startedAt:this.startedAt};
    if(this.progress<1)return null;

    const assessment=services.casualtyCare.assess(game,casualty);
    services.casualtyCare.releasePatient(casualty.id,actor.id);
    if(!assessment||assessment.dead||Number(assessment.bleeding??0)>.05){
      services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_evacuation_failed",now,data:{actorId:actor.id,phase:"reassess_casualty",legIndex:this.directive.legIndex,reason:assessment?.dead?"casualty_dead":"casualty_destabilized",bleeding:assessment?.bleeding??null}});
      return{status:"failed",reason:assessment?.dead?"casualty_dead":"casualty_destabilized"};
    }
    const recipients=services.communication.findVoiceRecipients(game,actor,{range:this.directive.reportRange??560}).map(item=>item.id);
    services.casualtyKnowledge.recordAssessment({assessor:actor,casualty,assessment,recipientIds:recipients,method:"local_voice",now});
    actor.currentAction="Casualty stable for continued evacuation";
    actor.aiV2Evacuation={status:"stable_for_next_leg",phase:"reassess_casualty",casualtyId:casualty.id,legIndex:this.directive.legIndex,progress:1,condition:assessment.condition,bleeding:assessment.bleeding,completedAt:now};
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"evacuation_reassessment_complete",now,data:{actorId:actor.id,casualtyId:casualty.id,legIndex:this.directive.legIndex,nextLegIndex:this.directive.legIndex+1,condition:assessment.condition,bleeding:assessment.bleeding,blood:assessment.blood}});
    return{status:"completed",reason:"evacuation_reassessment_complete",data:{legIndex:this.directive.legIndex,nextLegIndex:this.directive.legIndex+1,condition:assessment.condition,bleeding:assessment.bleeding}};
  }
}
