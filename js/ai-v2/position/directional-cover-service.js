const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function pointSegmentDistance(point,start,end){
  const dx=end.x-start.x,dy=end.y-start.y;
  const lengthSquared=dx*dx+dy*dy;
  if(lengthSquared<=.0001)return distance(point,start);
  const t=clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared,0,1);
  return Math.hypot(point.x-(start.x+dx*t),point.y-(start.y+dy*t));
}

function activeFixtureZone(game){
  return game?.map?.sandboxLayout?.zones?.find(zone=>zone.id===game.sandboxFixtureId)??null;
}

function insideZone(point,zone,padding=28){
  if(!zone)return true;
  return point.x>=zone.x+padding&&point.x<=zone.x+zone.width-padding&&point.y>=zone.y+padding&&point.y<=zone.y+zone.height-padding;
}

function teamCenter(actors=[]){
  if(!actors.length)return{x:0,y:0};
  return{
    x:actors.reduce((sum,actor)=>sum+actor.x,0)/actors.length,
    y:actors.reduce((sum,actor)=>sum+actor.y,0)/actors.length
  };
}

function obstacleId(obstacle,index){
  return obstacle.id??`${obstacle.type??"cover"}:${Math.round(obstacle.x)}:${Math.round(obstacle.y)}:${index}`;
}

function protectionFor({obstacle,point,threatPoint}){
  const radius=Math.max(12,Number(obstacle?.radius)||36);
  const lineDistance=pointSegmentDistance(obstacle,threatPoint,point);
  const threatDistance=distance(threatPoint,obstacle);
  const slotDistance=distance(point,obstacle);
  const between=threatDistance+slotDistance<=distance(threatPoint,point)+radius*.55;
  const intersection=clamp(1-lineDistance/Math.max(1,radius*.88));
  return clamp(intersection*(between?1:.35));
}

export class DirectionalCoverService{
  buildSlots({game,threatPoint,teamActors=[],policy={}}={}){
    if(!threatPoint)return[];
    const zone=activeFixtureZone(game);
    const center=teamCenter(teamActors);
    const actorRadius=Math.max(12,policy.actorRadius??18);
    const maximumCoverDistance=Math.max(80,policy.maximumCoverDistance??520);
    const minimumProtection=clamp(policy.minimumProtection??.72);
    const slots=[];

    for(const [index,obstacle] of (game?.map?.obstacles??[]).entries()){
      const radius=Math.max(18,Number(obstacle.radius)||36);
      if(distance(center,obstacle)>maximumCoverDistance)continue;
      const awayX=obstacle.x-threatPoint.x,awayY=obstacle.y-threatPoint.y;
      const magnitude=Math.hypot(awayX,awayY);
      if(magnitude<=.001)continue;
      const offset=radius+actorRadius+Math.max(7,policy.coverGap??9);
      const point={x:obstacle.x+awayX/magnitude*offset,y:obstacle.y+awayY/magnitude*offset};
      if(!insideZone(point,zone,policy.zonePadding??28))continue;
      const protection=protectionFor({obstacle,point,threatPoint});
      if(protection<minimumProtection)continue;
      const cohesionDistance=distance(point,center);
      const threatDistance=distance(point,threatPoint);
      const travelUtility=clamp(1-cohesionDistance/Math.max(1,maximumCoverDistance));
      const firingUtility=clamp(.32+protection*.34+Math.min(1,threatDistance/900)*.12);
      const observationUtility=clamp(.38+protection*.26);
      const sourceId=obstacleId(obstacle,index);
      slots.push({
        id:`directional_cover:${sourceId}:rear`,
        sourceObjectId:sourceId,
        sourceType:obstacle.type??"cover",
        point,
        obstacle:{x:obstacle.x,y:obstacle.y,radius},
        threatPoint:{x:threatPoint.x,y:threatPoint.y},
        protectedDirection:Math.atan2(threatPoint.y-point.y,threatPoint.x-point.x),
        capacity:1,
        utility:{
          protection,
          exposure:clamp(1-protection),
          firing:firingUtility,
          observation:observationUtility,
          cohesion:travelUtility
        }
      });
    }

    return slots.sort((a,b)=>{
      const aScore=a.utility.protection*.48+a.utility.firing*.18+a.utility.observation*.14+a.utility.cohesion*.20;
      const bScore=b.utility.protection*.48+b.utility.firing*.18+b.utility.observation*.14+b.utility.cohesion*.20;
      return bScore-aScore||a.point.x-b.point.x||a.point.y-b.point.y;
    });
  }

  scoreForRole(slot,{roleId,actor,teamActors=[],policy={}}={}){
    const center=teamCenter(teamActors);
    const travel=actor?distance(actor,slot.point):0;
    const maximumTravel=Math.max(1,policy.maximumTravel??520);
    const travelScore=clamp(1-travel/maximumTravel);
    const cohesionScore=clamp(1-distance(slot.point,center)/Math.max(1,policy.maximumCohesionDistance??560));
    const reserve=roleId==="mobile_reserve";
    const anchor=roleId==="security_anchor";
    return(
      slot.utility.protection*(reserve ? .48 : .40)+
      slot.utility.firing*(anchor ? .24 : reserve ? .08 : .18)+
      slot.utility.observation*(anchor ? .16 : reserve ? .08 : .14)+
      cohesionScore*(reserve ? .20 : .10)+
      travelScore*.10
    );
  }

  findBestSlot({game,actor,roleId,threatPoint,teamActors=[],policy={},claims=null,now=0}={}){
    const candidates=this.buildSlots({game,threatPoint,teamActors,policy})
      .filter(slot=>!claims?.isClaimed?.(slot.id,{excludingActorId:actor?.id,now}))
      .map(slot=>({...slot,score:this.scoreForRole(slot,{roleId,actor,teamActors,policy})}))
      .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    return{best:candidates[0]??null,candidates};
  }

  isSlotValid({game,slot,threatPoint,policy={}}={}){
    if(!slot||!threatPoint)return{valid:false,reason:"missing_slot_or_threat"};
    const obstacle=(game?.map?.obstacles??[]).find((candidate,index)=>obstacleId(candidate,index)===slot.sourceObjectId);
    if(!obstacle)return{valid:false,reason:"cover_source_missing"};
    const protection=protectionFor({obstacle,point:slot.point,threatPoint});
    const minimumProtection=clamp(policy.minimumProtection??.72);
    return{
      valid:protection>=minimumProtection,
      reason:protection>=minimumProtection?"directional_protection_remains_valid":"threat_direction_defeats_cover",
      protection
    };
  }
}
