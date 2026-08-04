const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const clone=item=>item?{...item,memberIds:[...(item.memberIds??[])],activities:[...(item.activities??[])],approximatePosition:item.approximatePosition?{...item.approximatePosition}:null,operationHypothesis:item.operationHypothesis?{...item.operationHypothesis}:null,distress:item.distress?{...item.distress}:null}:null;

function visibleActivity(actor){
  const text=`${actor?.currentAction??""} ${actor?.currentTask??""}`.toLowerCase();
  if(/under fire|protective fire|warning shot|firing/.test(text))return"under_fire";
  if(/casualty|wound|stabiliz|evacuat|medical/.test(text))return"casualty_aid";
  if(/assist.*work|technical work|service|repair|restor/.test(text))return"service_infrastructure";
  if(/cargo|supply|package|collect/.test(text))return"recover_supplies";
  if(/survey|record.*route|observation point/.test(text))return"survey_route";
  if(/return|extract/.test(text))return"returning";
  if(/route|travel|waypoint|moving to/.test(text))return"traveling";
  if(/hold|security|watch/.test(text))return"securing_area";
  return"unknown_activity";
}

function operationLabel(kind){
  switch(kind){
    case"service_infrastructure":return"servicing infrastructure";
    case"recover_supplies":return"recovering supplies";
    case"survey_route":return"surveying a route";
    case"establish_forward_position":return"establishing a forward position";
    case"casualty_aid":return"treating or evacuating a casualty";
    case"returning":return"returning from an operation";
    case"traveling":return"moving through the area";
    case"securing_area":return"securing the area";
    case"under_fire":return"under fire";
    default:return"conducting an unclear field activity";
  }
}

function closestObjective(game,actors){
  if(!actors.length)return null;
  const centroid={x:actors.reduce((s,a)=>s+a.x,0)/actors.length,y:actors.reduce((s,a)=>s+a.y,0)/actors.length};
  return (game?.objectives??[]).map(objective=>({objective,distance:distance(centroid,objective)})).sort((a,b)=>a.distance-b.distance)[0]??null;
}

