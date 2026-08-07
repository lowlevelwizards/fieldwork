const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const point=value=>value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y))?{x:Number(value.x),y:Number(value.y)}:null;
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

const DIRECTION_VECTORS=Object.freeze({
  east:{x:1,y:0},northeast:{x:Math.SQRT1_2,y:-Math.SQRT1_2},north:{x:0,y:-1},northwest:{x:-Math.SQRT1_2,y:-Math.SQRT1_2},
  west:{x:-1,y:0},southwest:{x:-Math.SQRT1_2,y:Math.SQRT1_2},south:{x:0,y:1},southeast:{x:Math.SQRT1_2,y:Math.SQRT1_2}
});

function relationshipHostility(value){
  const relationship=String(value??"unknown").toLowerCase();
  if(["hostile","enemy","opposed"].includes(relationship))return 1;
  if(["cooperating","friendly","same_faction"].includes(relationship))return 0;
  if(["unknown","unresolved","unfamiliar"].includes(relationship))return .62;
  return .44;
}

function motionVector(source){
  const direction=DIRECTION_VECTORS[String(source?.movementDirection??source?.track?.movementDirection??"").toLowerCase()]??null;
  const speed=clamp(Number(source?.estimatedSpeed??source?.track?.estimatedSpeed??0),0,180);
  if(!direction||speed<6)return{x:0,y:0,speed:0,direction:"unknown"};
  return{x:direction.x*speed,y:direction.y*speed,speed,direction:String(source?.movementDirection??source?.track?.movementDirection)};
}

function sourceTimes(source,kind,now){
  if(kind==="report")return{confirmedAt:Number(source?.sourceObservationAt??source?.reportedAt??now),reportedAt:Number(source?.reportedAt??now)};
  return{confirmedAt:Number(source?.lastObservedAt??now),reportedAt:null};
}

function evidenceState(kind,source,age,now){
  if(kind==="personal"&&source?.currentlyVisible)return"visible_confirmed";
  if(kind==="incoming")return now<=Number(source?.immediateUntil??0)?"hostile_source":"hostile_source_memory";
  if(kind==="report")return age<=12?"team_reported":"stale";
  if(age<=3.5)return"recently_lost";
  if(age<=13)return"tracked_unseen";
  return"stale";
}

function evidenceWeight(kind,source,now){
  if(kind==="personal"&&source?.currentlyVisible)return 1;
  if(kind==="incoming")return now<=Number(source?.immediateUntil??0)?.98:.82;
  if(kind==="personal")return .88;
  return .74;
}

function uncertaintyFor({kind,source,age,reportAge=0,motion,predictionAge}){
  const confidence=clamp((source?.confidence??0)/100);
  if(kind==="personal"&&source?.currentlyVisible)return clamp(12+(1-confidence)*42,10,58);
  if(kind==="incoming")return clamp(48+(1-confidence)*62+age*19,38,430);
  if(kind==="report")return clamp(44+(1-confidence)*78+age*15+reportAge*4+motion.speed*predictionAge*.18,36,520);
  return clamp(24+(1-confidence)*68+age*17+motion.speed*predictionAge*.16,20,520);
}

function freshnessFor(kind,age,source,now){
  if(kind==="personal"&&source?.currentlyVisible)return 1;
  const half=kind==="incoming"?11:kind==="report"?16:14;
  let value=Math.exp(-Math.max(0,age)/half);
  if(kind==="incoming"&&now<=Number(source?.immediateUntil??0))value=Math.max(value,.96);
  return clamp(value);
}

