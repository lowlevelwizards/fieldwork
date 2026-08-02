const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const normalizeAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

function pointSegmentDistance(point,start,end){
  const dx=end.x-start.x,dy=end.y-start.y;
  const lengthSquared=dx*dx+dy*dy;
  if(lengthSquared<=.0001)return Math.hypot(point.x-start.x,point.y-start.y);
  const t=clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared,0,1);
  return Math.hypot(point.x-(start.x+dx*t),point.y-(start.y+dy*t));
}

function obstacleBlocksLine(game,observer,target){
  for(const obstacle of game.map?.obstacles??[]){
    const endpointDistance=Math.min(
      Math.hypot(obstacle.x-observer.x,obstacle.y-observer.y),
      Math.hypot(obstacle.x-target.x,obstacle.y-target.y)
    );
    if(endpointDistance<(obstacle.radius??0)*.55)continue;
    if(pointSegmentDistance(obstacle,observer,target)<(obstacle.radius??0)*.78)return obstacle;
  }
  return null;
}

function concealmentAlongLine(game,observer,target){
  let concealment=0;
  for(const brush of game.map?.brush??[]){
    const distanceToLine=pointSegmentDistance(brush,observer,target);
    const radius=brush.radius??80;
    if(distanceToLine<radius*.62)concealment+=.14*(1-distanceToLine/Math.max(1,radius*.62));
  }
  return clamp(concealment,0,.48);
}

export function evaluateVisualObservation(game,observer,target,{
  maximumRange=1180,
  fieldOfViewDegrees=72
}={}){
  const dx=target.x-observer.x,dy=target.y-observer.y;
  const distance=Math.hypot(dx,dy);
  const lookAngle=Number.isFinite(observer.lookAngle)?observer.lookAngle:Math.atan2(dy,dx);
  const targetAngle=Math.atan2(dy,dx);
  const angularError=Math.abs(normalizeAngle(targetAngle-lookAngle));
  const insideRange=distance<=maximumRange;
  const insideField=distance<75||angularError<=fieldOfViewDegrees*Math.PI/360;
  const blockingObstacle=insideRange&&insideField?obstacleBlocksLine(game,observer,target):null;
  const concealment=insideRange&&insideField&&!blockingObstacle?concealmentAlongLine(game,observer,target):0;
  const rangeSignal=clamp(1-distance/maximumRange,0,1);
  const signal=(.28+.72*rangeSignal)*(1-concealment);
  const visible=insideRange&&insideField&&!blockingObstacle&&signal>.09;
  return{
    visible,
    distance,
    angularError,
    insideRange,
    insideField,
    blockingObstacleId:blockingObstacle?`${blockingObstacle.type}:${blockingObstacle.x},${blockingObstacle.y}`:null,
    concealment,
    signal,
    confidenceRate:visible?7+signal*19:0
  };
}
