import { FollowOperationRouteAction } from "../actions/follow-operation-route-action.js";
import { ACTION_AUTHORITY_TIERS } from "../authority/actor-action-arbiter.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function destinationForActor(actor,waypoint,teamActors,index){
  const prior=teamActors[index-1]??null;
  const dx=waypoint.x-(prior?.x??actor.x),dy=waypoint.y-(prior?.y??actor.y);
  const length=Math.hypot(dx,dy)||1;
  const px=-dy/length,py=dx/length;
  const lane=(index-(teamActors.length-1)/2)*42;
  return{x:waypoint.x+px*lane,y:waypoint.y+py*lane};
}

export class OperationalTravelRuntime{
  constructor({scheduler,arbiter,decisionLog=null}={}){
    this.scheduler=scheduler;this.arbiter=arbiter;this.decisionLog=decisionLog;this.byActor=new Map();
  }

  update({game,teamAgenda,teamProcedures,now=0}={}){
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
        waypoint:{...status.waypoint},destination,initialDistance:distance(actor,destination),reason,
        provenance:{owner:"operational_travel_runtime",source:"campaign_route_stage",teamId:actor.teamId,operationId:actor.operationId,
          missionId:agenda?.missionId??null,governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null,
          routeMode:status.mode,waypointId:status.waypoint.id,waypointIndex:status.index}
      };
      const action=new FollowOperationRouteAction({actorId:actor.id,directive});
      this.arbiter?.submit?.({
        actorId:actor.id,action,score:3,urgency:status.mode==="return"?.58:.44,
        authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,authorityLabel:"Operation route stage",
        reason,source:"operational_travel_runtime",operationId:actor.operationId,missionId:agenda?.missionId??null,
        governingIntentId:agenda?.intentId??null,procedureId:role?.procedureId??null,roleId:role?.roleId??null
      });
      this.byActor.set(actor.id,{actorId:actor.id,operationId:actor.operationId,roleId:role?.roleId??null,procedureId:role?.procedureId??null,mode:status.mode,index:status.index,total:status.total,waypointId:status.waypoint.id,waypointLabel:status.waypoint.label,destination:{...destination},reason,lastEvaluatedAt:now});
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  get(actorId){const item=this.byActor.get(actorId);return item?{...item,destination:{...item.destination}}:null;}
  summary(){return[...this.byActor.values()].map(item=>({...item,destination:{...item.destination}}));}
}
