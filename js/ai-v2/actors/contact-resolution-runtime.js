import { CircumventContactAction } from "../actions/circumvent-contact-action.js";
import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { ContactFireAction } from "../actions/contact-fire-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
export class ContactResolutionRuntime{
 constructor({scheduler,brain=null,arbiter=null,decisionLog=null}={}){this.scheduler=scheduler;this.brain=brain??arbiter;this.decisionLog=decisionLog;this.assignments=new Map();}
 update({game,teamResponses,teamEncounters,teamProcedures=null,now=0}={}){
  if(game?.scenarioMode!=="live")return;
  const live=new Set();
  for(const response of teamResponses?.summary?.()??[]){
   if(!["avoid_contact","contest_access","engage_contact"].includes(response.selected?.id))continue;
   const encounter=teamEncounters?.getBestTeamHypothesis?.(response.teamId);
   const spatial=encounter?.contactResolution;if(!spatial?.materiallyRelevant)continue;
   const procedure=teamProcedures?.get?.(response.teamId)??null;
   const actors=(game.actors??[]).filter(a=>a.teamId===response.teamId&&!a.medical?.dead&&!a.medical?.unconscious).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
   const hostileTargets=(game.actors??[]).filter(a=>a.teamId===encounter.subjectTeamId&&!a.medical?.dead&&!a.medical?.unconscious&&a.medical?.condition!=="critical").sort((a,b)=>String(a.id).localeCompare(String(b.id)));
   const dx=spatial.ownCenter.x-spatial.otherCenter.x,dy=spatial.ownCenter.y-spatial.otherCenter.y,l=Math.hypot(dx,dy)||1,nx=dx/l,ny=dy/l,px=-ny,py=nx;
   actors.forEach((actor,index)=>{
    const role=teamProcedures?.getActorRole?.(actor.id);
    const protectedCare=procedure?.procedureId==="casualty_recovery"&&role?.roleId==="aid_provider"||procedure?.procedureId==="casualty_evacuation"&&["carrier","route_security"].includes(role?.roleId)||this.scheduler.hasAction(actor.id,"SelfAid")||this.scheduler.hasAction(actor.id,"ReactToIncomingFire");
    if(protectedCare){live.add(actor.id);return;}
    live.add(actor.id);actor.operationPausedByEncounter=true;
    const lateral=(index-(actors.length-1)/2)*58;
    const mode=response.selected.id==="contest_access"?"contest":response.selected.id==="engage_contact"?"engage":"avoid";
    if(mode==="engage"){
      // Team authority defines the desired effect and permission. It no longer
      // assigns fixed shooters or physical fire actions; each actor chooses the
      // safest useful atom from personal perception and position.
      actor.aiV2ContactIntent={
        kind:"engage_contact",subjectTeamId:encounter.subjectTeamId,
        focus:{...spatial.otherCenter},minimumSeparation:Math.max(150,spatial.minimumSeparation*.48),
        desiredEffect:"halt_hostile_advance",firePermission:"hostile_confirmed",
        responseId:response.selected.id,updatedAt:now
      };
      this.assignments.set(actor.id,{actorId:actor.id,responseId:response.selected.id,subjectId:response.subjectId,actionType:"ActorSelected",at:now});
      return;
    }
    if(mode==="avoid"&&String(response.teamId).localeCompare(String(encounter.subjectTeamId??""))<0){actor.operationPausedByEncounter=false;return;}
    const distanceOut=mode==="contest"?Math.max(180,spatial.minimumSeparation*.72):Math.max(260,spatial.minimumSeparation);
    const side=String(response.teamId).localeCompare(String(encounter.subjectTeamId??""))>=0?1:-1;
    const destination=mode==="avoid"?{x:spatial.ownCenter.x+px*side*distanceOut+nx*80+px*lateral,y:spatial.ownCenter.y+py*side*distanceOut+ny*80+py*lateral}:{x:spatial.otherCenter.x+nx*Math.max(150,spatial.minimumSeparation*.55)+px*lateral,y:spatial.otherCenter.y+ny*Math.max(150,spatial.minimumSeparation*.55)+py*lateral};
    const action=new CircumventContactAction({actorId:actor.id,directive:{mode,destination,focus:{...spatial.otherCenter},initialDistance:distance(actor,destination),reason:mode==="contest"?"The teams need the same access; occupy a defensible local position instead of passing through.":"The opposing team is materially relevant; create visible spacing and pass around rather than ghosting through.",provenance:{owner:"contact_resolution_runtime",source:"governing_response",responseId:response.selected.id,subjectTeamId:encounter.subjectTeamId}}});
    this.#submit(actor,action,response,now,mode==="contest"?.94:.88);
   });
  }
  for(const actor of game.actors??[])if(actor.operationPausedByEncounter&&!live.has(actor.id)&&!this.scheduler.hasAction(actor.id,"SelfAid")&&!this.scheduler.hasAction(actor.id,"ReactToIncomingFire")){actor.operationPausedByEncounter=false;actor.aiV2ContactIntent=null;this.assignments.delete(actor.id);}
 }
 #submit(actor,action,response,now,urgency){this.brain?.submit?.({actorId:actor.id,action,score:4,urgency,authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE,authorityLabel:"Faction contact resolution",reason:action.purpose,source:"contact_resolution_runtime",operationId:actor.operationId??null,missionId:response.missionId??null,governingIntentId:`contact:${response.subjectId}`,onGranted:()=>this.assignments.set(actor.id,{actorId:actor.id,responseId:response.selected.id,subjectId:response.subjectId,actionType:action.type,at:now})});}
 summary(){return[...this.assignments.values()].map(x=>({...x}));}
}
