const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function obstacleKey(obstacle,index){return obstacle?.id??`${obstacle?.type??"obstacle"}:${Math.round(obstacle?.x??0)}:${Math.round(obstacle?.y??0)}:${index}`;}

export function pointSegmentProjection(point,start,end){
  const vx=end.x-start.x,vy=end.y-start.y,l2=vx*vx+vy*vy||1;
  const raw=((point.x-start.x)*vx+(point.y-start.y)*vy)/l2;
  const t=clamp(raw);
  const projected={x:start.x+vx*t,y:start.y+vy*t};
  return{t,raw,projected,distance:distance(point,projected)};
}

export function pathClearance(game,start,end,{actorRadius=18,clearance=6}={}){
  let minimumClearance=Infinity,nearestObstacle=null,nearestObstacleId=null,blocked=false,blockingObstacle=null,blockingObstacleId=null;
  for(const [index,obstacle] of (game?.map?.obstacles??[]).entries()){
    const radius=Math.max(0,Number(obstacle?.radius)||0);
    const required=Math.max(0,actorRadius)+radius+Math.max(0,clearance);
    const projection=pointSegmentProjection(obstacle,start,end);
    const edgeClearance=projection.distance-required;
    if(edgeClearance<minimumClearance){minimumClearance=edgeClearance;nearestObstacle=obstacle;nearestObstacleId=obstacleKey(obstacle,index);}
    if(edgeClearance>=0)continue;
    const startDistance=distance(start,obstacle),endDistance=distance(end,obstacle);
    // If the actor begins slightly penetrated, permit movement that clearly exits
    // the inflated obstacle instead of declaring every recovery candidate blocked.
    const escaping=projection.t<=.06&&startDistance<required&&endDistance>startDistance+3;
    if(escaping)continue;
    blocked=true;blockingObstacle=obstacle;blockingObstacleId=obstacleKey(obstacle,index);break;
  }
  return{
    clear:!blocked,
    minimumClearance:Number.isFinite(minimumClearance)?minimumClearance:999,
    nearestObstacle,
    nearestObstacleId,
    blockingObstacle,
    blockingObstacleId
  };
}

export function corridorMetrics(point,corridor){
  if(!corridor?.from||!corridor?.to)return{alignment:1,crossTrack:0,progress:0};
  const projection=pointSegmentProjection(point,corridor.from,corridor.to);
  const width=Math.max(1,Number(corridor.width)||120);
  return{
    alignment:clamp(1-projection.distance/(width*1.35)),
    crossTrack:projection.distance,
    progress:projection.raw
  };
}

export function directionalProtection(game,point,threatPoint){
  if(!threatPoint)return 0;
  let best=0;
  const threatDistanceToPoint=distance(threatPoint,point);
  for(const obstacle of game?.map?.obstacles??[]){
    const radius=Math.max(12,Number(obstacle?.radius)||36);
    const projection=pointSegmentProjection(obstacle,threatPoint,point);
    const threatDistance=distance(threatPoint,obstacle);
    const pointDistance=distance(point,obstacle);
    const between=threatDistance+pointDistance<=threatDistanceToPoint+radius*.72;
    if(!between)continue;
    const intersection=clamp(1-projection.distance/Math.max(1,radius*.92));
    const nearCover=clamp(1-Math.max(0,pointDistance-radius)/110);
    best=Math.max(best,intersection*(.72+nearCover*.28));
  }
  return clamp(best);
}

export function predictedFriendlyCongestion(actor,candidate,game,{predictionSeconds=.45,preferredMin=58}={}){
  const team=(game?.actors??[]).filter(other=>other.id!==actor.id&&other.teamId===actor.teamId&&!other.medical?.dead);
  if(!team.length)return{penalty:0,nearest:Infinity,targetConflict:0};
  let penalty=0,nearest=Infinity,targetConflict=0;
  const start={x:actor.x,y:actor.y};
  for(const other of team){
    const predicted={x:other.x+(Number(other.vx)||0)*predictionSeconds,y:other.y+(Number(other.vy)||0)*predictionSeconds};
    const endpointDistance=distance(candidate,predicted);
    const segmentDistance=pointSegmentProjection(predicted,start,candidate).distance;
    nearest=Math.min(nearest,endpointDistance);
    if(endpointDistance<preferredMin)penalty+=clamp((preferredMin-endpointDistance)/preferredMin)*.72;
    if(segmentDistance<preferredMin*.68)penalty+=clamp((preferredMin*.68-segmentDistance)/(preferredMin*.68))*.46;
    const otherTarget=other.aiV2Steering?.target;
    if(otherTarget){
      const targetDistance=distance(candidate,otherTarget);
      if(targetDistance<preferredMin*.9){const conflict=clamp((preferredMin*.9-targetDistance)/(preferredMin*.9));penalty+=conflict*.42;targetConflict=Math.max(targetConflict,conflict);}
    }
  }
  return{penalty:clamp(penalty,0,1.6),nearest,targetConflict};
}
