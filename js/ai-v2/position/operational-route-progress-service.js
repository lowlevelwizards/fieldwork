const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const point=value=>value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))?{x:Number(value.x),y:Number(value.y),id:value.id??null,label:value.label??null,kind:value.kind??null}:null;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function routeWaypoints(operation,mode){
  const source=mode==="return"?operation?.routePlan?.returnWaypoints:operation?.routePlan?.waypoints;
  return(source??[]).map(point).filter(Boolean);
}

function geometry(waypoints){
  const cumulative=[0];
  const segments=[];
  let total=0;
  for(let index=0;index<waypoints.length-1;index+=1){
    const from=waypoints[index],to=waypoints[index+1];
    const length=Math.max(.001,distance(from,to));
    segments.push({index,from,to,length,start:total,end:total+length});
    total+=length;cumulative.push(total);
  }
  return{waypoints,segments,cumulative,total};
}

function projectToSegment(actor,segment){
  const vx=segment.to.x-segment.from.x,vy=segment.to.y-segment.from.y;
  const l2=vx*vx+vy*vy||1;
  const rawT=((actor.x-segment.from.x)*vx+(actor.y-segment.from.y)*vy)/l2;
  const t=clamp(rawT);
  const projected={x:segment.from.x+vx*t,y:segment.from.y+vy*t};
  return{
    segmentIndex:segment.index,t,rawT,projected,
    crossTrack:distance(actor,projected),along:segment.start+segment.length*t
  };
}

function nearestProjection(actor,route){
  if(!route.segments.length){
    const only=route.waypoints[0]??{x:actor.x,y:actor.y};
    return{segmentIndex:0,t:1,rawT:1,projected:{x:only.x,y:only.y},crossTrack:distance(actor,only),along:0};
  }
  return route.segments.map(segment=>projectToSegment(actor,segment)).sort((left,right)=>left.crossTrack-right.crossTrack||right.along-left.along)[0];
}

function pointAtDistance(route,along){
  if(!route.waypoints.length)return null;
  if(!route.segments.length)return{x:route.waypoints[0].x,y:route.waypoints[0].y};
  const target=clamp(along,0,route.total);
  const segment=route.segments.find(item=>target<=item.end+.001)??route.segments[route.segments.length-1];
  const t=clamp((target-segment.start)/Math.max(.001,segment.length));
  return{x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t};
}

function segmentAtDistance(route,along){
  if(!route.segments.length)return null;
  const target=clamp(along,0,route.total);
  return route.segments.find(item=>target<=item.end+.001)??route.segments[route.segments.length-1];
}

function cloneIntent(record){
  if(!record)return null;
  return{
    ...record,
    projectedPoint:record.projectedPoint?{...record.projectedPoint}:null,
    lookaheadPoint:record.lookaheadPoint?{...record.lookaheadPoint}:null,
    terminalPoint:record.terminalPoint?{...record.terminalPoint}:null,
    currentSegment:record.currentSegment?{...record.currentSegment,from:{...record.currentSegment.from},to:{...record.currentSegment.to}}:null,
    corridorSegment:record.corridorSegment?{...record.corridorSegment,from:{...record.corridorSegment.from},to:{...record.corridorSegment.to}}:null,
    consumedWaypointIds:[...(record.consumedWaypointIds??[])]
  };
}

export class OperationalRouteProgressService{
  constructor({decisionLog=null,lookaheadDistance=190,preferredCorridor=125,maximumDeviation=340,terminalRadius=140}={}){
    this.decisionLog=decisionLog;
    this.lookaheadDistance=Math.max(80,Number(lookaheadDistance)||190);
    this.preferredCorridor=Math.max(60,Number(preferredCorridor)||125);
    this.maximumDeviation=Math.max(this.preferredCorridor+40,Number(maximumDeviation)||340);
    this.terminalRadius=Math.max(70,Number(terminalRadius)||140);
    this.byActor=new Map();
  }

