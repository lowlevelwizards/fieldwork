const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const ROUTE_LOOKAHEAD=920;
const ROUTE_CLEARANCE=220;
const NOMINAL_ROUTE_SPEED=88;

function activeActors(game,teamId){return (game?.actors??[]).filter(actor=>actor.teamId===teamId&&!actor.medical?.dead&&!actor.medical?.unconscious);}
function center(actors){if(!actors.length)return null;return{x:actors.reduce((s,a)=>s+a.x,0)/actors.length,y:actors.reduce((s,a)=>s+a.y,0)/actors.length};}
function radius(actors,c){return actors.reduce((m,a)=>Math.max(m,distance(a,c)+(a.radius??18)),0);}
function operationFor(game,actors){const id=actors.find(a=>a.operationId)?.operationId;return id?game?.livingSandbox?.getOperation?.(id)??null:null;}
function normalized(from,to){const x=(to?.x??0)-(from?.x??0),y=(to?.y??0)-(from?.y??0),l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}

function routeForTeam(game,actors,teamCenter){
  const operation=operationFor(game,actors);
  if(!operation||!game?.livingSandbox?.operationRouteStatus)return{operation,mode:null,points:[teamCenter],direction:{x:0,y:0},complete:true};
  const actor=actors.find(candidate=>candidate.operationId===operation.id)??actors[0];
  const status=game.livingSandbox.operationRouteStatus(operation.id,actor.id);
  if(!status||status.complete)return{operation,mode:status?.mode??null,points:[teamCenter],direction:{x:0,y:0},complete:true};
  const authored=status.mode==="return"?(operation.routePlan?.returnWaypoints??[]):(operation.routePlan?.waypoints??[]);
  const remaining=authored.slice(Math.max(0,Number(status.index)||0));
  const points=[{...teamCenter}];
  let travelled=0,previous=teamCenter;
  for(const point of remaining){
    const step=distance(previous,point);
    if(travelled+step>ROUTE_LOOKAHEAD){
      const ratio=clamp((ROUTE_LOOKAHEAD-travelled)/Math.max(1,step));
      points.push({x:previous.x+(point.x-previous.x)*ratio,y:previous.y+(point.y-previous.y)*ratio});
      break;
    }
    points.push({x:point.x,y:point.y});
    travelled+=step;previous=point;
    if(travelled>=ROUTE_LOOKAHEAD)break;
  }
  const direction=points.length>1?normalized(points[0],points[1]):{x:0,y:0};
  return{operation,mode:status.mode,points,direction,complete:false};
}

function projectPointToSegment(point,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<=.0001)return{point:{...a},t:0,distance:distance(point,a)};
  const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/l2);
  const projected={x:a.x+dx*t,y:a.y+dy*t};
  return{point:projected,t,distance:distance(point,projected)};
}
function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);}
function intersects(a,b,c,d){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  return ((abC===0&&projectPointToSegment(c,a,b).distance<.001)||(abD===0&&projectPointToSegment(d,a,b).distance<.001)||(cdA===0&&projectPointToSegment(a,c,d).distance<.001)||(cdB===0&&projectPointToSegment(b,c,d).distance<.001)||((abC>0)!==(abD>0)&&(cdA>0)!==(cdB>0)));
}
function segmentPair(a,b,c,d){
  if(intersects(a,b,c,d)){
    const mid={x:(a.x+b.x+c.x+d.x)/4,y:(a.y+b.y+c.y+d.y)/4};
    const own=projectPointToSegment(mid,a,b),other=projectPointToSegment(own.point,c,d);
    return{distance:0,ownPoint:own.point,otherPoint:other.point};
  }
  const candidates=[
    {own:projectPointToSegment(c,a,b),other:{point:c},distance:projectPointToSegment(c,a,b).distance},
    {own:projectPointToSegment(d,a,b),other:{point:d},distance:projectPointToSegment(d,a,b).distance},
    {own:{point:a},other:projectPointToSegment(a,c,d),distance:projectPointToSegment(a,c,d).distance},
    {own:{point:b},other:projectPointToSegment(b,c,d),distance:projectPointToSegment(b,c,d).distance}
  ].sort((left,right)=>left.distance-right.distance);
  return{distance:candidates[0].distance,ownPoint:{...candidates[0].own.point},otherPoint:{...candidates[0].other.point}};
}

