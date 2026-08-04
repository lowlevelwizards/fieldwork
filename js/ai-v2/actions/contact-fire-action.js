import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const capableTarget=actor=>Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&actor.medical?.condition!=="critical");

export class ContactFireAction extends AIV2Action{
 constructor({actorId,directive}={}){
  super({type:"ContactFire",actorId,purpose:directive?.reason??"Conduct a bounded hostile-contact engagement",channels:[ACTION_CHANNELS.WEAPON,ACTION_CHANNELS.ATTENTION,ACTION_CHANNELS.STANCE],primary:true,displayPriority:126,priority:126,interruptible:true,metadata:{directive:{...directive},provenance:directive?.provenance??null}});
  this.directive={...directive,targetPoint:directive?.targetPoint?{...directive.targetPoint}:null};this.cooldown=0;this.shots=0;this.recoil=0;
 }
 canStart({game}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);return Boolean(actor&&this.directive.targetPoint&&!actor.medical?.dead&&!actor.medical?.unconscious);}
 canContinue({game,services}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);const personal=services?.personalKnowledge?.getContacts?.(this.actorId)??[];const targetKnown=personal.some(contact=>contact.subjectTeamId===this.directive.subjectTeamId&&contact.confidence>=18);return Boolean(actor&&actor.operationPausedByEncounter&&targetKnown&&!actor.medical?.dead&&!actor.medical?.unconscious&&this.shots<(this.directive.maximumRounds??6));}
 start(now,{game}={}){super.start(now,{game});const actor=game?.actors?.find(a=>a.id===this.actorId);if(actor){actor.currentAction="Engaging hostile contact";actor.workPose="brace";actor.aiV2ContactFire={status:"active",shotsFired:0,targetActorId:this.directive.targetActorId??null,targetPoint:{...this.directive.targetPoint},startedAt:now};}}
 update(delta,{game,services,now=0}={}){
  const actor=game?.actors?.find(a=>a.id===this.actorId);if(!actor)return{status:"failed",reason:"actor_missing"};
  this.cooldown=Math.max(0,this.cooldown-delta);this.recoil=Math.max(0,this.recoil-delta*.035);
  const knowledgeAvailable=Boolean(services?.personalKnowledge?.getContacts);
  const personal=services?.personalKnowledge?.getContacts?.(actor.id)??[];
  const visible=personal.filter(contact=>contact.subjectTeamId===this.directive.subjectTeamId&&contact.currentlyVisible&&contact.confidence>=24);
  const remembered=personal.filter(contact=>contact.subjectTeamId===this.directive.subjectTeamId&&!contact.currentlyVisible&&now-(contact.lastObservedAt??0)<=3.2&&contact.confidence>=22);
  const visibleTargets=visible.map(contact=>game.actors.find(candidate=>candidate.id===contact.subjectId)).filter(capableTarget);
  let target=visibleTargets.find(candidate=>candidate.id===this.directive.targetActorId)??visibleTargets.sort((a,b)=>distance(a,actor)-distance(b,actor))[0]??null;
  if(!knowledgeAvailable){
    const fallbackTargets=(game.actors??[]).filter(candidate=>candidate.teamId===this.directive.subjectTeamId&&capableTarget(candidate));
    target=fallbackTargets.find(candidate=>candidate.id===this.directive.targetActorId)??fallbackTargets.sort((a,b)=>distance(a,actor)-distance(b,actor))[0]??null;
  }
  const suppressiveContact=!target?remembered[0]??null:null;
  if(!target&&!suppressiveContact)return{status:"completed",reason:"contact_not_personally_visible_or_recent"};
  if(target){this.directive.targetActorId=target.id;this.directive.targetPoint={x:target.x,y:target.y};}
  else{this.directive.targetActorId=null;this.directive.targetPoint={...suppressiveContact.approximatePosition};}
  const attention=services?.attention?.turnToward?.(actor,this.directive.targetPoint,delta,{pose:"brace",turnRate:7})??{settled:true};
  if(attention.settled&&this.cooldown<=0){
   const moving=Math.min(1,Math.hypot(actor.vx??0,actor.vy??0)/180);
   const suppression=Math.min(1,Number(actor.aiV2Suppression??0)/100);
   const injury=actor.medical?.condition==="serious"?.35:actor.medical?.condition==="wounded"?.18:0;
   const spread=.026+moving*.045+suppression*.055+injury*.035+this.recoil;
   const result=services?.fire?.fireProtectiveShot?.({game,actor,targetPoint:this.directive.targetPoint,shotIndex:this.shots,spread,eventKind:target?"hostile_contact_fire":"hostile_contact_suppression",eventConfidence:target?100:64,emitThreatEvent:true,allowInjury:Boolean(target),injuryScale:target?.72:0})??{fired:false,reason:"fire_executor_missing"};
   if(result.fired){this.shots+=1;this.recoil=Math.min(.075,this.recoil+.012);this.cooldown=.30+this.recoil*2.2;}else this.cooldown=.45;
   actor.currentAction=result.fired?(target?`Firing at visible threat — ${target.name??target.id}`:"Suppressing last known position"):"Holding fire — line blocked";
  }
  actor.aiV2ContactFire={status:this.shots>=(this.directive.maximumRounds??6)?"burst_complete":"active",shotsFired:this.shots,targetActorId:target?.id??null,targetPoint:{...this.directive.targetPoint},fireMode:target?"aimed":"suppression",updatedAt:now};
  this.progress=Math.min(1,this.shots/(this.directive.maximumRounds??6));
  if(this.shots>=(this.directive.maximumRounds??6))return{status:"completed",reason:"bounded_burst_complete"};
  return null;
 }
 onInterrupted({game,services}={}){const actor=game?.actors?.find(a=>a.id===this.actorId);if(actor){services?.fire?.release?.(actor);actor.workPose=null;}}
 onCancelled(context={}){this.onInterrupted(context);}
}
