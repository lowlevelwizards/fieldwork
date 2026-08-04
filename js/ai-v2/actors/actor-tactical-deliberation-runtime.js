import { TacticalRepositionAction } from "../actions/tactical-reposition-action.js";
import { HoldReadyAction } from "../actions/hold-ready-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export class ActorTacticalDeliberationRuntime{
  constructor({arbiter,decisionLog=null}={}){this.arbiter=arbiter;this.decisionLog=decisionLog;this.byActor=new Map();this.commitments=new Map();}
  update({game,tacticalPictures,teamProcedures,teamAgenda,now=0}={}){
    const live=new Set();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious)continue;
      const picture=tacticalPictures?.get?.(actor.id);if(!picture)continue;
      live.add(actor.id);
      const commitment=this.commitments.get(actor.id)??null;
      const emergency=["pinned","breaking"].includes(picture.suppressionState)||Boolean(picture.incomingFire?.length&&picture.exposed);
      if(commitment&&now<commitment.minimumUntil&&!emergency){this.byActor.set(actor.id,{...commitment,status:"committed"});continue;}
      if(actor.aiV2ThreatReaction?.status==="moving_to_cover"||actor.aiV2SelfAid?.status==="treating")continue;
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const common={operationId:actor.operationId??null,missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null};
      let proposal=null;
      if(picture.bestCover?.point&&picture.threatPoint&&picture.exposed&&(emergency||picture.suppressionState==="pressured")){
        const improvement=(picture.bestCover.utility?.protection??0)-(picture.currentCover?.protection??0);
        if(emergency||improvement>=.16){
          const action=new TacticalRepositionAction({actorId:actor.id,directive:{kind:"seek_cover",label:"Moving to better cover",destination:{...picture.bestCover.point},threatPoint:{...picture.threatPoint},speedMultiplier:emergency?.94:.76,minimumCommitment:1.6,reason:`${picture.suppressionState} pressure and current exposure justify a terrain-aware move to stronger directional cover.`,provenance:{owner:"actor_tactical_deliberation",source:"continuous_tactical_picture"}}});
          proposal={action,score:.78+Math.max(0,improvement)*.18,urgency:emergency?.92:.58,tier:emergency?ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT,label:emergency?"Immediate survival":"Local tactical improvement",kind:"seek_cover",minimumUntil:now+1.8,...common};
        }
      }
      if(!proposal&&picture.nearestFriendly?.distance<46&&!role?.roleId?.includes("specialist")){
        const teammate=game.actors.find(candidate=>candidate.id===picture.nearestFriendly.actorId);
        if(teammate){let dx=actor.x-teammate.x,dy=actor.y-teammate.y;const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;const destination={x:actor.x+dx*72,y:actor.y+dy*72};const action=new TacticalRepositionAction({actorId:actor.id,directive:{kind:"clear_spacing",label:"Widening team spacing",destination,threatPoint:picture.threatPoint,speedMultiplier:.55,minimumCommitment:.9,reason:"The operator is crowding a teammate and can improve local mobility and fire-lane separation without abandoning responsibility.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_tactical_picture"}}});proposal={action,score:.46,urgency:.18,tier:ACTION_AUTHORITY_TIERS.LOCAL_IMPROVEMENT,label:"Local tactical improvement",kind:"clear_spacing",minimumUntil:now+1.1,...common};}
      }
      if(!proposal&&picture.threatPoint&&picture.visibleThreats.length&&picture.currentCover?.protected){
        const action=new HoldReadyAction({actorId:actor.id,directive:{label:"Watching from cover",focus:{...picture.threatPoint},reason:"The actor has useful protection and personally visible threat information; preserve the position and maintain observation rather than following a decorative formation adjustment.",provenance:{owner:"actor_tactical_deliberation",source:"continuous_tactical_picture"}}});proposal={action,score:.55,urgency:.32,tier:ACTION_AUTHORITY_TIERS.SUPPORTING_CONCERN,label:"Supporting tactical concern",kind:"hold_useful_cover",minimumUntil:now+1.4,...common};
      }
      if(!proposal)continue;
      this.arbiter?.submit?.({actorId:actor.id,action:proposal.action,score:proposal.score,urgency:proposal.urgency,authorityTier:proposal.tier,authorityLabel:proposal.label,reason:proposal.action.purpose,source:"actor_tactical_deliberation",operationId:proposal.operationId,missionId:proposal.missionId,governingIntentId:proposal.governingIntentId,procedureId:proposal.procedureId,roleId:proposal.roleId,onGranted:()=>{const record={actorId:actor.id,kind:proposal.kind,selectedAt:now,minimumUntil:proposal.minimumUntil,destination:proposal.action.directive?.destination?{...proposal.action.directive.destination}:null,reason:proposal.action.purpose};this.commitments.set(actor.id,record);this.byActor.set(actor.id,record);}});
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
    for(const actorId of [...this.commitments.keys()])if(!live.has(actorId))this.commitments.delete(actorId);
  }
  summary(){return[...this.byActor.values()].map(item=>({...item,destination:item.destination?{...item.destination}:null}));}
}
