const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

function hostileWeight(contact){
  const relationship=contact?.relationship??contact?.relationshipKind??"unknown";
  if(["hostile","enemy","opposed"].includes(relationship))return 1;
  if(["unknown","unresolved","unfamiliar"].includes(relationship))return .62;
  if(["cooperating","friendly","same_faction"].includes(relationship))return 0;
  return .42;
}

export class ActorUtilityEvaluationService{
  constructor({decisionLog=null}={}){this.decisionLog=decisionLog;this.byActor=new Map();this.motionHistory=new Map();}
  evaluate({game,actor,picture,currentAction=null,currentCommitment=null,role=null,agenda=null,now=0}={}){
    const previous=this.motionHistory.get(actor.id)??{x:actor.x,y:actor.y,at:now,lastProgressAt:now,lastUsefulAt:now};
    const moved=distance(previous,actor);
    const purposeful=Boolean(currentAction&&!["HoldReady","ObserveSector"].includes(currentAction.type));
    const lastProgressAt=moved>9?now:previous.lastProgressAt;
    const lastUsefulAt=purposeful||picture?.visibleThreats?.length||picture?.incomingFire?.length?now:previous.lastUsefulAt;
    const stationaryFor=Math.max(0,now-lastProgressAt);
    const idleFor=Math.max(0,now-lastUsefulAt);
    this.motionHistory.set(actor.id,{x:actor.x,y:actor.y,at:now,lastProgressAt,lastUsefulAt});

    const visible=picture?.visibleThreats??[];
    const hostileContact=visible.reduce((best,item)=>Math.max(best,hostileWeight(item)*clamp((item.confidence??0)/100)),0);
    const incoming=clamp((picture?.incomingFire?.length??0)*.45);
    const suppression=clamp((picture?.suppressionValue??0)/82);
    const exposure=picture?.exposed?1:0;
    const woundUrgency=clamp((picture?.selfAidNeed?.urgency??picture?.woundState?.bleeding??0)/2);
    const criticalBleeding=Number(picture?.woundState?.bleeding??0)>1.2;
    const coverGain=clamp((picture?.bestCover?.utility?.protection??0)-(picture?.currentCover?.protection??0));
    const crowded=clamp((52-(picture?.nearestFriendly?.distance??999))/52);
    const congestion=clamp(picture?.localCongestion??0);
    const weaponEmpty=picture?.weaponReadiness?.reloadRequired?1:0;
    const protectedNow=picture?.currentCover?.protected?1:0;
    const contactPressure=clamp(hostileContact*.72+incoming*.55+suppression*.34);
    const treatmentSafety=clamp(protectedNow*.62+(picture?.securitySupport??0)*.28-contactPressure*.82-exposure*.48);
    const stagnation=clamp(Math.max(stationaryFor-4,0)/8+Math.max(idleFor-7,0)/12);
    const missionPressure=agenda?.selected?.id?0.48:.25;

    const candidates=[
      {kind:"react_to_contact",score:clamp(contactPressure*.92+exposure*.18),factors:{hostileContact,incoming,suppression,exposure}},
      {kind:"seek_cover",score:clamp(contactPressure*.72+exposure*.34+coverGain*.45+woundUrgency*.16),factors:{contactPressure,exposure,coverGain,woundUrgency}},
      {kind:"treat_self",score:clamp(woundUrgency*.78+treatmentSafety*.48+(criticalBleeding?.34:0)-contactPressure*.58-exposure*.34),factors:{woundUrgency,treatmentSafety,criticalBleeding,contactPressure,exposure}},
      {kind:"reload_safely",score:clamp(weaponEmpty*.76+protectedNow*.22-contactPressure*.18),factors:{weaponEmpty,protectedNow,contactPressure}},
      {kind:"restore_spacing",score:clamp(crowded*.68+congestion*.54+stagnation*.14),factors:{crowded,congestion,stagnation}},
      {kind:"scan",score:clamp(.22+(role?.roleId==="local_security" ? .22 : .08)+idleFor/30+hostileContact*.24),factors:{idleFor,hostileContact}},
      {kind:"continue_mission",score:clamp(missionPressure-contactPressure*.88-woundUrgency*.26-congestion*.16),factors:{missionPressure,contactPressure,woundUrgency,congestion}},
      {kind:"break_stagnation",score:clamp(stagnation*.82+congestion*.36),factors:{stagnation,congestion,stationaryFor,idleFor}}
    ].sort((a,b)=>b.score-a.score||a.kind.localeCompare(b.kind));
    const result={actorId:actor.id,updatedAt:now,candidates,selected:candidates[0]??null,contactPressure,treatmentSafety,stagnation,stationaryFor,idleFor,incumbentAction:currentAction?.type??null,commitmentKind:currentCommitment?.kind??null};
    this.byActor.set(actor.id,result);
    actor.aiV2Utility={selected:result.selected?.kind??null,score:result.selected?.score??0,contactPressure,treatmentSafety,stagnation,candidates:candidates.slice(0,5).map(item=>({kind:item.kind,score:item.score}))};
    return result;
  }
  get(actorId){const item=this.byActor.get(actorId);return item?{...item,candidates:item.candidates.map(candidate=>({...candidate,factors:{...candidate.factors}})),selected:item.selected?{...item.selected,factors:{...item.selected.factors}}:null}:null;}
  prune(liveActorIds){const live=new Set(liveActorIds);for(const actorId of [...this.byActor.keys()])if(!live.has(actorId)){this.byActor.delete(actorId);this.motionHistory.delete(actorId);}}
  summary(){return[...this.byActor.keys()].map(actorId=>this.get(actorId));}
}
