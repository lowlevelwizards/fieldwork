import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class DemonstrativeFireAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"DemonstrativeFire",
      actorId,
      purpose:directive?.reason??"Fire one deliberately offset warning round and stop",
      channels:[ACTION_CHANNELS.WEAPON,ACTION_CHANNELS.ATTENTION],
      primary:true,
      displayPriority:150,
      priority:150,
      interruptible:true,
      metadata:{directive:{...directive,targetPoint:directive?.targetPoint?{...directive.targetPoint}:null},provenance:directive?.provenance??null}
    });
    this.directive={...directive,targetPoint:directive?.targetPoint?{...directive.targetPoint}:null};
    this.elapsed=0;
    this.attempted=false;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive.targetPoint);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=actor?services?.teamProcedures?.getActorRole?.(actor.id):null;
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.phase?.id==="fire_warning_shot");
  }

  start(now,{game}={}){
    super.start(now,{game});
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(actor){
      actor.currentAction="Preparing one offset warning shot";
      actor.aiV2DemonstrativeFire={status:"aiming",targetPoint:{...this.directive.targetPoint},startedAt:now,shotsFired:0};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.elapsed+=Math.max(0,delta);
    const attention=services?.attention?.turnToward?.(actor,this.directive.targetPoint,delta,{pose:"brace",turnRate:7.2})??{settled:true};
    actor.currentAction="Aiming one warning round beside contact";
    if(!attention.settled)return null;
    if(this.attempted)return null;
    this.attempted=true;
    const result=services?.fire?.fireProtectiveShot?.({
      game,
      actor,
      targetPoint:this.directive.targetPoint,
      shotIndex:0,
      spread:0,
      eventKind:"warning_shot_near_miss",
      eventConfidence:96,
      emitThreatEvent:true
    })??{fired:false,reason:"fire_executor_missing"};
    if(!result.fired){
      actor.currentAction=result.reason==="friendly_in_line"?"Holding fire — friendly in line":"Warning shot unavailable";
      actor.aiV2DemonstrativeFire={status:"failed",targetPoint:{...this.directive.targetPoint},startedAt:this.startedAt,shotsFired:0,lastBlockReason:result.reason};
      services?.teamProcedures?.notifyEvent?.({teamId:actor.teamId,event:"warning_shot_failed",now,data:{reason:result.reason??"warning_shot_failed"}});
      return{status:"failed",reason:result.reason??"warning_shot_failed"};
    }
    this.progress=1;
    actor.currentAction="Warning shot fired; holding fire";
    actor.aiV2DemonstrativeFire={status:"complete",targetPoint:{...this.directive.targetPoint},startedAt:this.startedAt,completedAt:now,shotsFired:1,threatEventId:result.threatEventId??null};
    services?.heardCommunications?.markEnforcementUsed?.(actor.teamId,{now,eventId:result.threatEventId??null});
    services?.teamProcedures?.notifyEvent?.({teamId:actor.teamId,event:"warning_shot_fired",now,data:{actorId:actor.id,threatEventId:result.threatEventId??null}});
    game?.pushMessage?.("A single warning round cracks beside the continuing operation.",2.5);
    return{status:"completed",reason:"single_demonstrative_round_fired",data:{threatEventId:result.threatEventId??null}};
  }

  onInterrupted({game,services}={}){this.#release(game,services,"interrupted");}
  onCancelled({game,services}={}){this.#release(game,services,"cancelled");}

  #release(game,services,status){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    services?.fire?.release?.(actor);
    actor.aiV2DemonstrativeFire={...(actor.aiV2DemonstrativeFire??{}),status};
  }
}