  evaluate({game,actor,operationId,mode=null,now=0,syncLegacy=true}={}){
    const living=game?.livingSandbox;
    const operation=living?.getOperation?.(operationId)??null;
    const status=living?.operationRouteStatus?.(operationId,actor?.id)??null;
    if(!actor||!operation||!status)return null;
    const routeMode=mode??status.mode;
    const waypoints=routeWaypoints(operation,routeMode);
    const route=geometry(waypoints);
    const key=`${operationId}:${routeMode}`;
    const previous=this.byActor.get(actor.id);
    const projection=nearestProjection(actor,route);
    const withinUsefulDeviation=projection.crossTrack<=this.maximumDeviation;
    const previousAlong=previous?.key===key?Number(previous.strategicDistance)||0:0;
    let strategicDistance=withinUsefulDeviation?Math.max(previousAlong,projection.along):previousAlong;
    strategicDistance=clamp(strategicDistance,0,route.total||0);
    const rawProgress=route.total>0?clamp(projection.along/route.total):1;
    let strategicProgress=route.total>0?clamp(strategicDistance/route.total):1;
    const terminalPoint=waypoints[waypoints.length-1]??null;
    const terminalDistance=terminalPoint?distance(actor,terminalPoint):0;
    const finalSegment=route.segments[route.segments.length-1]??null;
    const terminalReady=Boolean(
      !terminalPoint||
      terminalDistance<=this.terminalRadius||
      finalSegment&&projection.segmentIndex===finalSegment.index&&projection.rawT>=.96&&projection.crossTrack<=this.preferredCorridor*1.2
    );
    // Terminal readiness is the causal ownership handoff from strategic travel
    // to local field work. Reaching the broad terminal region proves the route
    // effect has been fulfilled even if the actor did not trace the final
    // mathematical segment closely enough to satisfy the old marker geometry.
    if(terminalReady){strategicDistance=route.total;strategicProgress=1;}

    let currentStatus=status;
    const consumedWaypointIds=[];
    if(syncLegacy&&currentStatus&&!currentStatus.complete&&currentStatus.mode===routeMode){
      let guard=0;
      while(!currentStatus.complete&&guard++<waypoints.length+2){
        const markerIndex=currentStatus.index;
        const markerDistance=route.cumulative[markerIndex]??route.total;
        const finalMarker=markerIndex>=waypoints.length-1;
        const passed=strategicDistance>=Math.max(0,markerDistance-30);
        if(!passed||finalMarker&&!terminalReady)break;
        const marker=waypoints[markerIndex]??null;
        const marked=living.markActorRouteWaypoint?.({operationId,actorId:actor.id,mode:routeMode,index:markerIndex,now})??false;
        if(!marked)break;
        if(marker?.id)consumedWaypointIds.push(marker.id);
        currentStatus=living.operationRouteStatus?.(operationId,actor.id)??currentStatus;
      }
    }

    if(currentStatus?.complete){strategicDistance=route.total;strategicProgress=1;}
    const lookaheadAlong=Math.min(route.total,strategicDistance+this.lookaheadDistance);
    const lookaheadPoint=pointAtDistance(route,lookaheadAlong)??terminalPoint??{x:actor.x,y:actor.y};
    const currentSegment=segmentAtDistance(route,strategicDistance);
    const corridorFrom=pointAtDistance(route,Math.max(0,strategicDistance-48))??lookaheadPoint;
    const corridorTo=pointAtDistance(route,Math.min(route.total,lookaheadAlong+72))??lookaheadPoint;
    const record={
      actorId:actor.id,operationId,mode:routeMode,key,
      strategicDistance,strategicProgress,rawProgress,
      routeLength:route.total,segmentIndex:currentSegment?.index??0,segmentProgress:currentSegment?clamp((strategicDistance-currentSegment.start)/Math.max(.001,currentSegment.length)):1,
      projectedPoint:{...projection.projected},lateralDeviation:projection.crossTrack,withinPreferredCorridor:projection.crossTrack<=this.preferredCorridor,withinUsefulDeviation,
      lookaheadDistance:Math.max(0,lookaheadAlong-strategicDistance),lookaheadProgress:route.total>0?clamp(lookaheadAlong/route.total):1,lookaheadPoint:{...lookaheadPoint},
      terminalPoint:terminalPoint?{x:terminalPoint.x,y:terminalPoint.y}:null,terminalDistance,terminalReady,
      currentSegment:currentSegment?{index:currentSegment.index,from:{x:currentSegment.from.x,y:currentSegment.from.y},to:{x:currentSegment.to.x,y:currentSegment.to.y}}:null,
      corridorSegment:{from:{...corridorFrom},to:{...corridorTo},width:this.preferredCorridor},
      preferredCorridor:this.preferredCorridor,maximumDeviation:this.maximumDeviation,
      legacyIndex:currentStatus?.index??status.index,legacyTotal:currentStatus?.total??status.total,complete:Boolean(currentStatus?.complete),
      consumedWaypointIds,updatedAt:now
    };
    this.byActor.set(actor.id,record);
    actor.aiV2RouteIntent=cloneIntent(record);
    if(consumedWaypointIds.length)this.#record("operation_route_markers_consumed",actor.id,now,{operationId,mode:routeMode,consumedWaypointIds:[...consumedWaypointIds],strategicProgress});
    return cloneIntent(record);
  }

  get(actorId){return cloneIntent(this.byActor.get(actorId)??null);}
  prune(liveActorIds){const live=new Set(liveActorIds);for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);}
  summary(){return[...this.byActor.values()].map(cloneIntent);}

  #record(type,actorId,time,data){this.decisionLog?.record?.({type,time,actorId,data});}
}
