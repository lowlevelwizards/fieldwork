import { isAlive, isCombatCapable, canReceiveOrders } from "./actor-state.js?v=12d-team-context-cover-network-20260801";

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function center(actors){
  const active=actors.filter(isAlive);
  const count=Math.max(1,active.length);
  return {
    x:active.reduce((sum,actor)=>sum+actor.x,0)/count,
    y:active.reduce((sum,actor)=>sum+actor.y,0)/count
  };
}

export class TeamCombatContextSystem{
  constructor(game){
    this.game=game;
    this.contexts=new Map();
  }

  teamActors(teamId){
    return this.game.actors.filter(actor=>(actor.teamId??actor.factionId)===teamId&&isAlive(actor));
  }

  groups(){
    const groups=new Map();
    for(const actor of this.game.actors){
      if(!actor.factionId||!actor.operationId||!isAlive(actor))continue;
      const teamId=actor.teamId??actor.factionId;
      if(!groups.has(teamId))groups.set(teamId,{id:teamId,factionId:actor.factionId,actors:[]});
      groups.get(teamId).actors.push(actor);
    }
    return groups;
  }

  encounterForTeams(teamId,enemyTeamId){
    for(const encounter of this.game.encounters?.encounters?.values?.()??[]){
      const matches=(encounter.teamAId===teamId&&encounter.teamBId===enemyTeamId)||
        (encounter.teamBId===teamId&&encounter.teamAId===enemyTeamId);
      if(matches)return encounter;
    }
    return null;
  }

  planFor(encounter,teamId){
    if(!encounter)return 'hold';
    return encounter.teamAId===teamId?(encounter.planA??'hold'):(encounter.planB??'hold');
  }

  contactScore(group,enemy,encounter,previousPrimary){
    const ownCenter=center(group.actors),enemyCenter=center(enemy.actors);
    const d=distance(ownCenter,enemyCenter);
    const capable=enemy.actors.filter(isCombatCapable).length;
    const engaged=encounter?.combatEngaged?240:0;
    const contact=encounter?.state==='contact'?115:encounter?.state==='alerted'?55:0;
    const recentViolence=performance.now()/1000-(encounter?.violenceAt??-999)<18?110:0;
    const incoming=group.actors.some(actor=>performance.now()/1000-(actor.lastIncomingFireAt??-999)<5)?80:0;
    const persistence=previousPrimary===enemy.id?95:0;
    return engaged+contact+recentViolence+incoming+persistence+capable*18-Math.min(180,d*.16);
  }

  update(){
    const now=performance.now()/1000;
    const groups=this.groups();
    for(const group of groups.values()){
      let context=this.contexts.get(group.id);
      if(!context){
        context={
          teamId:group.id,factionId:group.factionId,
          alertState:'unaware',primaryThreatTeamId:null,
          primaryThreatPosition:null,secondaryThreats:[],
          currentPlan:'hold',planStartedAt:now,
          encounterId:null,updatedAt:now
        };
        this.contexts.set(group.id,context);
      }

      const contacts=[];
      for(const enemy of groups.values()){
        if(enemy.id===group.id||enemy.factionId===group.factionId)continue;
        const encounter=this.encounterForTeams(group.id,enemy.id);
        if(!encounter||['unaware','disengaging'].includes(encounter.state))continue;
        const score=this.contactScore(group,enemy,encounter,context.primaryThreatTeamId);
        contacts.push({enemy,encounter,score,position:center(enemy.actors)});
      }
      contacts.sort((a,b)=>b.score-a.score);
      const primary=contacts[0]??null;

      if(!primary){
        if(context.primaryThreatTeamId&&now-context.updatedAt<8)continue;
        context.alertState='unaware';
        context.primaryThreatTeamId=null;
        context.primaryThreatPosition=null;
        context.secondaryThreats=[];
        context.encounterId=null;
        for(const actor of group.actors){
          actor.teamCombatContext=context;
          actor.primaryThreatTeamId=null;
        }
        continue;
      }

      const newPlan=this.planFor(primary.encounter,group.id);
      if(newPlan!==context.currentPlan){
        context.currentPlan=newPlan;
        context.planStartedAt=now;
      }
      context.alertState=primary.encounter.combatEngaged?'engaged':primary.encounter.state==='contact'?'contact':'alerted';
      context.primaryThreatTeamId=primary.enemy.id;
      context.primaryThreatPosition={...primary.position};
      context.secondaryThreats=contacts.slice(1,3).map(item=>({
        teamId:item.enemy.id,position:{...item.position},score:item.score
      }));
      context.encounterId=primary.encounter.id;
      context.updatedAt=now;

      // Pairwise encounters remain evidence. This is the only layer that
      // writes the team's final threat, plan, and tactical front.
      const primaryGroup={id:primary.enemy.id,factionId:primary.enemy.factionId,actors:primary.enemy.actors};
      const ownGroup={id:group.id,factionId:group.factionId,actors:group.actors};
      const front=this.game.tacticalFronts?.assign?.(primary.encounter,ownGroup,primaryGroup,newPlan);

      for(const actor of group.actors.filter(canReceiveOrders)){
        actor.teamCombatContext=context;
        actor.primaryThreatTeamId=context.primaryThreatTeamId;
        actor.tacticalEnemyCenter={...context.primaryThreatPosition};
        actor.tacticalSecondaryThreats=context.secondaryThreats.map(item=>({...item,position:{...item.position}}));
        actor.tacticalPlan=context.currentPlan;
        actor.tacticalPlanUntil=now+24;
        actor.alertState=context.alertState;
        actor.encounterId=context.encounterId;
      }
    }
  }

  get(teamId){return this.contexts.get(teamId)??null;}
  forActor(actor){return actor?this.get(actor.teamId??actor.factionId):null;}
  primaryThreatActors(actor){
    const context=this.forActor(actor);
    return context?.primaryThreatTeamId?this.teamActors(context.primaryThreatTeamId):[];
  }
}
