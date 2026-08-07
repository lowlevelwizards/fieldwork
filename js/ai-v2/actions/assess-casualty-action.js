import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class AssessCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"AssessCasualty",actorId,purpose:directive?.reason??"Assess the casualty before deciding treatment",channels:[ACTION_CHANNELS.HANDS,ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.COMMUNICATION],primary:true,displayPriority:82,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive};this.elapsed=0;this.duration=directive?.duration??1.8;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&Math.hypot(actor.x-casualty.x,actor.y-casualty.y)<=this.directive.interactionRange);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty||actor.medical?.dead||actor.medical?.unconscious||casualty.medical?.dead||Math.hypot(actor.x-casualty.x,actor.y-casualty.y)>Math.max(56,Number(this.directive.interactionRange)||92))return false;
    if(this.directive.obligationId){
      const obligation=services?.actorObligations?.getById?.(this.directive.obligationId)??null;
      return Boolean(obligation&&!["resolved","abandoned"].includes(obligation.status)&&this.elapsed<this.duration+.5);
    }
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="assess_condition");
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    if(actor){actor.currentAction="Assessing casualty";actor.workPose="medical";actor.workProp="medical_bag";actor.aiV2Recovery={status:"assessing",phase:"desired_effect_assessment",casualtyId:this.directive.casualtyId,progress:0,startedAt:now};}
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    this.elapsed+=delta;this.progress=Math.min(1,this.elapsed/this.duration);actor.aiV2Recovery={status:"assessing",phase:"desired_effect_assessment",casualtyId:casualty.id,progress:this.progress,startedAt:this.startedAt};
    if(this.progress<1)return null;
    const assessment=services.casualtyCare.assess(game,casualty);if(!assessment){this.#cleanup(actor);return{status:"failed",reason:"assessment_unavailable"};}
    const recipients=services.communication.findVoiceRecipients(game,actor,{range:this.directive.reportRange??650}).map(item=>item.id);
    const report=services.casualtyKnowledge.recordAssessment({assessor:actor,casualty,assessment,recipientIds:recipients,method:"local_voice",now});
    this.#cleanup(actor);actor.currentAction="Casualty assessed";
    if(this.directive.procedureId)services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_assessed",now,data:{actorId:actor.id,casualtyId:casualty.id,reportId:report?.id??null,condition:assessment.condition,treatmentNeed:assessment.need?.type??null,mobility:report?.assessment?.mobility??null}});
    return{status:"completed",reason:"casualty_assessed",data:{condition:assessment.condition,treatmentNeed:assessment.need?.type??null}};
  }

  onInterrupted({game}={}){const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);this.#cleanup(actor);}
  onCancelled(context={}){this.onInterrupted(context);}
  #cleanup(actor){if(actor){actor.workPose=null;actor.workProp=null;}}
}
