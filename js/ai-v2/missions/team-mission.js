const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function cloneArea(area){
  if(!area)return null;
  return{
    type:area.type??"circle",
    label:area.label??"mission concern area",
    x:finite(area.x,0),
    y:finite(area.y,0),
    radius:Math.max(1,finite(area.radius,1)),
    falloff:Math.max(1,finite(area.falloff,Math.max(120,finite(area.radius,1)*.55)))
  };
}

function normalizeMission(team){
  const authored=team?.aiV2Mission;
  if(!team?.id||!authored)return null;
  return{
    id:authored.id??`v2_mission_${team.id}`,
    teamId:team.id,
    factionId:team.factionId??null,
    title:authored.title??team.mission??"Authored team mission",
    objective:authored.objective??team.mission??"Complete the assigned mission",
    immediateTask:authored.immediateTask??team.task??null,
    successCondition:authored.successCondition??null,
    abortCondition:authored.abortCondition??null,
    concernArea:cloneArea(authored.concernArea),
    missionSensitivity:clamp(authored.missionSensitivity??.75,0,1),
    minimumRelevantConfidence:clamp(authored.minimumRelevantConfidence??8,0,100),
    incompatibleConfidence:clamp(authored.incompatibleConfidence??18,0,100),
    staleAfter:Math.max(1,authored.staleAfter??18),
    forgetAfter:Math.max(2,authored.forgetAfter??38),
    interference:authored.interference?{
      kind:authored.interference.kind??"possible_interference",
      label:authored.interference.label??"Possible mission interference",
      reason:authored.interference.reason??"The reported contact may interfere with the assigned mission."
    }:null
  };
}

export class TeamMissionStore{
  constructor(){
    this.byTeam=new Map();
  }

  syncFromGame(game){
    const teams=game?.operations?.teams??[];
    for(const team of teams){
      const mission=normalizeMission(team);
      if(mission)this.byTeam.set(team.id,mission);
    }
  }

  get(teamId){
    return this.byTeam.get(teamId)??null;
  }

  has(teamId){
    return this.byTeam.has(teamId);
  }

  summary(){
    return [...this.byTeam.values()].map(mission=>({
      ...mission,
      concernArea:mission.concernArea?{...mission.concernArea}:null,
      interference:mission.interference?{...mission.interference}:null
    }));
  }
}
