const cloneContract=contract=>contract?{...contract,teamIds:[...(contract.teamIds??[])],objectiveIds:[...(contract.objectiveIds??[])]}:null;
const pairKey=(a,b)=>[String(a??""),String(b??"")].sort().join("::");

export const TEAM_RELATIONSHIPS=Object.freeze({
  OWN_TEAM:"own_team",
  SAME_FACTION:"same_faction",
  COOPERATING:"cooperating",
  DECONFLICTING:"deconflicting",
  NEUTRAL:"neutral",
  UNKNOWN:"unknown",
  HOSTILE:"hostile"
});

export class TeamRelationshipService{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.contracts=new Map();
  }

  update({game,now=0}={}){
    const liveTeams=new Set((game?.actors??[]).map(actor=>actor.teamId).filter(Boolean));
    for(const [key,contract] of [...this.contracts]){
      if(contract.expiresAt<=now||contract.teamIds.some(teamId=>!liveTeams.has(teamId))){
        this.contracts.delete(key);
        this.decisionLog?.record?.({type:"team_interaction_contract_ended",time:now,data:{contractId:contract.id,type:contract.type,teamIds:[...contract.teamIds],reason:contract.expiresAt<=now?"expired":"team_unavailable"}});
      }
    }
  }

  relationshipBetweenActors(left,right,{now=0}={}){
    if(!left||!right)return TEAM_RELATIONSHIPS.UNKNOWN;
    if(left.teamId&&left.teamId===right.teamId)return TEAM_RELATIONSHIPS.OWN_TEAM;
    if(left.factionId&&left.factionId===right.factionId)return TEAM_RELATIONSHIPS.SAME_FACTION;
    const contract=this.getContract(left.teamId,right.teamId,{now});
    if(contract?.type==="cooperate"||contract?.type==="shared_security"||contract?.type==="casualty_aid")return TEAM_RELATIONSHIPS.COOPERATING;
    if(contract?.type==="pass_through"||contract?.type==="parallel_work"||contract?.type==="yield_access")return TEAM_RELATIONSHIPS.DECONFLICTING;
    const hostile=Boolean(
      left.aiV2ThreatenedByTeamId===right.teamId||right.aiV2ThreatenedByTeamId===left.teamId||
      left.aiV2EncounterDisposition?.[right.teamId]==="hostile"||right.aiV2EncounterDisposition?.[left.teamId]==="hostile"
    );
    return hostile?TEAM_RELATIONSHIPS.HOSTILE:TEAM_RELATIONSHIPS.NEUTRAL;
  }

  relationshipBetweenTeams(game,leftTeamId,rightTeamId,{now=0}={}){
    if(!leftTeamId||!rightTeamId)return TEAM_RELATIONSHIPS.UNKNOWN;
    if(leftTeamId===rightTeamId)return TEAM_RELATIONSHIPS.OWN_TEAM;
    const left=(game?.actors??[]).find(actor=>actor.teamId===leftTeamId);
    const right=(game?.actors??[]).find(actor=>actor.teamId===rightTeamId);
    return this.relationshipBetweenActors(left,right,{now});
  }

  isProtectedFriendly(left,right,{now=0}={}){
    return [TEAM_RELATIONSHIPS.OWN_TEAM,TEAM_RELATIONSHIPS.SAME_FACTION,TEAM_RELATIONSHIPS.COOPERATING,TEAM_RELATIONSHIPS.DECONFLICTING]
      .includes(this.relationshipBetweenActors(left,right,{now}));
  }

  canWarn(left,right,{now=0}={}){
    return !this.isProtectedFriendly(left,right,{now});
  }

  establishContract({teamAId,teamBId,type="pass_through",objectiveIds=[],now=0,duration=12,reason="local field understanding"}={}){
    if(!teamAId||!teamBId||teamAId===teamBId)return null;
    const key=pairKey(teamAId,teamBId);
    const prior=this.contracts.get(key)??null;
    const contract={
      id:prior?.id??`team_contract_${key.replaceAll(":","_")}`,
      teamIds:[teamAId,teamBId].sort(),
      type,
      objectiveIds:[...new Set(objectiveIds.filter(Boolean))],
      establishedAt:prior?.establishedAt??now,
      updatedAt:now,
      expiresAt:Math.max(prior?.expiresAt??0,now+Math.max(.5,duration)),
      reason
    };
    this.contracts.set(key,contract);
    if(!prior||prior.type!==contract.type)this.decisionLog?.record?.({type:"team_interaction_contract_established",time:now,data:{contractId:contract.id,type:contract.type,teamIds:[...contract.teamIds],objectiveIds:[...contract.objectiveIds],reason}});
    return cloneContract(contract);
  }

  endContract(teamAId,teamBId,{now=0,reason="ended"}={}){
    const key=pairKey(teamAId,teamBId);
    const contract=this.contracts.get(key);
    if(!contract)return false;
    this.contracts.delete(key);
    this.decisionLog?.record?.({type:"team_interaction_contract_ended",time:now,data:{contractId:contract.id,type:contract.type,teamIds:[...contract.teamIds],reason}});
    return true;
  }

  getContract(teamAId,teamBId,{now=0}={}){
    const contract=this.contracts.get(pairKey(teamAId,teamBId))??null;
    if(!contract||contract.expiresAt<=now)return null;
    return cloneContract(contract);
  }

  getContractsForTeam(teamId,{now=0}={}){
    return [...this.contracts.values()].filter(contract=>contract.expiresAt>now&&contract.teamIds.includes(teamId)).map(cloneContract);
  }

  summary({now=0}={}){
    return [...this.contracts.values()].filter(contract=>contract.expiresAt>now).map(cloneContract);
  }
}
