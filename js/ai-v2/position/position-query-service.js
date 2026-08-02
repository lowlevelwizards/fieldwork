import { isActorPositionClear } from "../../actor-motion.js?v=20k-boundaries-challenge-warning-20260802";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function pointSegmentDistance(point,start,end){
  const dx=end.x-start.x,dy=end.y-start.y;
  const lengthSquared=dx*dx+dy*dy;
  if(lengthSquared<=.0001)return Math.hypot(point.x-start.x,point.y-start.y);
  const t=clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared,0,1);
  return Math.hypot(point.x-(start.x+dx*t),point.y-(start.y+dy*t));
}

function hardBlocker(game,start,end){
  for(const obstacle of game?.map?.obstacles??[]){
    const radius=obstacle.radius??0;
    const endpointDistance=Math.min(distance(obstacle,start),distance(obstacle,end));
    if(endpointDistance<radius*.55)continue;
    if(pointSegmentDistance(obstacle,start,end)<radius*.78)return obstacle;
  }
  return null;
}

function concealmentAlongLine(game,start,end){
  let concealment=0;
  for(const brush of game?.map?.brush??[]){
    const radius=brush.radius??80;
    const distanceToLine=pointSegmentDistance(brush,start,end);
    if(distanceToLine<radius*.62)concealment+=.14*(1-distanceToLine/Math.max(1,radius*.62));
  }
  return clamp(concealment,0,.48);
}

function sectorSamples(sector){
  const center={x:sector.x,y:sector.y};
  const spread=Math.min(120,Math.max(55,(sector.sampleSpread??80)));
  const angle=Number.isFinite(sector.sampleAxisAngle)?sector.sampleAxisAngle:0;
  const px=Math.cos(angle+Math.PI/2),py=Math.sin(angle+Math.PI/2);
  return[
    center,
    {x:center.x+px*spread,y:center.y+py*spread},
    {x:center.x-px*spread,y:center.y-py*spread}
  ];
}

function activeFixtureZone(game){
  return game?.map?.sandboxLayout?.zones?.find(zone=>zone.id===game.sandboxFixtureId)??null;
}

function insideZone(point,zone,padding=50){
  if(!zone)return true;
  return point.x>=zone.x+padding&&point.x<=zone.x+zone.width-padding&&point.y>=zone.y+padding&&point.y<=zone.y+zone.height-padding;
}

function candidateOffsets(maximumTravel=190){
  const radii=[70,110,150,maximumTravel].filter((value,index,array)=>value<=maximumTravel&&array.indexOf(value)===index);
  const offsets=[];
  for(const radius of radii){
    for(let index=0;index<16;index++){
      const angle=index*Math.PI/8;
      offsets.push({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,radius,angle,index});
    }
  }
  return offsets;
}

