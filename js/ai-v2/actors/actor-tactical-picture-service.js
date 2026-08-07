import { TacticalContactBeliefService } from "./tactical-contact-belief-service.js";

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function suppressionState(value){
  const amount=Math.max(0,Number(value)||0);
  if(amount>=82)return"breaking";
  if(amount>=58)return"pinned";
  if(amount>=32)return"pressured";
  if(amount>=12)return"alert";
  return"steady";
}

function clonePoint(point){return point?{x:point.x,y:point.y}:null;}
function beliefAsThreat(belief){
  if(!belief)return null;
  return{
    id:belief.id,subjectId:belief.subjectId,subjectTeamId:belief.subjectTeamId,relationship:belief.relationship,
    identity:belief.identity,factionId:belief.factionId,confidence:belief.confidencePercent,
    approximatePosition:clonePoint(belief.center),currentlyVisible:Boolean(belief.currentlyVisible),
    lastObservedAt:belief.lastConfirmedAt,distance:null,activity:belief.activity,state:belief.state,
    tacticalSalience:belief.tacticalSalience,uncertaintyRadius:belief.uncertaintyRadius,
    spatialPrecision:belief.spatialPrecision,evidenceKinds:[...(belief.evidenceKinds??[])],
    track:{movementDirection:belief.motion?.direction??"unknown",estimatedSpeed:belief.motion?.speed??0,intentHypothesis:belief.intentHypothesis?{...belief.intentHypothesis}:null}
  };
}

