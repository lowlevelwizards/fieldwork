import { isActorPositionClear } from "../../actor-motion.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((b?.x??0)-(a?.x??0),(b?.y??0)-(a?.y??0));

function cloneWaypoint(waypoint){
  return waypoint?{
    ...waypoint,
    x:Number(waypoint.x),
    y:Number(waypoint.y),
    staminaCost:clamp(waypoint.staminaCost??.35,0,1)
  }:null;
}

function cloneRoute(route){
  return route?{
    ...route,
    waypoints:(route.waypoints??[]).map(cloneWaypoint),
    evaluation:route.evaluation?{...route.evaluation,reasons:[...(route.evaluation.reasons??[])]}:null
  }:null;
}

function pointSegmentDistance(point,start,end){
  const dx=end.x-start.x;
  const dy=end.y-start.y;
  const lengthSquared=dx*dx+dy*dy;
  if(lengthSquared<=.0001)return distance(point,start);
  const t=clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared,0,1);
  return distance(point,{x:start.x+dx*t,y:start.y+dy*t});
}

function segmentObstaclePenalty(game,start,end,clearance=34){
  let penalty=0;
  for(const obstacle of game?.map?.obstacles??[]){
    const separation=pointSegmentDistance(obstacle,start,end);
    const desired=(obstacle.radius??0)+clearance;
    if(separation>=desired)continue;
    penalty+=clamp(1-separation/Math.max(1,desired),0,1);
  }
  return penalty;
}

function evaluateRoute({game,route,origin}={}){
  const waypoints=(route?.waypoints??[]).map(cloneWaypoint);
  const reasons=[];
  if(!waypoints.length)reasons.push("route_has_no_waypoints");

  let totalDistance=0;
  let obstaclePenalty=0;
  let previous=origin;
  let clearWaypoints=0;
  for(const waypoint of waypoints){
    const clear=isActorPositionClear(game,waypoint.x,waypoint.y,22);
    if(clear)clearWaypoints+=1;
    else reasons.push(`waypoint_blocked:${waypoint.id??clearWaypoints}`);
    totalDistance+=distance(previous,waypoint);
    obstaclePenalty+=segmentObstaclePenalty(game,previous,waypoint,42);
    previous=waypoint;
  }

  const waypointClarity=waypoints.length?clearWaypoints/waypoints.length:0;
  const distanceScore=clamp(1-totalDistance/1500,0,1);
  const protection=clamp(route?.protection??.5);
  const cohesion=clamp(route?.cohesion??.7);
  const obstacleScore=clamp(1-obstaclePenalty/Math.max(1,waypoints.length*1.5),0,1);
  const available=reasons.length===0&&route?.available!==false;
  if(route?.available===false)reasons.push("route_marked_unavailable");
  const score=available
    ?waypointClarity*.25+distanceScore*.24+protection*.27+cohesion*.14+obstacleScore*.10
    :0;

  return{
    available,
    score,
    totalDistance,
    waypointClarity,
    protection,
    cohesion,
    obstaclePenalty,
    reasons
  };
}

export class EvacuationRouteService{
  constructor({decisionLog=null}={}={}){
    this.decisionLog=decisionLog;
    this.selectedByTeam=new Map();
  }

  evaluateOptions({game,mission,origin}={}){
    return (mission?.evacuationPlan?.routeOptions??[])
      .map(route=>{
        const evaluation=evaluateRoute({game,route,origin});
        return{
          id:route.id,
          label:route.label,
          waypoints:(route.waypoints??[]).map(cloneWaypoint),
          protection:clamp(route.protection??.5),
          cohesion:clamp(route.cohesion??.7),
          evaluation
        };
      })
      .sort((a,b)=>b.evaluation.score-a.evaluation.score||a.evaluation.totalDistance-b.evaluation.totalDistance||String(a.id).localeCompare(String(b.id)));
  }

  select({game,mission,teamId,origin,now=0}={}){
    if(!teamId)return null;
    const existing=this.selectedByTeam.get(teamId);
    if(existing)return cloneRoute(existing);
    const candidates=this.evaluateOptions({game,mission,origin});
    const selected=candidates.find(candidate=>candidate.evaluation.available)??null;
    if(!selected)return null;
    const record={
      ...selected,
      selectedAt:now,
      candidateCount:candidates.length,
      reason:`${selected.label} best satisfies route clarity, protection, cohesion, and travel cost among ${candidates.length} available affordance(s).`
    };
    this.selectedByTeam.set(teamId,record);
    this.decisionLog?.record?.({
      type:"evacuation_route_selected",
      time:now,
      teamId,
      data:{
        routeId:record.id,
        routeLabel:record.label,
        candidateCount:record.candidateCount,
        score:record.evaluation.score,
        totalDistance:record.evaluation.totalDistance,
        reason:record.reason,
        candidates:candidates.map(candidate=>({
          id:candidate.id,
          label:candidate.label,
          available:candidate.evaluation.available,
          score:candidate.evaluation.score,
          totalDistance:candidate.evaluation.totalDistance,
          reasons:[...candidate.evaluation.reasons]
        }))
      }
    });
    return cloneRoute(record);
  }

  getSelected(teamId){return cloneRoute(this.selectedByTeam.get(teamId)??null);}
  clear(teamId){this.selectedByTeam.delete(teamId);}
  summary(){return[...this.selectedByTeam.entries()].map(([teamId,route])=>({teamId,route:cloneRoute(route)}));}
}
