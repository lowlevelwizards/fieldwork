import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";
export class ReloadWeaponAction extends AIV2Action{
  constructor({actorId,directive={}}={}){super({type:"ReloadWeapon",actorId,purpose:directive.reason??"Restore weapon readiness",channels:[ACTION_CHANNELS.WEAPON,ACTION_CHANNELS.STANCE],primary:true,displayPriority:132,priority:232,interruptible:true,metadata:{directive:{...directive},provenance:directive.provenance??null}});this.directive={...directive};this.elapsed=0;}
  canStart({game}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&(actor.ammoInMagazine??0)<(actor.magazineSize??20));}
  canContinue({game}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.elapsed<(this.directive.duration??1.7));}
  start(now,{game}={}){super.start(now);const actor=game?.actors?.find(a=>a.id===this.actorId);if(actor){actor.reloading=true;actor.reloadProgress=0;actor.currentAction="Reloading from cover";actor.workPose="brace";actor.aiV2Reload={status:"active",startedAt:now,reason:this.purpose};}}
  update(delta,{game,services,now=0}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};this.elapsed+=Math.max(0,delta);const duration=Math.max(.2,this.directive.duration??1.7);this.progress=Math.min(1,this.elapsed/duration);actor.reloadProgress=this.progress;services?.locomotion?.stop?.(actor,{pose:"brace"});actor.aiV2Reload={status:this.progress>=1?"complete":"active",progress:this.progress,updatedAt:now};if(this.progress>=1){actor.ammoInMagazine=actor.magazineSize??20;actor.reloading=false;actor.reloadProgress=0;return{status:"completed",reason:"weapon_ready"};}return null;}
  onInterrupted({game}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);if(actor){actor.reloading=false;actor.aiV2Reload={...(actor.aiV2Reload??{}),status:"interrupted"};}}
  onCancelled(context={}){this.onInterrupted(context);}
}