function polylineSegments(points){
  const result=[];let along=0;
  for(let index=0;index<points.length-1;index+=1){
    const from=points[index],to=points[index+1],length=distance(from,to);
    if(length>.01)result.push({from,to,length,along,index});
    along+=length;
  }
  return result;
}
function routeConflictAssessment(ownRoute,otherRoute,separation){
  const ownSegments=polylineSegments(ownRoute.points),otherSegments=polylineSegments(otherRoute.points);
  if(!ownSegments.length||!otherSegments.length){
    return{routeConflict:separation<380,severity:separation<380?clamp(1-separation/520,.45,1):0,conflictPoint:null,routeDistance:null,otherRouteDistance:null,etaGap:null,parallelMovement:false,headOn:false,crossingMovement:false};
  }
  let best=null;
  for(const own of ownSegments){
    for(const other of otherSegments){
      const pair=segmentPair(own.from,own.to,other.from,other.to);
      const ownAlong=own.along+distance(own.from,pair.ownPoint),otherAlong=other.along+distance(other.from,pair.otherPoint);
      const etaGap=Math.abs(ownAlong-otherAlong)/NOMINAL_ROUTE_SPEED;
      const score=pair.distance+Math.min(260,etaGap*22)+Math.min(180,(ownAlong+otherAlong)*.08);
      if(!best||score<best.score)best={...pair,ownAlong,otherAlong,etaGap,score};
    }
  }
  const dot=ownRoute.direction.x*otherRoute.direction.x+ownRoute.direction.y*otherRoute.direction.y;
  const parallelMovement=dot>.68&&best.distance<420;
  const headOn=dot<-.55&&best.distance<ROUTE_CLEARANCE*1.25;
  const crossingMovement=Math.abs(dot)<.68&&best.distance<ROUTE_CLEARANCE*1.25;
  const timely=best.etaGap<=7.5||separation<380;
  const routeConflict=best.distance<=ROUTE_CLEARANCE&&best.ownAlong<=ROUTE_LOOKAHEAD&&best.otherAlong<=ROUTE_LOOKAHEAD&&timely;
  const proximityTerm=1-clamp(best.distance/ROUTE_CLEARANCE),timingTerm=1-clamp(best.etaGap/7.5),distanceTerm=1-clamp(Math.min(best.ownAlong,best.otherAlong)/ROUTE_LOOKAHEAD);
  const severity=routeConflict?clamp(proximityTerm*.5+timingTerm*.28+distanceTerm*.22+(separation<380?.18:0)):0;
  return{
    routeConflict,severity,
    conflictPoint:{x:(best.ownPoint.x+best.otherPoint.x)/2,y:(best.ownPoint.y+best.otherPoint.y)/2},
    routeDistance:best.ownAlong,otherRouteDistance:best.otherAlong,etaGap:best.etaGap,
    parallelMovement,headOn,crossingMovement
  };
}

function teamMotion(actors){
  const moving=actors.filter(a=>Math.hypot(a.vx??0,a.vy??0)>.02);
  if(!moving.length)return{x:0,y:0};
  const x=moving.reduce((s,a)=>s+(a.vx??0),0),y=moving.reduce((s,a)=>s+(a.vy??0),0),l=Math.hypot(x,y)||1;
  return{x:x/l,y:y/l};
}

