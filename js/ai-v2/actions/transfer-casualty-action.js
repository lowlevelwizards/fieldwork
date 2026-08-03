import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class TransferCasualtyAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({type:"TransferCasualty",actorId,purpose:directive?.reason??"Transfer the evacuated casualty for continued care",channels:[ACTION_CHANNELS.HANDS,ACTION_CHANNELS.COMMUNICATION],primary:true,displayPriority:94,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
    this.directive={...directive};
    this.duration=Math.max(.5,directive?.duration??1.6);
    this.patientClaimed=false;
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const interactionRange=this.directive.interactionRange??82;
    const patientDistance=actor&&casualty?Math.hypot(casualty.x-actor.x,casualty.y-actor.y):Infinity;
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&!casualty.medical?.dead&&patientDistance<=interactionRange&&!services?.casualtyCare?.getController?.(casualty.id));
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const casualty=game?.actors?.find(candidate=>candidate.id===this.directive.casualtyId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    const interactionRange=this.directive.interactionRange??82;
    const patientDistance=actor&&casualty?Math.hypot(casualty.x-actor.x,casualty.y-actor.y):Infinity;
    return Boolean(actor&&casualty&&!actor.medical?.dead&&!actor.medical?.unconscious&&patientDistance<=interactionRange&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="transfer_casualty");
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    this.patientClaimed=Boolean(context.services.casualtyCare.claimPatient({patientId:this.directive.casualtyId,actorId:this.actorId})?.ok);
    if(actor){
      actor.currentAction="Transferring casualty for continued care";
      actor.aiV2Evacuation={status:this.patientClaimed?"transferring":"blocked",phase:"transfer_casualty",casualtyId:this.directive.casualtyId,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,progress:0,startedAt:now};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    const casualty=game.actors.find(candidate=>candidate.id===this.directive.casualtyId);
    if(!actor||!casualty)return{status:"failed",reason:"actor_or_casualty_missing"};
    if(!this.patientClaimed)return{status:"failed",reason:"patient_claim_rejected"};
    this.progress=Math.min(1,this.progress+delta/this.duration);
    actor.aiV2Evacuation={status:"transferring",phase:"transfer_casualty",casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,progress:this.progress,startedAt:this.startedAt};
    if(this.progress<1)return null;

    services.casualtyCare.releasePatient(casualty.id,actor.id);
    services.casualtyCare.releaseDrag({patient:casualty});
    casualty.aiV2Evacuated=true;
    casualty.aiV2EvacuatedAt=now;
    casualty.currentTask="Transferred for continued care";
    casualty.currentAction="Evacuated alive";
    casualty.operationPausedByEncounter=true;
    actor.currentAction="Safe return confirmed";
    actor.aiV2Evacuation={status:"safe_return",phase:"safe_return",casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel,progress:1,completedAt:now};
    services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_transferred",now,data:{actorId:actor.id,casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel}});
    return{status:"completed",reason:"casualty_transferred",data:{casualtyId:casualty.id,routeId:this.directive.routeId,routeLabel:this.directive.routeLabel}};
  }
}