export class PositionQueryService{
  evaluateResponsibilityPosition({game,actor,point=null,sector,teamActors=[],policy={}}={}){
    const position=point?{x:point.x,y:point.y}:{x:actor.x,y:actor.y};
    const zone=activeFixtureZone(game);
    const samples=sector?sectorSamples(sector):[];
    const sampleResults=samples.map(sample=>{
      const blocker=hardBlocker(game,position,sample);
      const concealment=blocker?0:concealmentAlongLine(game,position,sample);
      return{
        sample,
        hardBlocked:Boolean(blocker),
        blockerId:blocker?`${blocker.type}:${blocker.x},${blocker.y}`:null,
        concealment,
        visibility:blocker?0:clamp(1-concealment*.7,0,1)
      };
    });
    const visibleSamples=sampleResults.filter(result=>!result.hardBlocked);
    const coverage=samples.length?visibleSamples.length/samples.length:1;
    const visibility=sampleResults.length?sampleResults.reduce((sum,result)=>sum+result.visibility,0)/sampleResults.length:1;
    const clear=isActorPositionClear(game,position.x,position.y,actor?.radius??18);
    const inZone=insideZone(position,zone,policy.zonePadding??55);
    const teamCenter=teamActors.length?{
      x:teamActors.reduce((sum,item)=>sum+item.x,0)/teamActors.length,
      y:teamActors.reduce((sum,item)=>sum+item.y,0)/teamActors.length
    }:{x:position.x,y:position.y};
    const cohesionDistance=distance(position,teamCenter);
    const otherActors=teamActors.filter(item=>item.id!==actor?.id);
    const nearestFriendly=otherActors.length?Math.min(...otherActors.map(item=>distance(position,item))):Infinity;
    const minimumVisibility=policy.minimumVisibility??.55;
    const minimumCoverage=policy.minimumCoverage??.66;
    const maximumCohesionDistance=policy.maximumCohesionDistance??420;
    const minimumFriendlySpacing=policy.minimumFriendlySpacing??68;
    const reasons=[];
    if(!clear)reasons.push("position_overlaps_hard_obstacle");
    if(!inZone)reasons.push("outside_permitted_fixture_zone");
    if(coverage<minimumCoverage)reasons.push("assigned_sector_blocked");
    else if(visibility<minimumVisibility)reasons.push("assigned_sector_visibility_too_low");
    if(cohesionDistance>maximumCohesionDistance)reasons.push("outside_team_cohesion_limit");
    if(nearestFriendly<minimumFriendlySpacing)reasons.push("crowds_friendly_operator");
    const suitable=reasons.length===0;
    const blockerId=sampleResults.find(result=>result.blockerId)?.blockerId??null;
    return{
      suitable,
      position,
      visibility,
      coverage,
      clear,
      insidePermittedZone:inZone,
      cohesionDistance,
      nearestFriendly,
      blockerId,
      reasons,
      primaryReason:reasons[0]??"position_satisfies_responsibility",
      sampleResults
    };
  }

  findBestResponsibilityPosition({game,actor,sector,teamActors=[],policy={},claims=null,now=0}={}){
    const origin={x:actor.x,y:actor.y};
    const maximumTravel=policy.maximumTravel??190;
    const candidates=[];
    for(const offset of candidateOffsets(maximumTravel)){
      const point={x:origin.x+offset.x,y:origin.y+offset.y};
      if(claims?.isClaimedNear?.(point,{excludingActorId:actor.id,radius:policy.claimSpacing??72,now}))continue;
      const evaluation=this.evaluateResponsibilityPosition({game,actor,point,sector,teamActors,policy});
      if(!evaluation.suitable)continue;
      const travel=distance(origin,point);
      const travelScore=clamp(1-travel/Math.max(1,maximumTravel),0,1);
      const cohesionScore=clamp(1-evaluation.cohesionDistance/Math.max(1,policy.maximumCohesionDistance??420),0,1);
      const spacingScore=evaluation.nearestFriendly===Infinity?1:clamp((evaluation.nearestFriendly-(policy.minimumFriendlySpacing??68))/160,0,1);
      const score=
        evaluation.coverage*.36+
        evaluation.visibility*.30+
        travelScore*.16+
        cohesionScore*.10+
        spacingScore*.08;
      candidates.push({point,evaluation,travel,score,offsetIndex:offset.index,offsetRadius:offset.radius});
    }
    candidates.sort((a,b)=>b.score-a.score||a.travel-b.travel||a.point.x-b.point.x||a.point.y-b.point.y);
    return{best:candidates[0]??null,candidates};
  }
}

export function describePositionFailure(evaluation){
  const reason=evaluation?.primaryReason;
  if(reason==="assigned_sector_blocked")return evaluation.blockerId?`Hard cover (${evaluation.blockerId}) blocks the assigned sector.`:"Hard cover blocks most of the assigned sector.";
  if(reason==="assigned_sector_visibility_too_low")return "Concealment prevents a useful view of the assigned sector.";
  if(reason==="outside_team_cohesion_limit")return "The position lies outside the role's permitted team-cohesion limit.";
  if(reason==="crowds_friendly_operator")return "The position crowds another operator and cannot support a distinct responsibility.";
  if(reason==="position_overlaps_hard_obstacle")return "The position is physically obstructed.";
  if(reason==="outside_permitted_fixture_zone")return "The position is outside the procedure's permitted area.";
  return "The current position cannot adequately fulfill the assigned responsibility.";
}