function projectEvidence(kind,source,{actor,now,predictionHorizon}){
  const base=point(source?.approximatePosition);if(!base)return null;
  const {confirmedAt,reportedAt}=sourceTimes(source,kind,now);
  const age=Math.max(0,now-confirmedAt);
  const reportAge=reportedAt===null?0:Math.max(0,now-reportedAt);
  const motion=motionVector(source);
  const predictionAge=(kind==="incoming"||kind==="personal"&&source?.currentlyVisible)?0:Math.min(age,predictionHorizon);
  const damping=predictionAge>0?Math.max(.48,.82-predictionAge/predictionHorizon*.24):0;
  const center={x:base.x+motion.x*predictionAge*damping,y:base.y+motion.y*predictionAge*damping};
  const uncertaintyRadius=uncertaintyFor({kind,source,age,reportAge,motion,predictionAge});
  const confidence=clamp((source?.confidence??0)/100);
  const freshness=freshnessFor(kind,age,source,now);
  const hostility=kind==="incoming"?1:relationshipHostility(source?.relationship);
  const spatialPrecision=clamp(confidence*(1-uncertaintyRadius/560));
  const weight=evidenceWeight(kind,source,now);
  const immediate=kind==="incoming"&&now<=Number(source?.immediateUntil??0);
  const activity=String(source?.activity??source?.track?.currentActivity??"");
  const activityBonus=activity==="firing"?.16:activity==="approaching"?.08:0;
  const proximity=clamp((520-distance(actor,center))/520);
  const salience=clamp(hostility*(confidence*.42+freshness*.31+spatialPrecision*.27)*weight+activityBonus*hostility+proximity*.1*hostility+(immediate?.22:0));
  return{
    kind,sourceId:source?.id??source?.eventId??null,sourceActorId:source?.sourceActorId??null,subjectId:source?.subjectId??null,
    subjectTeamId:source?.subjectTeamId??null,relationship:kind==="incoming"?"hostile":source?.relationship??"unknown",
    identity:source?.identity??"unknown",factionId:source?.factionId??null,
    center,basePosition:base,uncertaintyRadius,confidence,freshness,hostility,spatialPrecision,salience,
    state:evidenceState(kind,source,age,now),currentlyVisible:Boolean(kind==="personal"&&source?.currentlyVisible),
    lastConfirmedAt:confirmedAt,age,predictionAge,predictionHorizon,motion,immediate,
    activity:activity||null,intentHypothesis:source?.intentHypothesis??source?.track?.intentHypothesis??null
  };
}

function cloneEvidence(item){return item?{...item,center:{...item.center},basePosition:{...item.basePosition},motion:{...item.motion},intentHypothesis:item.intentHypothesis?{...item.intentHypothesis}:null}:null;}
function cloneBelief(item){return item?{...item,center:{...item.center},motion:{...item.motion},evidenceKinds:[...item.evidenceKinds],evidence:item.evidence.map(cloneEvidence),intentHypothesis:item.intentHypothesis?{...item.intentHypothesis}:null}:null;}

export class TacticalContactBeliefService{
  constructor({predictionHorizon=3.2,minimumSalience=.055}={}){
    this.predictionHorizon=Math.max(.8,Number(predictionHorizon)||3.2);
    this.minimumSalience=Math.max(.01,Number(minimumSalience)||.055);
  }