export class TeamContactUnderstandingStore{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byObserverTeam=new Map();
  }

  update({game,teamKnowledge,personalKnowledge,relationships,now=0}={}){
    const observerTeams=new Set((game?.actors??[]).map(actor=>actor.teamId).filter(Boolean));
    for(const observerTeamId of observerTeams){
      const reports=teamKnowledge?.getTeamContacts?.(observerTeamId)??[];
      const grouped=new Map();
      for(const report of reports){
        const subjectActor=(game?.actors??[]).find(actor=>actor.id===report.subjectId)??null;
        const subjectTeamId=report.subjectTeamId??subjectActor?.teamId??null;
        if(!subjectTeamId||subjectTeamId===observerTeamId)continue;
        if(!grouped.has(subjectTeamId))grouped.set(subjectTeamId,[]);
        grouped.get(subjectTeamId).push({report,subjectActor});
      }
      const next=new Map();
      for(const [subjectTeamId,entries] of grouped){
        const actors=[...new Map(entries.map(entry=>[entry.subjectActor?.id,entry.subjectActor]).filter(([id])=>id)).values()];
        const representative=actors[0]??null;
        const observer=(game?.actors??[]).find(actor=>actor.teamId===observerTeamId)??null;
        const relationship=relationships?.relationshipBetweenTeams?.(game,observerTeamId,subjectTeamId,{now})??"unknown";
        const factions=entries.map(entry=>entry.report.factionId??entry.subjectActor?.factionId??null).filter(Boolean);
        const factionId=factions[0]??null;
        const confidence=Math.max(...entries.map(entry=>Number(entry.report.confidence)||0),0);
        const activities=actors.map(visibleActivity).filter(Boolean);
        const dominant=activities.find(activity=>activity!=="unknown_activity")??entries.map(entry=>entry.report.operationHypothesis?.kind??entry.report.activity).find(Boolean)??"unknown_activity";
        const objectiveHit=closestObjective(game,actors);
        const objective=objectiveHit&&objectiveHit.distance<=520?objectiveHit.objective:null;
        const actualOperation=representative?.operationId?game?.livingSandbox?.getOperation?.(representative.operationId):null;
        const inferredKind=dominant;
        const distressActors=actors.filter(actor=>actor.medical?.dead||actor.medical?.unconscious||["critical","serious","wounded"].includes(actor.medical?.condition)||Number(actor.aiV2Suppression??0)>24);
        const underFire=activities.includes("under_fire")||distressActors.some(actor=>Number(actor.aiV2Suppression??0)>24);
        const distress={
          active:Boolean(distressActors.length||underFire),
          casualtyCount:distressActors.filter(actor=>actor.medical?.dead||actor.medical?.unconscious||["critical","serious","wounded"].includes(actor.medical?.condition)).length,
          underFire,
          severity:distressActors.some(actor=>actor.medical?.dead||actor.medical?.condition==="critical")?"critical":distressActors.length?"serious":underFire?"under_fire":"none"
        };
        const centroid=actors.length?{x:actors.reduce((s,a)=>s+a.x,0)/actors.length,y:actors.reduce((s,a)=>s+a.y,0)/actors.length}:entries[0].report.approximatePosition;
        const record={
          observerTeamId,subjectTeamId,
          memberIds:actors.map(actor=>actor.id),
          factionId,
          factionLabel:factionId??"unknown faction",
          factionConfidence:factionId?clamp(confidence/100):0,
          relationship,
          identity:relationship==="same_faction"||relationship==="own_team"?"recognized_friendly_team":factionId?"recognized_field_team":"unknown_field_team",
          confidence,
          approximatePosition:centroid?{...centroid}:null,
          activities:[...new Set(activities)],
          operationHypothesis:{
            kind:inferredKind,
            operationId:actualOperation?.id??null,
            label:operationLabel(inferredKind),
            objectiveId:objective?.id??null,
            objectiveLabel:objective?.name??objective?.label??null,
            stage:representative?.currentAction??null,
            contested:Boolean(actualOperation?.contested),
            contestedRole:actualOperation?.contestedRole??null,
            primaryOperationId:actualOperation?.primaryOperationId??null,
            confidence:clamp((confidence/100)*.72+(objective? .18:0)+(dominant!=="unknown_activity"?.1:0))
          },
          distress,
          lastObservedAt:Math.max(...entries.map(entry=>entry.report.reportedAt??now)),
          updatedAt:now
        };
        record.protocol=this.#recommendProtocol({game,observer,record,relationships,now});
        next.set(subjectTeamId,record);
        const prior=this.byObserverTeam.get(observerTeamId)?.get(subjectTeamId)??null;
        if(!prior||prior.protocol!==record.protocol||prior.operationHypothesis.kind!==record.operationHypothesis.kind||prior.distress.active!==record.distress.active){
          this.decisionLog?.record?.({type:"team_contact_understanding_updated",time:now,teamId:observerTeamId,data:{subjectTeamId,factionId,relationship,operationKind:record.operationHypothesis.kind,objectiveId:record.operationHypothesis.objectiveId,distress:record.distress.severity,protocol:record.protocol,confidence:Math.round(confidence)}});
        }
      }
      this.byObserverTeam.set(observerTeamId,next);
    }
  }

  #recommendProtocol({game,observer,record,relationships,now}){
    if(record.relationship==="hostile")return"hostile_contact";
    if(record.distress.active)return record.relationship==="same_faction"?"casualty_aid":"consider_aid";
    const observerOperation=observer?.operationId?game?.livingSandbox?.getOperation?.(observer.operationId):null;
    const sameObjective=Boolean(observerOperation?.objectiveId&&observerOperation.objectiveId===record.operationHypothesis.objectiveId);
    const explicitContention=Boolean(
      observerOperation?.contested||record.operationHypothesis?.contested||
      observerOperation?.contestedByOperationId===record.operationHypothesis?.operationId||
      record.operationHypothesis?.primaryOperationId===observerOperation?.id
    );
    if(record.relationship==="same_faction")return sameObjective?"coordinate_locally":"pass_and_exchange";
    if(explicitContention)return"observe_and_identify";
    if(record.relationship==="cooperating")return sameObjective?"shared_security":"pass_through";
    if(record.relationship==="deconflicting")return"pass_through";
    if(sameObjective&&["service_infrastructure","recover_supplies","survey_route"].includes(record.operationHypothesis.kind))return"parallel_work_candidate";
    if(["traveling","returning"].includes(record.operationHypothesis.kind))return"pass_through";
    if(record.operationHypothesis.kind==="securing_area")return"area_secure_pass_around";
    return"observe_and_identify";
  }

  get(observerTeamId,subjectTeamId){return clone(this.byObserverTeam.get(observerTeamId)?.get(subjectTeamId)??null);}
  getBestForTeam(observerTeamId){return [...(this.byObserverTeam.get(observerTeamId)?.values()??[])].sort((a,b)=>(b.distress.active-a.distress.active)||b.confidence-a.confidence)[0]??null;}
  getAllForTeam(observerTeamId){return [...(this.byObserverTeam.get(observerTeamId)?.values()??[])].map(clone);}
  summary(){return [...this.byObserverTeam.entries()].map(([teamId,records])=>({teamId,contacts:[...records.values()].map(clone)}));}
}
