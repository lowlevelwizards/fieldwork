import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class CrossTeamAidAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"CrossTeamAid",actorId,purpose:directive?.reason??"Provide bounded lifesaving aid to another field team",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.HANDS,ACTION_CHANNELS.ATTENTION],primary:true,displayPriority:84,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive};this.claimed=false;this.elapsed=0;
  }
  canStart({game,services}={}){const actor=game?.actors?.find(item=>item.id===this.actorId),patient=game?.actors?.find(item=>item.id===this.directive.patientId);return Boolean(actor&&patient&&!patient.medical?.dead&&services?.relationships?.getContract?.(actor.teamId,patient.teamId,{now:game.aiV2?.elapsed??0})?.type==="casualty_aid"&&!services?.casualtyCare?.getController?.(patient.id));}
  canContinue({game,services,now=0}={}){const actor=game?.actors?.find(item=>item.id===this.actorId),patient=game?.actors?.find(item=>item.id===this.directive.patientId);return Boolean(actor&&patient&&!actor.medical?.dead&&!actor.medical?.unconscious&&!patient.medical?.dead&&services?.relationships?.getContract?.(actor.teamId,patient.teamId,{now})?.type==="casualty_aid");}
  start(now,{game,services}={}){super.start(now,{game,services});const actor=game.actors.find(item=>item.id===this.actorId),patient=game.actors.find(item=>item.id===this.directive.patientId);this.claimed=Boolean(services.casualtyCare.claimPatient({patientId:patient?.id,actorId:actor?.id})?.ok);if(actor)actor.currentAction=this.claimed?`Moving to aid ${patient?.name??"casualty"}`:"Another responder already owns the casualty";}
  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(item=>item.id===this.actorId),patient=game.actors.find(item=>item.id===this.directive.patientId);if(!actor||!patient)return{status:"failed",reason:"actor_or_patient_missing"};if(!this.claimed)return{status:"failed",reason:"patient_claim_rejected"};
    if(distance(actor,patient)>70){const result=services.locomotion.moveToward(actor,patient,delta,{game,speedMultiplier:.72,arrivalRadius:54,task:`Approaching ${patient.name}`,pose:"walk"});if(result.failed)return{status:"failed",reason:result.reason};if(!result.arrived)return null;services.locomotion.stop(actor);}
    services.attention.turnToward(actor,patient,delta,{pose:"medical",turnRate:4.5});this.elapsed+=delta;actor.currentAction=`Providing emergency aid to ${patient.name}`;actor.aiV2Cooperation={status:"casualty_aid",subjectTeamId:patient.teamId,patientId:patient.id,contractId:this.directive.contractId};
    if(this.elapsed<1.8)return null;
    const result=services.casualtyCare.stabilize({game,provider:actor,patient});
    services.casualtyCare.releasePatient(patient.id,actor.id);
    if(result.ok){
      actor.aiV2Cooperation={status:"aid_complete",subjectTeamId:patient.teamId,patientId:patient.id,contractId:this.directive.contractId,completedAt:now};
      services.decisionLog?.record?.({type:"cross_team_casualty_stabilized",time:now,actorId:actor.id,teamId:actor.teamId,data:{patientId:patient.id,subjectTeamId:patient.teamId,sourceFactionId:actor.factionId??null,patientFactionId:patient.factionId??null,treatmentType:result.treatmentType,contractId:this.directive.contractId??null}});
      return{status:"completed",reason:"cross_team_casualty_stabilized",data:{patientId:patient.id,treatmentType:result.treatmentType}};
    }
    return{status:"failed",reason:result.reason};
  }
  onInterrupted({services}={}){services?.casualtyCare?.releasePatient?.(this.directive.patientId,this.actorId);}
  onCancelled({services}={}){services?.casualtyCare?.releasePatient?.(this.directive.patientId,this.actorId);}
}
