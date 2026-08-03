import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

function cloneDirective(directive={}){
  return{
    ...directive,
    targetPoint:directive.targetPoint?{...directive.targetPoint}:null,
    provenance:directive.provenance?{...directive.provenance}:null
  };
}

export class ProtectiveFireAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"ProtectiveFire",
      actorId,
      purpose:normalized.reason??"Provide a bounded protective burst while teammates break contact",
      channels:[ACTION_CHANNELS.WEAPON,ACTION_CHANNELS.ATTENTION],
      primary:true,
      displayPriority:120,
      priority:120,
      interruptible:true,
      metadata:{directive:normalized,provenance:normalized.provenance??null}
    });
    this.directive=normalized;
    this.cooldown=0;
    this.localShots=0;
  }

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.directive?.targetPoint);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=actor?services?.teamProcedures?.getActorRole?.(actor.id):null;
    return Boolean(
      actor&&
      !actor.medical?.dead&&
      !actor.medical?.unconscious&&
      role&&
      role.roleId===this.directive.roleId&&
      role.procedureId===this.directive.procedureId&&
      role.fulfillment?.need==="protective_fire_then_withdraw"&&
      role.phase?.id!==role.fulfillment?.stageId&&
      role.phase?.id!=="contact_broken"&&
      role.permissions?.fire
    );
  }

  start(now,context){
    super.start(now,context);
    const actor=context?.game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    actor.currentAction="Establishing protective fire";
    actor.aiV2ProtectiveFire={
      status:"active",
      targetPoint:{...this.directive.targetPoint},
      maximumRounds:this.directive.maximumRounds??4,
      shotsFired:actor.aiV2ProtectiveFire?.shotsFired??0,
      startedAt:now,
      lastBlockReason:null
    };
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.cooldown=Math.max(0,this.cooldown-Math.max(0,delta));
    const maximumRounds=Math.max(1,this.directive.maximumRounds??4);
    const totalShots=actor.aiV2ProtectiveFire?.shotsFired??0;
    const attention=services?.attention?.turnToward?.(actor,this.directive.targetPoint,delta,{pose:"brace",turnRate:6.5})??{settled:true};
    let result=null;
    if(totalShots<maximumRounds&&attention.settled&&this.cooldown<=0){
      result=services?.fire?.fireProtectiveShot?.({
        game,
        actor,
        targetPoint:this.directive.targetPoint,
        shotIndex:totalShots,
        spread:this.directive.spread??.052
      })??{fired:false,reason:"fire_executor_missing"};
      if(result.fired){
        this.localShots+=1;
        this.cooldown=Math.max(.12,this.directive.fireInterval??.26);
      }else{
        this.cooldown=Math.max(.2,this.directive.retryAfter??.42);
      }
    }
    const shotsFired=totalShots+(result?.fired?1:0);
    this.progress=Math.min(1,shotsFired/maximumRounds);
    actor.currentAction=shotsFired>=maximumRounds
      ?"Holding after bounded protective burst"
      :result?.reason==="friendly_in_line"
        ?"Holding fire — friendly in line"
        :"Providing protective fire";
    actor.aiV2ProtectiveFire={
      status:shotsFired>=maximumRounds?"burst_complete_holding":"active",
      targetPoint:{...this.directive.targetPoint},
      maximumRounds,
      shotsFired,
      ammoRemaining:actor.ammoInMagazine??null,
      startedAt:this.startedAt,
      lastShotAt:result?.fired?now:(actor.aiV2ProtectiveFire?.lastShotAt??null),
      lastBlockReason:result&&!result.fired?result.reason:null,
      procedureId:this.directive.procedureId,
      roleId:this.directive.roleId
    };
    return null;
  }

  onInterrupted({game,services}={}){this.#release(game,services,"interrupted");}
  onCancelled({game,services}={}){this.#release(game,services,"cancelled");}

  #release(game,services,status){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return;
    services?.fire?.release?.(actor);
    actor.aiV2ProtectiveFire={...(actor.aiV2ProtectiveFire??{}),status};
  }
}