export class ContactResolutionService{
  constructor({decisionLog=null}={}){this.decisionLog=decisionLog;this.byPair=new Map();}
  assess({game,observerTeamId,subjectTeamId,relationship="unknown",now=0}={}){
    if(!observerTeamId||!subjectTeamId||observerTeamId===subjectTeamId)return null;
    const ownActors=activeActors(game,observerTeamId),otherActors=activeActors(game,subjectTeamId);
    const ownCenter=center(ownActors),otherCenter=center(otherActors);if(!ownCenter||!otherCenter)return null;
    const ownRadius=radius(ownActors,ownCenter),otherRadius=radius(otherActors,otherCenter);
    const separation=Math.max(0,distance(ownCenter,otherCenter)-ownRadius-otherRadius);
    const ownRoute=routeForTeam(game,ownActors,ownCenter),otherRoute=routeForTeam(game,otherActors,otherCenter);
    const ownOperation=ownRoute.operation,otherOperation=otherRoute.operation;
    const objectiveConflict=Boolean(ownOperation?.objectiveId&&ownOperation.objectiveId===otherOperation?.objectiveId);
    const operationConflict=Boolean(ownOperation?.id&&otherOperation?.id&&(ownOperation.contestedByOperationId===otherOperation.id||otherOperation.contestedByOperationId===ownOperation.id));
    const route=routeConflictAssessment(ownRoute,otherRoute,separation);
    const hostile=relationship==="hostile"||operationConflict;
    const protectedFriendly=["own_team","same_faction","cooperating","deconflicting"].includes(relationship);
    const key=[observerTeamId,subjectTeamId].sort().join("::");
    const prior=this.byPair.get(key);
    const releaseDistance=hostile?1050:objectiveConflict?900:620;
    const localConflict=separation<380;
    const materiallyRelevant=!protectedFriendly&&(
      localConflict||route.routeConflict||
      (objectiveConflict&&separation<1100)||
      (hostile&&(route.routeConflict||separation<900||operationConflict))||
      (Boolean(prior?.materiallyRelevant)&&separation<releaseDistance&&(route.routeConflict||localConflict||objectiveConflict||hostile))
    );
    const kind=hostile&&(route.routeConflict||localConflict||objectiveConflict)?"engage":objectiveConflict?"contest":materiallyRelevant?"avoid":"observe";
    const ownMotion=teamMotion(ownActors),otherMotion=teamMotion(otherActors);
    const record={
      key,observerTeamId,subjectTeamId,relationship:hostile?"hostile":relationship,separation,
      ownCenter,otherCenter,ownRadius,otherRadius,
      routeConflict:route.routeConflict,routeConflictSeverity:route.severity,conflictPoint:route.conflictPoint,
      routeDistanceToConflict:route.routeDistance,otherRouteDistanceToConflict:route.otherRouteDistance,routeEtaGap:route.etaGap,
      parallelMovement:route.parallelMovement,headOnMovement:route.headOn,crossingMovement:route.crossingMovement,
      ownRouteDirection:{...ownRoute.direction},otherRouteDirection:{...otherRoute.direction},ownRouteMode:ownRoute.mode,otherRouteMode:otherRoute.mode,
      ownMotion,otherMotion,objectiveConflict,operationConflict,mutualAwareness:true,materiallyRelevant,kind,
      minimumSeparation:Math.max(170,ownRadius+otherRadius+90),contactRegionRadius:Math.max(150,otherRadius+110),assessedAt:now
    };
    this.byPair.set(key,record);
    if(materiallyRelevant&&(!prior||prior.kind!==kind||prior.routeConflict!==route.routeConflict))this.decisionLog?.record?.({type:"team_contact_resolution_required",time:now,teamId:observerTeamId,data:{subjectTeamId,relationship,kind,separation:Math.round(separation),routeConflict:route.routeConflict,routeConflictSeverity:Number(route.severity.toFixed(2)),objectiveConflict}});
    return{...record,ownCenter:{...ownCenter},otherCenter:{...otherCenter},conflictPoint:record.conflictPoint?{...record.conflictPoint}:null,ownRouteDirection:{...record.ownRouteDirection},otherRouteDirection:{...record.otherRouteDirection}};
  }
  get(teamAId,teamBId){const item=this.byPair.get([teamAId,teamBId].sort().join("::"));return item?{...item,ownCenter:{...item.ownCenter},otherCenter:{...item.otherCenter},conflictPoint:item.conflictPoint?{...item.conflictPoint}:null,ownRouteDirection:{...item.ownRouteDirection},otherRouteDirection:{...item.otherRouteDirection}}:null;}
  summary(){return[...this.byPair.values()].map(item=>({...item,ownCenter:{...item.ownCenter},otherCenter:{...item.otherCenter},conflictPoint:item.conflictPoint?{...item.conflictPoint}:null,ownRouteDirection:{...item.ownRouteDirection},otherRouteDirection:{...item.otherRouteDirection}}));}
}