  buildForActor({actor,personalContacts=[],receivedReports=[],incomingThreats=[],now=0}={}){
    if(!actor)return{beliefs:[],best:null,contactPressure:0,threatRegion:null};
    const groups=new Map();
    const add=(kind,source)=>{
      const projected=projectEvidence(kind,source,{actor,now,predictionHorizon:this.predictionHorizon});
      if(!projected||projected.hostility<=.02||projected.salience<this.minimumSalience)return;
      const key=String(projected.subjectId??`${kind}:${projected.sourceId??groups.size}`);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(projected);
    };
    for(const contact of personalContacts)add("personal",contact);
    for(const report of receivedReports)add("report",report);
    for(const threat of incomingThreats)add("incoming",threat);

    const beliefs=[];
    for(const [key,evidence] of groups){
      evidence.sort((a,b)=>this.#anchorScore(b)-this.#anchorScore(a)||b.lastConfirmedAt-a.lastConfirmedAt);
      const anchor=evidence[0];if(!anchor)continue;
      let uncertainty=anchor.uncertaintyRadius;
      let confidence=anchor.confidence;
      let salience=anchor.salience;
      let contradictory=false,corroborating=0;
      for(const other of evidence.slice(1)){
        const separation=distance(anchor.center,other.center);
        const compatibleRadius=Math.max(90,anchor.uncertaintyRadius+other.uncertaintyRadius*.6);
        if(separation<=compatibleRadius){
          corroborating+=1;
          uncertainty*=.89;
          confidence=clamp(Math.max(confidence,other.confidence)+.04);
          salience=clamp(Math.max(salience,other.salience)+.045);
        }else if(other.confidence>=.35&&(other.freshness>=.4||anchor.freshness>=.8)){
          contradictory=true;
          uncertainty=Math.min(560,uncertainty*1.24+Math.min(90,separation*.12));
          salience=Math.max(salience,other.salience*.86);
        }
      }
      const spatialPrecision=clamp(confidence*(1-uncertainty/560));
      const motion={...anchor.motion};
      const belief={
        id:`tactical_contact:${actor.id}:${key}`,actorId:actor.id,subjectId:anchor.subjectId??key,
        subjectTeamId:evidence.find(item=>item.subjectTeamId)?.subjectTeamId??null,
        relationship:evidence.find(item=>item.relationship&&item.relationship!=="unknown")?.relationship??anchor.relationship,
        identity:evidence.find(item=>item.identity&&item.identity!=="unknown")?.identity??anchor.identity,
        factionId:evidence.find(item=>item.factionId)?.factionId??null,
        state:anchor.state,center:{...anchor.center},approximatePosition:{...anchor.center},uncertaintyRadius:uncertainty,
        confidence,confidencePercent:Math.round(confidence*100),hostility:Math.max(...evidence.map(item=>item.hostility)),
        tacticalSalience:clamp(salience),spatialPrecision,currentlyVisible:evidence.some(item=>item.currentlyVisible),
        lastConfirmedAt:Math.max(...evidence.map(item=>item.lastConfirmedAt)),age:Math.max(0,now-Math.max(...evidence.map(item=>item.lastConfirmedAt))),
        predictionAge:anchor.predictionAge,predictionHorizon:this.predictionHorizon,predictionLimited:anchor.age>this.predictionHorizon,
        motion,intentHypothesis:anchor.intentHypothesis?{...anchor.intentHypothesis}:null,
        activity:anchor.activity,evidenceKinds:[...new Set(evidence.map(item=>item.kind))],evidence:evidence.map(cloneEvidence),
        corroboratingEvidence:corroborating,contradictoryEvidence:contradictory,
        contactPressureContribution:0
      };
      const proximity=clamp((460-distance(actor,belief.center))/460);
      belief.contactPressureContribution=clamp(belief.tacticalSalience*(.88+proximity*.16));
      beliefs.push(belief);
    }
    beliefs.sort((a,b)=>b.contactPressureContribution-a.contactPressureContribution||b.lastConfirmedAt-a.lastConfirmedAt);
    const best=beliefs[0]??null;
    const contactPressure=clamp((best?.contactPressureContribution??0)+(beliefs[1]?.contactPressureContribution??0)*.2+(beliefs[2]?.contactPressureContribution??0)*.08);
    const threatRegion=best?{center:{...best.center},uncertaintyRadius:best.uncertaintyRadius,confidence:best.confidence,salience:best.tacticalSalience,spatialPrecision:best.spatialPrecision,state:best.state,subjectId:best.subjectId,subjectTeamId:best.subjectTeamId}:null;
    return{beliefs:beliefs.map(cloneBelief),best:cloneBelief(best),contactPressure,threatRegion};
  }

  #anchorScore(item){
    return item.salience*.62+item.freshness*.2+item.confidence*.12+item.spatialPrecision*.06+(item.currentlyVisible ? .55 : 0)+(item.immediate ? .42 : 0);
  }
}
