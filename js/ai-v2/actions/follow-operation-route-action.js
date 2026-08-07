import { AIV2Action } from "./action.js";
import { ACTION_CHANNELS } from "./action-channels.js";

const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function cloneRouteIntent(intent){
  return intent?{
    ...intent,
    projectedPoint:intent.projectedPoint?{...intent.projectedPoint}:null,
    lookaheadPoint:intent.lookaheadPoint?{...intent.lookaheadPoint}:null,
    terminalPoint:intent.terminalPoint?{...intent.terminalPoint}:null,
    currentSegment:intent.currentSegment?{...intent.currentSegment,from:{...intent.currentSegment.from},to:{...intent.currentSegment.to}}:null,
    corridorSegment:intent.corridorSegment?{...intent.corridorSegment,from:{...intent.corridorSegment.from},to:{...intent.corridorSegment.to}}:null,
    consumedWaypointIds:[...(intent.consumedWaypointIds??[])]
  }:null;
}

function cloneDirective(directive={}){
  return{
    ...directive,
    destination:directive.destination?{...directive.destination}:null,
    legacyWaypoint:directive.legacyWaypoint?{...directive.legacyWaypoint}:null,
    routeIntent:cloneRouteIntent(directive.routeIntent),
    progressWindow:directive.progressWindow?{...directive.progressWindow}:null
  };
}

export class FollowOperationRouteAction extends AIV2Action{
  constructor({actorId,directive}={}){
    const normalized=cloneDirective(directive);
    super({
      type:"FollowOperationRoute",actorId,
      purpose:normalized.reason??"Make useful progress through the assigned operation corridor",
      channels:[ACTION_CHANNELS.LOCOMOTION],primary:true,displayPriority:72,priority:430,
      metadata:{directive:cloneDirective(normalized),provenance:normalized.provenance??null,utilityScore:Number(normalized.utilityScore??3)}
    });
    this.directive=normalized;
    this.initialDistance=Math.max(1,Number(normalized.initialDistance)||1);
    this.progress=Math.max(0,Number(normalized.routeIntent?.strategicProgress)||0);
  }

  amendFrom(action){
    if(!action?.directive)return false;
    this.directive=cloneDirective({...this.directive,...action.directive});
    this.purpose=this.directive.reason??this.purpose;
    this.metadata={
      ...(this.metadata??{}),
      directive:cloneDirective(this.directive),
      provenance:this.directive.provenance??this.metadata?.provenance??null,
      utilityScore:Number(this.directive.utilityScore??this.metadata?.utilityScore??3)
    };
    this.progress=Math.max(this.progress,Number(this.directive.routeIntent?.strategicProgress)||0);
    return true;
  }

  continuationUtility(){return Number(this.directive?.utilityScore??this.metadata?.utilityScore??3);}

  canStart({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const status=game?.livingSandbox?.operationRouteStatus?.(this.directive.operationId,this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&status&&!status.complete&&status.mode===this.directive.mode);
  }

  canContinue({game}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    const status=game?.livingSandbox?.operationRouteStatus?.(this.directive.operationId,this.actorId);
    return Boolean(actor&&!actor.medical?.dead&&!actor.medical?.unconscious&&status&&!status.complete&&status.mode===this.directive.mode);
  }

  start(now,{game}={}){
    super.start(now,{game});
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(actor){
      actor.currentTask=this.directive.operationLabel??actor.currentTask;
      actor.currentAction=this.directive.mode==="return"?"Returning through operation corridor":"Advancing through operation corridor";
      actor.aiV2Route={
        operationId:this.directive.operationId,mode:this.directive.mode,
        progress:this.directive.routeIntent?.strategicProgress??0,rawProgress:this.directive.routeIntent?.rawProgress??0,
        segmentIndex:this.directive.routeIntent?.segmentIndex??0,lateralDeviation:this.directive.routeIntent?.lateralDeviation??0,
        lookaheadProgress:this.directive.routeIntent?.lookaheadProgress??0,
        legacyIndex:this.directive.legacyIndex??0,legacyTotal:this.directive.legacyTotal??0
      };
    }
  }

  update(delta,{game,services,now=0}={}){
    const actor=game?.actors?.find(candidate=>candidate.id===this.actorId);
    if(!actor)return{status:"failed",reason:"actor_missing"};
    const routeIntent=this.directive.routeIntent??{};
    const destination=this.directive.destination??routeIntent.lookaheadPoint??this.directive.legacyWaypoint;
    if(!destination)return{status:"failed",reason:"operation_route_intent_missing_goal"};
    const corridor=routeIntent.corridorSegment??null;
    const result=services.locomotion.moveWithIntent(actor,{
      kind:"operation_route_progress",goal:destination,
      region:{type:"circle",center:{...destination},outerRadius:this.directive.acceptanceRadius??70},
      acceptanceRadius:this.directive.acceptanceRadius??70,
      corridor:corridor?{from:{...corridor.from},to:{...corridor.to},width:corridor.width??routeIntent.preferredCorridor??125}:null,
      minimumProgress:.78,preferredSeparationMin:54,preferredSeparationMax:210,
      threatPoint:actor.aiV2TacticalPicture?.threatPoint??null,dangerRadius:360,lookAhead:105
    },delta,{
      game,now,speedMultiplier:this.directive.mode==="return"?.76:.72,arrivalRadius:12,
      task:this.directive.mode==="return"?"Returning through operation corridor":"Advancing through operation corridor",
      pose:"walk"
    });
    this.progress=Math.max(this.progress,Number(routeIntent.strategicProgress)||0);
    actor.aiV2Route={
      operationId:this.directive.operationId,mode:this.directive.mode,
      progress:this.progress,rawProgress:routeIntent.rawProgress??this.progress,
      segmentIndex:routeIntent.segmentIndex??0,segmentProgress:routeIntent.segmentProgress??0,
      lateralDeviation:routeIntent.lateralDeviation??0,lookaheadProgress:routeIntent.lookaheadProgress??this.progress,
      lookaheadPoint:routeIntent.lookaheadPoint?{...routeIntent.lookaheadPoint}:null,
      destination:{...destination},legacyIndex:this.directive.legacyIndex??0,legacyTotal:this.directive.legacyTotal??0,
      teamMedianProgress:this.directive.teamMedianProgress??this.progress,updatedAt:now
    };
    if(result.failed)return{status:"failed",reason:result.reason??"operation_route_corridor_travel_failed"};
    if(result.arrived){
      services.locomotion.stop(actor,{pose:"walk"});
      actor.currentAction=this.directive.mode==="return"?"Re-evaluating return corridor ahead":"Re-evaluating operation corridor ahead";
    }
    return null;
  }
}
