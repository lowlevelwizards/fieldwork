const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const clonePoint=value=>value?{x:Number(value.x)||0,y:Number(value.y)||0}:null;

function contactPressure(actor,picture){
  if(Number.isFinite(Number(actor?.aiV2TacticalPicture?.contactPressure)))return clamp(actor.aiV2TacticalPicture.contactPressure);
  const visible=(picture?.visibleThreats??[]).length? .56:0;
  const incoming=(picture?.incomingFire??[]).length? .44:0;
  return clamp(visible+incoming);
}

function treatmentWindowLabel(score){
  if(score>=.7)return"excellent";
  if(score>=.48)return"acceptable";
  if(score>=.28)return"poor";
  return"unacceptable";
}

export class CasualtyRecoveryPositionService{
  constructor({maximumDragDistance=440,minimumProtectionGain=.14}={}){
    this.maximumDragDistance=Math.max(120,Number(maximumDragDistance)||440);
    this.minimumProtectionGain=Math.max(.05,Number(minimumProtectionGain)||.14);
  }

  assess({game,actor,casualty,mission=null,tacticalPicture=null,directionalCover=null,now=0}={}){
    if(!actor||!casualty)return null;
    const threatPoint=clonePoint(tacticalPicture?.threatPoint??actor.aiV2TacticalPicture?.threatPoint??null);
    const pressure=contactPressure(actor,tacticalPicture);
    const incomingPressure=clamp((tacticalPicture?.incomingFire??[]).length?1:0);
    const securitySupport=clamp(tacticalPicture?.securitySupport??0);
    const currentProtection=threatPoint&&directionalCover?.protectionAt
      ?clamp(directionalCover.protectionAt({game,point:casualty,threatPoint})?.protection??0)
      :threatPoint?0:1;
    const currentExposure=clamp(pressure*(1-currentProtection));

    const candidates=[];
    const authored=mission?.recoveryPlan?.recoveryPoint??null;
    if(authored){
      const protection=threatPoint&&directionalCover?.protectionAt
        ?clamp(directionalCover.protectionAt({game,point:authored,threatPoint})?.protection??0)
        :threatPoint?0:1;
      const dragDistance=distance(casualty,authored);
      candidates.push({
        id:"authored_recovery_point",kind:"authored_recovery_point",label:mission?.recoveryPlan?.label??"Mission recovery point",
        point:clonePoint(authored),protection,dragDistance,protectionGain:protection-currentProtection,
        utility:protection*.52+clamp(1-dragDistance/Math.max(1,this.maximumDragDistance))*.24+.12
      });
    }

    if(threatPoint&&directionalCover?.buildSlots){
      const teamActors=(game?.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
      const slots=directionalCover.buildSlots({
        game,threatPoint,teamActors,
        policy:{maximumCoverDistance:560,minimumProtection:.38,actorRadius:casualty.radius??18,zonePadding:24}
      });
      for(const slot of slots.slice(0,18)){
        const dragDistance=distance(casualty,slot.point);
        if(dragDistance>this.maximumDragDistance)continue;
        const protection=clamp(slot.utility?.protection??0);
        const congestion=(game?.actors??[]).filter(other=>other.id!==actor.id&&other.id!==casualty.id&&!other.medical?.dead&&distance(other,slot.point)<78).length;
        const utility=protection*.58+clamp(1-dragDistance/this.maximumDragDistance)*.26-clamp(congestion/3)*.16;
        candidates.push({
          id:slot.id,kind:"directional_cover",label:`${slot.sourceType??"cover"} ${slot.variant??"position"}`,
          point:clonePoint(slot.point),protection,dragDistance,protectionGain:protection-currentProtection,utility,
          sourceObjectId:slot.sourceObjectId??null
        });
      }
    }

    candidates.sort((a,b)=>b.utility-a.utility||b.protection-a.protection||a.dragDistance-b.dragDistance||String(a.id).localeCompare(String(b.id)));
    const best=candidates[0]??null;
    const improvement=best?best.protection-currentProtection:0;
    const betterGround=Boolean(
      threatPoint&&pressure>=.26&&best&&best.dragDistance>=24&&best.dragDistance<=this.maximumDragDistance&&
      improvement>=this.minimumProtectionGain&&currentExposure>=.16
    );

    const treatmentWindowScore=clamp(
      .18+
      currentProtection*.44+
      securitySupport*.2-
      incomingPressure*.3-
      currentExposure*.28
    );

    return{
      actorId:actor.id,casualtyId:casualty.id,updatedAt:now,
      threatPoint,contactPressure:pressure,incomingPressure,securitySupport,
      currentProtection,currentExposure,
      treatmentWindowScore,treatmentWindow:treatmentWindowLabel(treatmentWindowScore),
      bestRecoveryPosition:best?{...best,point:clonePoint(best.point)}:null,
      candidates:candidates.slice(0,8).map(item=>({...item,point:clonePoint(item.point)})),
      betterGroundAvailable:betterGround,
      reason:betterGround
        ?`${best.label} materially improves casualty protection (${Math.round(currentProtection*100)}% → ${Math.round(best.protection*100)}%).`
        :threatPoint?"Current casualty position does not justify a drag relative to available nearby recovery ground.":"No active tactical threat requires casualty displacement."
    };
  }
}
