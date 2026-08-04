const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const clone=item=>item?{...item,subjectPosition:item.subjectPosition?{...item.subjectPosition}:null,objectivePoint:item.objectivePoint?{...item.objectivePoint}:null}:null;

export class TeamInteractionRuntime{
  constructor({decisionLog=null}={}){this.decisionLog=decisionLog;this.byTeam=new Map();}

  update({game,understanding,relationships,teamMissions,now=0}={}){
    const next=new Map();
    for(const team of [...new Set((game?.actors??[]).map(actor=>actor.teamId).filter(Boolean))].map(id=>({id}))){
      const records=understanding?.getAllForTeam?.(team.id)??[];
      const mission=teamMissions?.get?.(team.id)??null;
      const actor=(game?.actors??[]).find(candidate=>candidate.teamId===team.id)??null;
      if(!actor)continue;
      const items=[];
      for(const record of records){
        if(!record.subjectTeamId||record.relationship==="hostile"||record.protocol==="hostile_contact")continue;
        const subjectActors=(game?.actors??[]).filter(candidate=>candidate.teamId===record.subjectTeamId&&!candidate.medical?.dead);
        if(!subjectActors.length)continue;
        const subjectPosition={x:subjectActors.reduce((sum,item)=>sum+item.x,0)/subjectActors.length,y:subjectActors.reduce((sum,item)=>sum+item.y,0)/subjectActors.length};
        const ownOperation=actor.operationId?game?.livingSandbox?.getOperation?.(actor.operationId):null;
        const subjectOperation=subjectActors[0].operationId?game?.livingSandbox?.getOperation?.(subjectActors[0].operationId):null;
        const sameObjective=Boolean(ownOperation?.objectiveId&&ownOperation.objectiveId===subjectOperation?.objectiveId);
        const subjectObjectiveId=record.operationHypothesis?.objectiveId??subjectOperation?.objectiveId??null;
        const subjectObjective=(game?.objectives??[]).find(objective=>objective.id===subjectObjectiveId)??null;
        const subjectDoingService=record.operationHypothesis?.kind==="service_infrastructure";
        const nearActiveWork=Boolean(subjectDoingService&&subjectObjective&&distance(actor,subjectPosition)<420&&!subjectOperation?.contested&&!ownOperation?.contested);
        const missionPressure=Number(mission?.decisionContext?.timePressure??.4);
        let type=null,duration=12,reason="";
        if(record.relationship==="same_faction"){
          type=record.distress.active?"casualty_aid":sameObjective||nearActiveWork?"shared_security":"pass_through";
          duration=record.distress.active?18:sameObjective||nearActiveWork?12:14;
          reason=record.distress.active?"A recognized same-faction team is in distress and can receive bounded local aid.":sameObjective||nearActiveWork?"Recognized same-faction teams can divide worksite security and contribute spare capacity without challenging one another.":"Recognized same-faction teams exchange movement intent and deconflict their routes.";
        }else if(record.protocol==="parallel_work_candidate"&&sameObjective){
          type="parallel_work";duration=11;reason="Both recognized teams appear to be conducting compatible work at the same objective.";
        }else if(nearActiveWork&&record.factionConfidence>=.55&&missionPressure<.66){
          type="parallel_work";duration=9;reason="A recognized non-hostile team is visibly servicing nearby infrastructure; spare local capacity can assist briefly while both missions remain separate.";
        }else if(record.protocol==="consider_aid"&&record.distress.active){
          const bestMedic=Math.max(...(game.actors??[]).filter(candidate=>candidate.teamId===team.id).map(candidate=>Number(candidate.aiV2Capabilities?.medicalCare??candidate.aiV2Capabilities?.medical??0)),0);
          if(bestMedic>.72&&missionPressure<.72){type="casualty_aid";duration=14;reason="A capable nearby team can provide limited lifesaving aid without taking ownership of the other operation.";}
        }else if(["pass_through","area_secure_pass_around"].includes(record.protocol)){
          type="pass_through";duration=9;reason="The teams recognize compatible movement and can pass without treating one another as a worksite threat.";
        }
        if(!type)continue;
        const contract=relationships.establishContract({teamAId:team.id,teamBId:record.subjectTeamId,type,objectiveIds:[ownOperation?.objectiveId,subjectOperation?.objectiveId],now,duration,reason});
        if(!contract)continue;
        items.push({
          teamId:team.id,subjectTeamId:record.subjectTeamId,type,reason,contractId:contract.id,
          relationship:record.relationship,protocol:record.protocol,
          subjectPosition,
          objectiveId:(sameObjective?ownOperation?.objectiveId:subjectObjectiveId)??null,
          objectivePoint:subjectObjective?{x:subjectObjective.x,y:subjectObjective.y}:sameObjective&&ownOperation?.objectivePoint?{...ownOperation.objectivePoint}:null,
          distress:{...record.distress},
          expiresAt:contract.expiresAt,
          distance:distance(actor,subjectPosition)
        });
      }
      if(items.length)next.set(team.id,items.sort((a,b)=>(b.distress.active-a.distress.active)||a.distance-b.distance));
    }
    this.byTeam=next;
  }

  getForTeam(teamId){return (this.byTeam.get(teamId)??[]).map(clone);}
  getBestForTeam(teamId){return clone(this.byTeam.get(teamId)?.[0]??null);}
  summary(){return [...this.byTeam.entries()].map(([teamId,interactions])=>({teamId,interactions:interactions.map(clone)}));}
}
