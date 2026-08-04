import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

export class SelectEvacuationRouteAction extends AIV2Action{
  constructor({actorId,directive}={}){
    super({
      type:"SelectEvacuationRoute",
      actorId,
      purpose:directive?.reason??"Evaluate available casualty-evacuation routes",
      channels:[ACTION_CHANNELS.ATTENTION],
      primary:true,
      displayPriority:78,
      metadata:{directive:{...directive},provenance:directive?.provenance??null}
    });
    this.directive={...directive};
    this.duration=Math.max(.25,directive?.duration??.8);
  }

  canStart({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const mission=services?.teamMissions?.get?.(actor?.teamId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&(mission?.evacuationPlan?.routeOptions?.length??0)>0);
  }

  canContinue({game,services}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const role=services?.teamProcedures?.getActorRole?.(this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&role?.procedureId===this.directive.procedureId&&role?.roleId===this.directive.roleId&&role?.phase?.id==="select_route");
  }

  start(now,context){
    super.start(now,context);
    const actor=context.game.actors.find(candidate=>candidate.id===this.actorId);
    if(actor){
      actor.currentAction="Comparing evacuation routes";
      actor.aiV2Evacuation={status:"assessing_routes",phase:"select_route",progress:0,startedAt:now};
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game.actors.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    this.progress=Math.min(1,this.progress+delta/this.duration);
    actor.currentAction="Assessing extraction affordances";
    actor.aiV2Evacuation={status:"assessing_routes",phase:"select_route",progress:this.progress,startedAt:this.startedAt};
    if(this.progress<1)return null;

    const mission=services.teamMissions.get(actor.teamId);
    const route=services.evacuationRoutes.select({game,mission,teamId:actor.teamId,origin:{x:actor.x,y:actor.y},now});
    if(!route){
      services.teamProcedures.notifyEvent({teamId:actor.teamId,event:"casualty_evacuation_failed",now,data:{actorId:actor.id,phase:"select_route",reason:"no_viable_evacuation_route"}});
      return{status:"failed",reason:"no_viable_evacuation_route"};
    }
    actor.currentAction=`Selected ${route.label}`;
    actor.aiV2Evacuation={status:"route_selected",phase:"select_route",routeId:route.id,routeLabel:route.label,progress:1,selectedAt:now};
    services.teamProcedures.notifyEvent({
      teamId:actor.teamId,
      event:"evacuation_route_selected",
      now,
      data:{routeId:route.id,routeLabel:route.label,candidateCount:route.candidateCount,waypoints:route.waypoints.map(waypoint=>({...waypoint})),reason:route.reason}
    });
    return{status:"completed",reason:"evacuation_route_selected",data:{routeId:route.id,routeLabel:route.label,candidateCount:route.candidateCount}};
  }
}
