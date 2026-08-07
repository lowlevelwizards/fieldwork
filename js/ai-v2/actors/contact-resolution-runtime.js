import { CircumventContactAction } from "../actions/circumvent-contact-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
import { ContactRouteDecisionState } from "../decisions/contact-route-decision-state.js";
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
function normalized(vector){const l=Math.hypot(vector?.x??0,vector?.y??0)||1;return{x:(vector?.x??0)/l,y:(vector?.y??0)/l};}

export class ContactResolutionRuntime{
 constructor({scheduler,brain=null,arbiter=null,decisionLog=null,routeDecisions=null}={}){
  this.scheduler=scheduler;this.brain=brain??arbiter;this.decisionLog=decisionLog;this.assignments=new Map();
  this.routeDecisions=routeDecisions??new ContactRouteDecisionState({decisionLog});
 }
 update({game,teamResponses,teamEncounters,teamProcedures=null,now=0}={}){
  if(game?.scenarioMode!=="live")return;
  this.routeDecisions.update({game,teamResponses,teamEncounters,now});
  const live=new Set();
  for(const actor of game.actors??[]){
   if(actor.medical?.dead||actor.medical?.unconscious)continue;
   const directive=actor.aiV2ContactRouteDecision??null;
   if(!directive)continue;
   const response=teamResponses?.get?.(actor.teamId)??null;
   const encounter=teamEncounters?.getBestTeamHypothesis?.(actor.teamId)??null;
   if(!encounter||directive.subjectTeamId!==encounter.subjectTeamId)continue;
   const procedure=teamProcedures?.get?.(actor.teamId)??null;
   const role=teamProcedures?.getActorRole?.(actor.id);
   const protectedCare=procedure?.procedureId==="casualty_recovery"&&role?.roleId==="aid_provider"||procedure?.procedureId==="casualty_evacuation"&&["carrier","route_security"].includes(role?.roleId)||this.scheduler.hasAction(actor.id,"SelfAid")||this.scheduler.hasAction(actor.id,"ReactToIncomingFire");
   live.add(actor.id);
   if(protectedCare){this.assignments.set(actor.id,{actorId:actor.id,responseId:response?.selected?.id??null,subjectId:encounter.subjectId,actionType:"ProtectedCare",routeMode:directive.routeMode,pairKey:directive.pairKey,at:now});continue;}

   if(["continue","circumvent","yield","shadow"].includes(directive.routeMode)){
    actor.aiV2ContactIntent=null;
    this.assignments.set(actor.id,{actorId:actor.id,responseId:response?.selected?.id??null,subjectId:encounter.subjectId,actionType:directive.routeMode==="continue"?"RouteContinue":"RouteOverlay",routeMode:directive.routeMode,pairKey:directive.pairKey,stalemate:Boolean(directive.stalemate),at:now});
    continue;
   }

   if(directive.routeMode==="engage"){
    actor.aiV2ContactIntent={
      kind:"engage_contact",subjectTeamId:encounter.subjectTeamId,
      focus:directive.contactCenter?{...directive.contactCenter}:{...(encounter.contactResolution?.otherCenter??encounter.approximatePosition)},
      minimumSeparation:Math.max(150,(directive.minimumSeparation??220)*.48),
      desiredEffect:"resolve_hostile_route_obstruction",firePermission:"hostile_confirmed",
      responseId:response?.selected?.id??"engage_contact",pairKey:directive.pairKey,updatedAt:now
    };
    this.assignments.set(actor.id,{actorId:actor.id,responseId:response?.selected?.id??"engage_contact",subjectId:encounter.subjectId,actionType:"ActorSelected",routeMode:"engage",pairKey:directive.pairKey,stalemate:Boolean(directive.stalemate),at:now});
    continue;
   }

   actor.aiV2ContactIntent=null;
   const routeDirection=normalized(directive.routeDirection??{x:1,y:0});
   const perpendicular={x:-routeDirection.y,y:routeDirection.x};
   const side=directive.side>=0?1:-1;
   const lateral=(String(actor.id).localeCompare(String((game.actors??[]).filter(item=>item.teamId===actor.teamId)[0]?.id??actor.id)))*28;
   let mode="contest",destination=null,reason="";
   if(directive.routeMode==="contest"){
    const conflict=directive.conflictPoint??directive.contactCenter??actor;
    const standoff=Math.max(170,Math.min(320,(directive.minimumSeparation??240)*.68));
    const away=directive.contactCenter?normalized({x:conflict.x-directive.contactCenter.x,y:conflict.y-directive.contactCenter.y}):{x:-routeDirection.y,y:routeDirection.x};
    destination={x:conflict.x+away.x*standoff+perpendicular.x*side*lateral,y:conflict.y+away.y*standoff+perpendicular.y*side*lateral};
    reason="The pair-level route decision says access itself is unresolved; occupy a bounded contest position while normal operation travel remains suspended.";
   }else if(directive.routeMode==="withdraw"){
    mode="avoid";
    const contact=directive.contactCenter??directive.conflictPoint??actor;
    const away=normalized({x:actor.x-contact.x,y:actor.y-contact.y});
    const retreat=Math.max(300,Number(directive.clearance)||340);
    destination={x:actor.x+away.x*retreat+perpendicular.x*side*70,y:actor.y+away.y*retreat+perpendicular.y*side*70};
    reason=directive.recoveryFrom?"The prior contact-route decision reached a stalemate; create real separation before choosing another route relationship.":"The governing contact-route decision requires withdrawal before mission travel can resume.";
   }
   if(!destination)continue;
   const action=new CircumventContactAction({actorId:actor.id,directive:{mode,destination,focus:directive.contactCenter??directive.conflictPoint,initialDistance:distance(actor,destination),reason,holdDuration:directive.routeMode==="contest"?3.5:0,provenance:{owner:"contact_resolution_runtime",source:"contact_route_decision",responseId:response?.selected?.id??null,subjectTeamId:encounter.subjectTeamId,pairKey:directive.pairKey,routeMode:directive.routeMode}}});
   this.#submit(actor,action,response,encounter,directive,now,directive.routeMode==="contest"?.94:.96);
  }
  for(const actor of game.actors??[]){
   if(live.has(actor.id))continue;
   actor.aiV2ContactIntent=null;
   if(!this.scheduler.hasAction(actor.id,"SelfAid")&&!this.scheduler.hasAction(actor.id,"ReactToIncomingFire"))actor.operationPausedByEncounter=false;
   this.assignments.delete(actor.id);
  }
 }
 #submit(actor,action,response,encounter,directive,now,urgency){
  this.brain?.submit?.({actorId:actor.id,action,score:4,urgency,authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,authorityLabel:"Contact route decision",reason:action.purpose,source:"contact_resolution_runtime",operationId:actor.operationId??null,missionId:response?.missionId??null,governingIntentId:`contact-route:${directive.pairKey}`,desiredEffect:directive.desiredEffect,concernId:null,obligationId:null,onGranted:()=>this.assignments.set(actor.id,{actorId:actor.id,responseId:response?.selected?.id??null,subjectId:encounter.subjectId,actionType:action.type,routeMode:directive.routeMode,pairKey:directive.pairKey,stalemate:Boolean(directive.stalemate),at:now})});
 }
 summary(){return[...this.assignments.values()].map(x=>({...x}));}
 routeSummary(){return this.routeDecisions.summary();}
}
