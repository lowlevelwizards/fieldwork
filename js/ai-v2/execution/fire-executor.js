const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function segmentCircleHit(origin,end,circle){
  const dx=end.x-origin.x,dy=end.y-origin.y;
  const fx=origin.x-circle.x,fy=origin.y-circle.y;
  const a=dx*dx+dy*dy;
  if(a<=.0001)return null;
  const b=2*(fx*dx+fy*dy);
  const c=fx*fx+fy*fy-circle.radius*circle.radius;
  const discriminant=b*b-4*a*c;
  if(discriminant<0)return null;
  const root=Math.sqrt(discriminant);
  const values=[(-b-root)/(2*a),(-b+root)/(2*a)]
    .filter(value=>value>=0&&value<=1)
    .sort((left,right)=>left-right);
  const t=values[0];
  return Number.isFinite(t)?{t,x:origin.x+dx*t,y:origin.y+dy*t}:null;
}

function stableUnit(text){
  let hash=2166136261;
  for(const character of String(text)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return((hash>>>0)%10000)/10000;
}

function facingFromAngle(angle){
  const x=Math.cos(angle),y=Math.sin(angle);
  return Math.abs(x)>Math.abs(y)?(x>=0?"right":"left"):(y>=0?"down":"up");
}

export class FireExecutor{
  constructor({magazineSize=20,maximumRange=980}={}){
    this.magazineSize=magazineSize;
    this.maximumRange=maximumRange;
  }

  ensureWeapon(actor){
    actor.magazineSize??=this.magazineSize;
    actor.ammoInMagazine??=actor.magazineSize;
    actor.aiV2WeaponState??={shotsFired:0,lastBlockReason:null};
    return actor.aiV2WeaponState;
  }

  fireProtectiveShot({game,actor,targetPoint,shotIndex=0,spread=.055,eventKind="near_miss",eventConfidence=94,emitThreatEvent=false}={}){
    if(!game||!actor||!targetPoint)return{fired:false,reason:"missing_fire_context"};
    if(actor.medical?.dead||actor.medical?.unconscious)return{fired:false,reason:"actor_unavailable"};
    const weapon=this.ensureWeapon(actor);
    if(actor.ammoInMagazine<=0){
      weapon.lastBlockReason="empty_magazine";
      return{fired:false,reason:"empty_magazine",ammoRemaining:0};
    }

    const desiredAngle=Math.atan2(targetPoint.y-actor.y,targetPoint.x-actor.x);
    const deterministicDeviation=(stableUnit(`${actor.id}:${shotIndex}`)*2-1)*spread;
    const shotAngle=desiredAngle+deterministicDeviation;
    const origin={x:actor.x+Math.cos(desiredAngle)*42,y:actor.y+Math.sin(desiredAngle)*42};
    const targetDistance=Math.min(this.maximumRange,Math.max(90,distance(actor,targetPoint)));
    const intended={
      x:origin.x+Math.cos(shotAngle)*targetDistance,
      y:origin.y+Math.sin(shotAngle)*targetDistance
    };

    let friendlyBlock=null;
    for(const friendly of game.actors??[]){
      if(friendly.id===actor.id||friendly.teamId!==actor.teamId||friendly.medical?.dead)continue;
      const hit=segmentCircleHit(origin,intended,{x:friendly.x,y:friendly.y,radius:(friendly.radius??18)+8});
      if(hit&&(!friendlyBlock||hit.t<friendlyBlock.hit.t))friendlyBlock={friendly,hit};
    }
    if(friendlyBlock){
      weapon.lastBlockReason="friendly_in_line";
      return{
        fired:false,
        reason:"friendly_in_line",
        blockedByActorId:friendlyBlock.friendly.id,
        ammoRemaining:actor.ammoInMagazine
      };
    }

    let nearest={t:1,point:{...intended},obstacle:null};
    for(const obstacle of game.map?.obstacles??[]){
      const hit=segmentCircleHit(origin,intended,{x:obstacle.x,y:obstacle.y,radius:(obstacle.radius??25)*.8});
      if(hit&&hit.t<nearest.t)nearest={t:hit.t,point:{x:hit.x,y:hit.y},obstacle};
    }

    actor.ammoInMagazine-=1;
    weapon.shotsFired=(weapon.shotsFired??0)+1;
    weapon.lastBlockReason=null;
    weapon.lastShotPoint={...nearest.point};
    actor.combatAimAngle=desiredAngle;
    actor.lookAngle=desiredAngle;
    actor.facing=facingFromAngle(desiredAngle);

    game.combat?.effects?.push?.({type:"muzzle",x:origin.x,y:origin.y,angle:shotAngle,life:.085,maxLife:.085,source:"ai_v2"});
    game.combat?.effects?.push?.({type:"tracer",x1:origin.x,y1:origin.y,x2:nearest.point.x,y2:nearest.point.y,life:.13,maxLife:.13,source:"ai_v2"});
    game.combat?.decals?.push?.({type:"impact",x:nearest.point.x,y:nearest.point.y,angle:shotAngle,life:22,maxLife:22});

    let nearestThreat=null;
    for(const candidate of game.actors??[]){
      if(candidate.teamId===actor.teamId||candidate.medical?.dead)continue;
      const miss=this.#pointSegmentDistance(candidate,origin,nearest.point);
      if(miss<=115)candidate.aiV2Suppression=clamp((candidate.aiV2Suppression??0)+18*(1-miss/115),0,100);
      if(miss>128)continue;
      if(!nearestThreat||miss<nearestThreat.miss)nearestThreat={candidate,miss};
    }

    let threatEventId=null;
    if(nearestThreat&&emitThreatEvent){
      threatEventId=`ai_v2_shot_${actor.id}_${weapon.shotsFired}`;
      game.aiV2ThreatEvents??=[];
      game.aiV2ThreatEvents.push({
        id:threatEventId,
        subjectId:`threat_source_${actor.id}`,
        kind:eventKind,
        targetActorId:nearestThreat.candidate.id,
        sourceActorId:actor.id,
        sourceTeamId:actor.teamId,
        sourcePoint:{...origin},
        impactPoint:{...nearest.point},
        nearMissDistance:nearestThreat.miss,
        confidence:eventConfidence,
        immediateDuration:3.2,
        emittedAt:game.aiV2?.elapsed??0
      });
    }

    return{
      fired:true,
      reason:nearest.obstacle?"protective_round_impacted_cover":"protective_round_fired",
      origin,
      end:{...nearest.point},
      obstacle:Boolean(nearest.obstacle),
      threatEventId,
      nearMissActorId:nearestThreat?.candidate.id??null,
      nearMissDistance:nearestThreat?.miss??null,
      ammoRemaining:actor.ammoInMagazine
    };
  }

  release(actor){
    if(!actor)return;
    actor.aiV2WeaponState={...(actor.aiV2WeaponState??{}),lastBlockReason:null};
  }

  #pointSegmentDistance(point,start,end){
    const dx=end.x-start.x,dy=end.y-start.y;
    const lengthSquared=dx*dx+dy*dy;
    if(lengthSquared<=.0001)return distance(point,start);
    const t=clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared,0,1);
    return Math.hypot(point.x-(start.x+dx*t),point.y-(start.y+dy*t));
  }
}
