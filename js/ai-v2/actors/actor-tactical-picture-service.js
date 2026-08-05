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

export class ActorTacticalPictureService{
  constructor({directionalCover,firingEdges=null,positionSlots=null,decisionLog=null}={}){
    this.directionalCover=directionalCover;
    this.firingEdges=firingEdges;
    this.positionSlots=positionSlots;
    this.decisionLog=decisionLog;
    this.byActor=new Map();
  }

  update({game,personalKnowledge,teamKnowledge,threatKnowledge,teamProcedures,teamAgenda,now=0}={}){
    const live=new Set();
    for(const actor of game?.actors??[]){
      if(actor.medical?.dead||actor.medical?.unconscious)continue;
      live.add(actor.id);
      const personal=(personalKnowledge?.getContacts?.(actor.id)??[]).filter(contact=>contact.relationship!=="same_faction");
      const visibleThreats=personal.filter(contact=>contact.currentlyVisible&&contact.subjectTeamId&&contact.confidence>=24);
      const recentThreats=personal.filter(contact=>!contact.currentlyVisible&&now-(contact.lastObservedAt??0)<=4.5&&contact.confidence>=20);
      const incoming=threatKnowledge?.getThreats?.(actor.id)??[];
      const bestThreat=incoming[0]??visibleThreats[0]??recentThreats[0]??null;
      const threatPoint=clonePoint(bestThreat?.approximatePosition);
      const teamActors=(game.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
      const coverSearch=threatPoint?this.directionalCover?.findBestSlot?.({
        game,actor,roleId:"tactical_deliberation",threatPoint,teamActors,
        policy:{maximumCoverDistance:520,maximumTravel:520,minimumProtection:.42,maximumCohesionDistance:780},claims:this.positionSlots,now
      }):null;
      const nearestFriendly=teamActors.filter(candidate=>candidate.id!==actor.id).sort((a,b)=>distance(actor,a)-distance(actor,b))[0]??null;
      const assessment=game?.wounds?.getAssessment?.(actor)??null;
      const treatmentNeed=game?.wounds?.getTreatmentNeed?.(actor)??null;
      const role=teamProcedures?.getActorRole?.(actor.id)??null;
      const agenda=teamAgenda?.get?.(actor.teamId)??null;
      const currentCover=threatPoint?this.#currentCover(game,actor,threatPoint):null;
      const suppression=suppressionState(actor.aiV2Suppression);
      const magazineSize=Math.max(1,Number(actor.magazineSize??20));
      const ammoInMagazine=Math.max(0,Number(actor.ammoInMagazine??magazineSize));
      const weaponReadiness={magazineSize,ammoInMagazine,ammoFraction:ammoInMagazine/magazineSize,reloadRequired:ammoInMagazine<=0,reloadAdvised:ammoInMagazine<=Math.max(2,Math.floor(magazineSize*.18)),reloading:Boolean(actor.reloading),effectiveRange:Number(actor.aiV2EffectiveRange??760)};
      const currentSlot=actor.aiV2DefensivePosition?.slot??coverSearch?.best??null;
      const firingEdge=threatPoint&&currentSlot?this.firingEdges?.evaluate?.({game,actor,slot:currentSlot,threatPoint,friendlies:teamActors})??null:null;
      const teamCenter=teamActors.length?{x:teamActors.reduce((sum,item)=>sum+item.x,0)/teamActors.length,y:teamActors.reduce((sum,item)=>sum+item.y,0)/teamActors.length}:null;
      const maximumTeamSeparation=teamCenter?Math.max(...teamActors.map(item=>distance(item,teamCenter)),0):0;
      const nearbyFriendlies=teamActors.filter(candidate=>candidate.id!==actor.id&&distance(actor,candidate)<92);
      const localCongestion=clamp(nearbyFriendlies.reduce((sum,item)=>sum+clamp((92-distance(actor,item))/92),0)/Math.max(1,teamActors.length-1));
      const securitySupport=clamp(teamActors.filter(candidate=>candidate.id!==actor.id&&!candidate.medical?.unconscious&&distance(actor,candidate)<260&&["ready","aiming","firing"].includes(candidate.pose)).length/2);
      const picture={
        actorId:actor.id,teamId:actor.teamId,updatedAt:now,
        visibleThreats:visibleThreats.map(contact=>({...contact,approximatePosition:clonePoint(contact.approximatePosition)})),
        recentThreats:recentThreats.map(contact=>({...contact,approximatePosition:clonePoint(contact.approximatePosition)})),
        reportedThreats:(teamKnowledge?.getTeamContacts?.(actor.teamId)??[]).filter(contact=>contact.subjectTeamId&&contact.confidence>=28).map(contact=>({...contact,approximatePosition:clonePoint(contact.approximatePosition)})),
        incomingFire:incoming.map(threat=>({...threat,approximatePosition:clonePoint(threat.approximatePosition)})),
        bestThreat:bestThreat?{...bestThreat,approximatePosition:clonePoint(bestThreat.approximatePosition)}:null,
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
        exposed:Boolean(threatPoint&&!currentCover?.protected),
        canSelfAid:Boolean(treatmentNeed&&Number(actor.aiV2MedicalSupplies?.[treatmentNeed.type]??0)>0),
        cohesionDistance:nearestFriendly?distance(actor,nearestFriendly):0
      };
      this.byActor.set(actor.id,picture);
      actor.aiV2TacticalPicture={
        suppressionState:picture.suppressionState,
        visibleThreatCount:picture.visibleThreats.length,
        rememberedThreatCount:picture.recentThreats.length,
        exposed:picture.exposed,
        bestCoverPoint:clonePoint(picture.bestCover?.point),
        responsibility:picture.responsibility?.label??null,
        treatmentSafe:Boolean(picture.currentCover?.protected&&!picture.incomingFire.length||!picture.threatPoint),
        contactPressure:clamp((picture.visibleThreats.length? .58:0)+(picture.incomingFire.length? .42:0)),
        threatPoint:clonePoint(picture.threatPoint)
      };
    }
    for(const actorId of [...this.byActor.keys()])if(!live.has(actorId))this.byActor.delete(actorId);
  }

  get(actorId){
    const picture=this.byActor.get(actorId);if(!picture)return null;
    return{...picture,threatPoint:clonePoint(picture.threatPoint),bestCover:picture.bestCover?{...picture.bestCover,point:clonePoint(picture.bestCover.point),utility:{...picture.bestCover.utility}}:null,currentCover:picture.currentCover?{...picture.currentCover}:null};
  }
  summary(){return[...this.byActor.keys()].map(actorId=>this.get(actorId));}

  #currentCover(game,actor,threatPoint){
    let best=null;
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
