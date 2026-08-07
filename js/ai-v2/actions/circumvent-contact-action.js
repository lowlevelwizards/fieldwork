import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
export class CircumventContactAction extends AIV2Action{
  constructor({actorId,directive}={}){super({type:"CircumventContact",actorId,purpose:directive?.reason??"Create safe separation from another team",channels:[ACTION_CHANNELS.LOCOMOTION,ACTION_CHANNELS.ATTENTION],primary:true,displayPriority:88,priority:760,metadata:{directive:{...directive},provenance:directive?.provenance??null}});this.directive={...directive,destination:{...directive.destination},focus:directive.focus?{...directive.focus}:null};this.initialDistance=Math.max(1,Number(directive.initialDistance)||1);this.holdElapsed=0;}
  canStart({game}={}){const a=game?.actors?.find(x=>x.id===this.actorId);return Boolean(a&&!a.medical?.dead&&!a.medical?.unconscious&&this.directive.destination&&this.#decisionStillOwns(a));}
  canContinue({game}={}){const a=game?.actors?.find(x=>x.id===this.actorId);return Boolean(a&&!a.medical?.dead&&!a.medical?.unconscious&&this.directive.destination&&this.#decisionStillOwns(a));}
  amendFrom(action){if(!action?.directive?.destination)return false;this.directive={...this.directive,...action.directive,destination:{...action.directive.destination},focus:action.directive.focus?{...action.directive.focus}:this.directive.focus};return true;}
  start(now,{game}={}){super.start(now);const a=game?.actors?.find(x=>x.id===this.actorId);if(a){a.currentTask=this.directive.mode==="contest"?"Contesting local access":"Avoiding opposing team";a.currentAction="Creating team separation";a.operationPausedByEncounter=true;}}
  update(delta,{game,services}={}){const a=game?.actors?.find(x=>x.id===this.actorId);if(!a)return{status:"failed",reason:"actor_missing"};if(this.directive.focus)services.attention.turnToward(a,this.directive.focus,delta,{pose:this.directive.mode==="contest"?"ready":"walk",turnRate:4});const result=services.locomotion.moveWithIntent(a,{kind:this.directive.mode==="contest"?"contest_access_region":"deconflict_contact_region",goal:this.directive.destination,region:{type:"circle",center:{...this.directive.destination},innerRadius:0,outerRadius:this.directive.mode==="contest"?54:72,preferredRadius:this.directive.mode==="contest"?28:42},acceptanceRadius:this.directive.mode==="contest"?54:72,preferredSeparationMin:72,preferredSeparationMax:280,focus:this.directive.focus,threatPoint:this.directive.mode==="contest"?this.directive.focus:null,dangerRadius:240,lookAhead:82,allowRetreat:this.directive.mode!=="contest"},delta,{game,now:game?.aiV2?.elapsed??0,speedMultiplier:this.directive.mode==="contest"?.54:.72,arrivalRadius:12,task:this.directive.mode==="contest"?"Taking a contest position":"Withdrawing from contact",pose:this.directive.mode==="contest"?"ready":"walk"});this.progress=Math.max(0,Math.min(1,1-(result.distance??distance(a,this.directive.destination))/this.initialDistance));if(result.arrived){services.locomotion.stop(a,{pose:"ready"});a.currentAction=this.directive.mode==="contest"?"Holding contested access":"Safe separation restored";if(this.directive.mode==="contest"){this.holdElapsed+=Math.max(0,delta);if(this.holdElapsed<Math.max(1.5,Number(this.directive.holdDuration)||3.5))return null;return{status:"completed",reason:"contest_position_held_and_reassessment_due"};}return{status:"completed",reason:"contact_separation_position_reached"};}this.holdElapsed=0;return null;}
  onInterrupted({game}={}){const a=game?.actors?.find(x=>x.id===this.actorId);if(a&&!a.aiV2ContactRouteDecision?.routeSuspended)a.operationPausedByEncounter=false;}
  #decisionStillOwns(actor){
    const provenance=this.directive.provenance??null;
    if(provenance?.source!=="contact_route_decision")return true;
    const current=actor?.aiV2ContactRouteDecision;
    if(!current||current.pairKey!==provenance.pairKey)return false;
    if(provenance.routeMode==="contest")return current.routeMode==="contest";
    if(provenance.routeMode==="withdraw")return current.routeMode==="withdraw";
    return true;
  }
}