export class ActorTacticalPictureService{
  constructor({directionalCover,firingEdges=null,positionSlots=null,contactBeliefs=null,decisionLog=null}={}){
    this.directionalCover=directionalCover;
    this.firingEdges=firingEdges;
    this.positionSlots=positionSlots;
    this.contactBeliefs=contactBeliefs??new TacticalContactBeliefService();
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,personalKnowledge,teamKnowledge,threatKnowledge,teamProcedures,teamAgenda,now=0}={}){
    const live=new Set();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious)continue;
      live.add(actor.id);
      const personal=(personalKnowledge?.getContacts?.(actor.id)??[]).filter(contact=>contact.relationship!=="same_faction");
      const liveClosure=game?.scenarioMode==="live"&&Boolean(game?.livingSandbox?.liveMode);
      const visibleThreats=personal.filter(contact=>contact.currentlyVisible&&contact.subjectTeamId&&(contact.confidence>=24||liveClosure&&Number(contact.distance??999)<=280&&contact.confidence>=10));
      const incoming=threatKnowledge?.getThreats?.(actor.id)??[];
      const receivedReports=teamKnowledge?.getReceivedContacts?.(actor.id)??[];
      const contactProjection=this.contactBeliefs.buildForActor({actor,personalContacts:personal,receivedReports,incomingThreats:incoming,now});
      const contactBeliefs=contactProjection.beliefs??[];
      const bestBelief=contactProjection.best??null;
      const contactPressure=clamp(contactProjection.contactPressure??0);
      const recentThreats=contactBeliefs.filter(item=>!item.currentlyVisible&&item.tacticalSalience>=.12).map(beliefAsThreat);
      const reportedThreats=contactBeliefs.filter(item=>item.evidenceKinds?.includes("report")).map(beliefAsThreat);
      const bestThreat=beliefAsThreat(bestBelief);
      if(bestThreat)bestThreat.distance=distance(actor,bestThreat.approximatePosition);
      const threatPoint=contactPressure>=.08?clonePoint(bestBelief?.center):null;
      const threatRegion=contactPressure>=.08&&contactProjection.threatRegion?{
        ...contactProjection.threatRegion,center:clonePoint(contactProjection.threatRegion.center)
      }:null;
      const teamActors=(game.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
      const coverSearch=threatPoint&&contactPressure>=.16?this.directionalCover?.findBestSlot?.({
        game,actor,roleId:"tactical_deliberation",threatPoint,teamActors,
        policy:{maximumCoverDistance:520,maximumTravel:520,minimumProtection:.42,maximumCohesionDistance:780},claims:this.positionSlots,now
      }):null;
      const nearestFriendly=teamActors.filter(candidate=>candidate.id!==actor.id).sort((a,b)=>distance(actor,a)-distance(actor,b))[0]??null;
      const assessment=game?.wounds?.getAssessment?.(actor)??null;
      const treatmentNeed=game?.wounds?.getTreatmentNeed?.(actor)??null;
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const currentCover=threatPoint?this.#currentCover(game,actor,threatPoint,now):null;
      const suppression=suppressionState(actor.aiV2Suppression);
      const magazineSize=Math.max(1,Number(actor.magazineSize??20));
      const ammoInMagazine=Math.max(0,Number(actor.ammoInMagazine??magazineSize));
      const weaponReadiness={magazineSize,ammoInMagazine,ammoFraction:ammoInMagazine/magazineSize,reloadRequired:ammoInMagazine<=0,reloadAdvised:ammoInMagazine<=Math.max(2,Math.floor(magazineSize*.18)),reloading:Boolean(actor.reloading),effectiveRange:Number(actor.aiV2EffectiveRange??760)};
      const currentSlot=actor.aiV2CoverOccupancy?.slot??actor.aiV2DefensivePosition?.slot??coverSearch?.best??null;
      const firingEdge=threatPoint&&currentSlot?this.firingEdges?.evaluate?.({game,actor,slot:currentSlot,threatPoint,friendlies:teamActors})??null:null;
      const teamCenter=teamActors.length?{x:teamActors.reduce((sum,item)=>sum+item.x,0)/teamActors.length,y:teamActors.reduce((sum,item)=>sum+item.y,0)/teamActors.length}:null;
      const maximumTeamSeparation=teamCenter?Math.max(...teamActors.map(item=>distance(item,teamCenter)),0):0;
      const nearbyFriendlies=teamActors.filter(candidate=>candidate.id!==actor.id&&distance(actor,candidate)<92);
      const localCongestion=clamp(nearbyFriendlies.reduce((sum,item)=>sum+clamp((92-distance(actor,item))/92),0)/Math.max(1,teamActors.length-1));
      const securitySupport=clamp(teamActors.filter(candidate=>candidate.id!==actor.id&&!candidate.medical?.unconscious&&distance(actor,candidate)<260&&["ready","aiming","firing"].includes(candidate.pose)).length/2);
      const picture={
        actorId:actor.id,teamId:actor.teamId,updatedAt:now,
        contactBeliefs:contactBeliefs.map(item=>({...item,center:clonePoint(item.center),motion:{...item.motion},evidenceKinds:[...(item.evidenceKinds??[])]})),
        bestContactBelief:bestBelief?{...bestBelief,center:clonePoint(bestBelief.center),motion:{...bestBelief.motion},evidenceKinds:[...(bestBelief.evidenceKinds??[])]}:null,
        contactPressure,threatRegion,
        visibleThreats:visibleThreats.map(contact=>({...contact,approximatePosition:clonePoint(contact.approximatePosition)})),
        recentThreats,
        reportedThreats,
        incomingFire:incoming.map(threat=>({...threat,approximatePosition:clonePoint(threat.approximatePosition)})),
        bestThreat,
        threatPoint,
        suppressionValue:Number(actor.aiV2Suppression??0),suppressionState:suppression,
        woundState:assessment?{...assessment}:null,
        selfAidNeed:treatmentNeed?{...treatmentNeed}:null,
        currentCover,
        weaponReadiness,
        firingEdge:firingEdge?{best:firingEdge.best?{...firingEdge.best,point:clonePoint(firingEdge.best.point),returnPoint:clonePoint(firingEdge.best.returnPoint)}:null,candidates:firingEdge.candidates.map(item=>({...item,point:clonePoint(item.point),returnPoint:clonePoint(item.returnPoint)}))}:null,
        teamCohesion:{center:clonePoint(teamCenter),maximumSeparation:maximumTeamSeparation,memberCount:teamActors.length},
        localCongestion,securitySupport,
        bestCover:coverSearch?.best?{...coverSearch.best,point:clonePoint(coverSearch.best.point),utility:{...coverSearch.best.utility}}:null,
        nearestFriendly:nearestFriendly?{actorId:nearestFriendly.id,distance:distance(actor,nearestFriendly),point:{x:nearestFriendly.x,y:nearestFriendly.y}}:null,
        responsibility:role?{roleId:role.roleId,label:role.label,procedureId:role.procedureId,phaseId:role.phase?.id??null}:null,
        agenda:agenda?{intentId:agenda.intentId,selected:agenda.selected?{...agenda.selected}:null}:null,
        currentDestination:clonePoint(actor.aiV2Reposition?.destination??actor.aiV2OperationalTravel?.destination??null),
        exposed:Boolean(threatPoint&&contactPressure>=.18&&!currentCover?.protected),
        canSelfAid:Boolean(treatmentNeed&&Number(actor.aiV2MedicalSupplies?.[treatmentNeed.type]??0)>0),
        cohesionDistance:nearestFriendly?distance(actor,nearestFriendly):0
      };
      this.byActor.set(actor.id,picture);
      actor.aiV2TacticalPicture={
        suppressionState:picture.suppressionState,
        visibleThreatCount:picture.visibleThreats.length,
        rememberedThreatCount:picture.recentThreats.length,
        contactBeliefCount:picture.contactBeliefs.length,
        contactState:picture.bestContactBelief?.state??null,
        exposed:picture.exposed,
        bestCoverPoint:clonePoint(picture.bestCover?.point),
        responsibility:picture.responsibility?.label??null,
        treatmentSafe:Boolean(picture.currentCover?.protected&&!picture.incomingFire.length||!picture.threatPoint||picture.contactPressure<.14),
        contactPressure:picture.contactPressure,
        threatPoint:clonePoint(picture.threatPoint),
        threatUncertaintyRadius:Number(picture.threatRegion?.uncertaintyRadius??0),
        threatConfidence:Number(picture.threatRegion?.confidence??0),
        threatPrecision:Number(picture.threatRegion?.spatialPrecision??0)
      };
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  get(actorId){
    const picture=this.byActor.get(actorId);if(!picture)return null;
    return{
      ...picture,threatPoint:clonePoint(picture.threatPoint),
      threatRegion:picture.threatRegion?{...picture.threatRegion,center:clonePoint(picture.threatRegion.center)}:null,
      contactBeliefs:(picture.contactBeliefs??[]).map(item=>({...item,center:clonePoint(item.center),motion:{...item.motion},evidenceKinds:[...(item.evidenceKinds??[])]})),
      bestContactBelief:picture.bestContactBelief?{...picture.bestContactBelief,center:clonePoint(picture.bestContactBelief.center),motion:{...picture.bestContactBelief.motion},evidenceKinds:[...(picture.bestContactBelief.evidenceKinds??[])]}:null,
      bestCover:picture.bestCover?{...picture.bestCover,point:clonePoint(picture.bestCover.point),utility:{...picture.bestCover.utility}}:null,
      currentCover:picture.currentCover?{...picture.currentCover}:null
    };
  }
  summary(){return[...this.byActor.keys()].map(actorId=>this.get(actorId));}

  #currentCover(game,actor,threatPoint,now=0){
    let best=null;
    const occupancy=actor.aiV2CoverOccupancy;
    if(occupancy?.status==="protected"&&occupancy.point&&distance(actor,occupancy.point)<=76){
      const threatCompatible=!occupancy.threatPoint||distance(occupancy.threatPoint,threatPoint)<=320;
      const fresh=now-(occupancy.enteredAt??now)<=18;
      if(threatCompatible&&fresh)best={protected:true,protection:Math.max(.56,Number(occupancy.protection)||0),sourceType:"tactical_cover_occupancy",sourcePoint:{...occupancy.point},slot:occupancy.slot?{...occupancy.slot}:null};
    }
    for(const obstacle of game?.map?.obstacles??[]){
      const radius=Math.max(18,Number(obstacle.radius)||36);
      const actorDistance=distance(actor,obstacle);
      if(actorDistance>radius+46)continue;
      const threatDistance=distance(threatPoint,obstacle);
      const between=threatDistance+actorDistance<=distance(threatPoint,actor)+radius*.7;
      const protection=between?clamp(1-actorDistance/Math.max(radius+46,1)):.12;
      if(!best||protection>best.protection)best={protected:protection>=.38,protection,sourceType:obstacle.type??"cover",sourcePoint:{x:obstacle.x,y:obstacle.y}};
    }
    return best??{protected:false,protection:0,sourceType:null,sourcePoint:null};
  }
}
