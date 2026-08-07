import { FollowOperationRouteAction } from "../actions/follow-operation-route-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function destinationForActor(actor,waypoint,teamActors,index){
  // Formation is deliberately soft. Everyone advances through the same broad
  // route region; continuous steering supplies separation and cohesion.
  const seed=[...String(actor.id)].reduce((sum,ch)=>sum+ch.charCodeAt(0),0);
  const angle=(seed%17-8)*.018;
  const dx=waypoint.x-actor.x,dy=waypoint.y-actor.y,l=Math.hypot(dx,dy)||1;
  const px=-dy/l,py=dx/l;
  const sideBias=(index-(teamActors.length-1)/2)*12;
  return{x:waypoint.x+px*sideBias+Math.cos(angle)*4,y:waypoint.y+py*sideBias+Math.sin(angle)*4};
}

export class OperationalTravelRuntime{
  constructor({scheduler,brain=null,arbiter=null,decisionLog=null}={}){
    this.scheduler=scheduler;this.brain=brain??arbiter;this.decisionLog=decisionLog;this.byActor=new Map();
  }

  update({game,teamAgenda,teamProcedures,now=0,context={}}={}){
    if(game?.scenarioMode!=="live"||!game?.livingSandbox?.geography?.enabled){this.byActor.clear();return;}
    const live=new Set();
    const byTeam=new Map();
    for(const actor of game.actors??[]){
      if(!actor.teamId)continue;
      if(!byTeam.has(actor.teamId))byTeam.set(actor.teamId,[]);
      byTeam.get(actor.teamId).push(actor);
    }
    for(const teamActors of byTeam.values())teamActors.sort((a,b)=>String(a.id).localeCompare(String(b.id)));

    for(const actor of game.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious||!actor.operationId)continue;
      const status=game.livingSandbox.operationRouteStatus(actor.operationId,actor.id);
      if(!status||status.complete||!status.waypoint)continue;
      live.add(actor.id);
      const actors=(byTeam.get(actor.teamId)??[]).filter(candidate=>!candidate.medical?.dead&&!candidate.medical?.unconscious);
      const index=Math.max(0,actors.findIndex(candidate=>candidate.id===actor.id));
      const destination=destinationForActor(actor,status.waypoint,actors,index);
      const operation=game.livingSandbox.getOperation(actor.operationId);
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const reason=status.mode==="return"
        ?`${role?.roleLabel??role?.label??"Operator"} follows the operation's physical return route to ${operation?.originPositionId??"base"}.`
        :`${role?.roleLabel??role?.label??"Operator"} follows the faction-selected campaign route before field mission authority begins.`;
      const directive={
        operationId:actor.operationId,operationLabel:operation?.label??actor.currentTask,mode:status.mode,index:status.index,total:status.total,
        waypoint:{...status.waypoint},destination,acceptanceRadius:42,initialDistance:distance(actor,destination),utilityScore:3,reason,
        provenance:{owner:"operational_travel_runtime",source:"campaign_route_stage",teamId:actor.teamId,operationId:actor.operationId,
          missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null,
          routeMode:status.mode,waypointId:status.waypoint.id,waypointIndex:status.index}
      };
      const action=new FollowOperationRouteAction({actorId:actor.id,directive});
      const staffedConcern=context?.services?.concernStaffing?.findForActor?.(actor.id,{concernKind:status.mode==="return"?"safe_return":"mission_progress"})??null;
      const obligation=staffedConcern?context?.services?.actorObligations?.findForActor?.(actor.id,{sourceAssignmentId:staffedConcern.id})??null:null;
      this.brain?.submit?.({
        actorId:actor.id,action,score:3,urgency:status.mode==="return"?.58:.44,
        authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,authorityLabel:"Operation route stage",
        reason,source:"operational_travel_runtime",operationId:actor.operationId,missionId:agenda?.missionId??null,
        governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null,
        concernId:staffedConcern?.concernId??null,obligationId:obligation?.id??null,desiredEffect:staffedConcern?.desiredEffect??null
      });
      this.byActor.set(actor.id,{actorId:actor.id,operationId:actor.operationId,roleId:role?.roleId??null,procedureId:role?.procedureId??null,mode:status.mode,index:status.index,total:status.total,waypointId:status.waypoint.id,waypointLabel:status.waypoint.label,destination:{...destination},reason,lastEvaluatedAt:now});
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  get(actorId){const item=this.byActor.get(actorId);return item?{...item,destination:{...item.destination}}:null;}
  summary(){return[...this.byActor.values()].map(item=>({...item,destination:{...item.destination}}));}
}
