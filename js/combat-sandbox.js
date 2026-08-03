import { projectOutsideObstacles } from "./actor-motion.js";
import {
  BEHAVIOR_LAB_ACTOR_CATALOG,
  SANDBOX_FIXTURE_IDS,
  SANDBOX_FIXTURES,
  getSandboxFixture
} from "../data/behavior-lab-fixtures.js";
import { sandboxMap } from "../data/behavior-lab-map.js";

export { SANDBOX_FIXTURE_IDS, SANDBOX_FIXTURES, getSandboxFixture, sandboxMap };

const {
  factionNames:FACTION_NAMES,
  kits:KITS,
  defaultRoles:DEFAULT_ROLES,
  names:NAMES
}=BEHAVIOR_LAB_ACTOR_CATALOG;

function actorFromSpec(faction,teamId,index,spec,fixture){
 const id=`sandbox_${fixture.id}_${faction}_${index}`;
 const roles=DEFAULT_ROLES[faction];
 return {
  id,
  name:NAMES[faction][index%NAMES[faction].length],
  role:spec.role??roles[index%roles.length],
  type:"actor",
  teamId,
  factionId:faction,
  operationId:`behavior_lab_${fixture.id}`,
  kitId:KITS[faction][index%KITS[faction].length],
  x:spec.x,
  y:spec.y,
  width:44,
  height:70,
  groundY:spec.y+34,
  radius:18,
  vx:0,
  vy:0,
  moveSpeed:112+(index%3)*8,
  facing:spec.facing??"down",
  walkingPhase:0,
  backpackLoadRatio:.35,
  carriedItemInstanceId:null,
  routeIndex:0,
  waitTime:0,
  workPhase:0,
  motionState:"idle",
  currentTask:spec.task??"Holding the assigned test position",
  currentAction:"Waiting",
  workPose:null,
  workProp:null,
  interactionRadius:84,
  priority:18,
  relationship:"Unknown",
  greeting:[`${FACTION_NAMES[faction]} test team.`,fixture.question],
  seated:false,
  sandboxFixtureId:fixture.id,
  sandboxStatic:true,
  medicalPreset:spec.medicalPreset??null,
  squadMission:spec.mission??"hold_fixture",
  aiV2Assignment:spec.aiV2Assignment?{
   ...spec.aiV2Assignment,
   sector:{...spec.aiV2Assignment.sector},
   report:spec.aiV2Assignment.report?{...spec.aiV2Assignment.report}:null
  }:null,
  aiV2CasualtyAssignment:spec.aiV2CasualtyAssignment?{
   ...spec.aiV2CasualtyAssignment,
   report:spec.aiV2CasualtyAssignment.report?{...spec.aiV2CasualtyAssignment.report}:null
  }:null,
  aiV2MedicalSupplies:spec.aiV2MedicalSupplies?{...spec.aiV2MedicalSupplies}:null,
  aiV2Capabilities:spec.aiV2Capabilities?{...spec.aiV2Capabilities}:null,
  alertState:"unaware"
 };
}

export class CombatSandboxDirector{
 constructor(game,{fixtureId=SANDBOX_FIXTURE_IDS.OPEN_CONTACT}={}){
  this.game=game;
  this.started=true;
  this.elapsed=0;
  this.selectedOperationId=null;
  this.operations=[];
  this.teams=[];
  this.initialized=false;
  this.fixture=getSandboxFixture(fixtureId);
 }
 getOperation(){return null;}
 claim(){return false;}
 get selectedOperation(){return null;}
 summary(){return[];}
 start(){
  if(this.initialized)return;
  this.initialized=true;
  this.game.sandboxFixture=this.fixture;
  for(const [teamIndex,teamSpec] of this.fixture.teams.entries()){
   const teamId=`sandbox_team_${this.fixture.id}_${teamSpec.factionId}_${teamIndex}`;
   const members=[];
   for(const [actorIndex,spec] of teamSpec.actors.entries()){
    const actor=actorFromSpec(teamSpec.factionId,teamId,actorIndex,{
     ...spec,
     facing:spec.facing??teamSpec.facing,
     task:teamSpec.task,
     mission:teamSpec.mission
    },this.fixture);
    const clear=projectOutsideObstacles(this.game,actor.x,actor.y,actor.radius);
    actor.x=clear.x;actor.y=clear.y;actor.groundY=actor.y+34;
    this.game.actors.push(actor);
    members.push(actor.id);
    if(actor.medicalPreset==="critical")this.#seedCriticalCasualty(actor);
   }
   this.teams.push({
    id:teamId,
    factionId:teamSpec.factionId,
    memberIds:members,
    mission:teamSpec.mission,
    task:teamSpec.task,
    fixtureId:this.fixture.id,
    aiV2Mission:teamSpec.aiV2Mission?{
     ...teamSpec.aiV2Mission,
     concernArea:teamSpec.aiV2Mission.concernArea?{...teamSpec.aiV2Mission.concernArea}:null,
     interference:teamSpec.aiV2Mission.interference?{...teamSpec.aiV2Mission.interference}:null,
     boundary:teamSpec.aiV2Mission.boundary?{
      ...teamSpec.aiV2Mission.boundary,
      area:teamSpec.aiV2Mission.boundary.area?{...teamSpec.aiV2Mission.boundary.area}:null,
      allowedActivities:[...(teamSpec.aiV2Mission.boundary.allowedActivities??[])]
     }:null,
     withdrawalPlan:teamSpec.aiV2Mission.withdrawalPlan?{
      ...teamSpec.aiV2Mission.withdrawalPlan,
      exitPoint:teamSpec.aiV2Mission.withdrawalPlan.exitPoint?{...teamSpec.aiV2Mission.withdrawalPlan.exitPoint}:null,
      roleOffsets:Object.fromEntries(Object.entries(teamSpec.aiV2Mission.withdrawalPlan.roleOffsets??{}).map(([key,value])=>[key,{...value}]))
     }:null,
     recoveryPlan:teamSpec.aiV2Mission.recoveryPlan?{
      ...teamSpec.aiV2Mission.recoveryPlan,
      recoveryPoint:teamSpec.aiV2Mission.recoveryPlan.recoveryPoint?{...teamSpec.aiV2Mission.recoveryPlan.recoveryPoint}:null,
      securitySector:teamSpec.aiV2Mission.recoveryPlan.securitySector?{...teamSpec.aiV2Mission.recoveryPlan.securitySector}:null
     }:null,
     evacuationPlan:teamSpec.aiV2Mission.evacuationPlan?{
      ...teamSpec.aiV2Mission.evacuationPlan,
      routeOptions:(teamSpec.aiV2Mission.evacuationPlan.routeOptions??[]).map(route=>({...route,waypoints:(route.waypoints??[]).map(waypoint=>({...waypoint}))})),
      rearSecuritySector:teamSpec.aiV2Mission.evacuationPlan.rearSecuritySector?{...teamSpec.aiV2Mission.evacuationPlan.rearSecuritySector}:null
     }:null,
     decisionContext:teamSpec.aiV2Mission.decisionContext?{...teamSpec.aiV2Mission.decisionContext}:null,
     responsePolicy:teamSpec.aiV2Mission.responsePolicy?{...teamSpec.aiV2Mission.responsePolicy}:null,
     responseBias:teamSpec.aiV2Mission.responseBias?{...teamSpec.aiV2Mission.responseBias}:null
    }:null
   });
  }
  this.game.pushMessage(`${this.fixture.index} ${this.fixture.label} — ${this.fixture.question}`,4.8);
 }
 #seedCriticalCasualty(actor){
  const medical=this.game.wounds.ensure(actor);
  medical.blood=82;
  medical.shock=52;
  this.game.wounds.seedWound(actor,{region:"torso",severity:"catastrophic",controlled:false,label:`${this.fixture.id}_seeded_casualty`});
  actor.currentTask="Critical casualty awaiting recovery";
  actor.currentAction="Incapacitated";
 }
 update(delta){
  this.start();
  this.elapsed+=delta;
  // Intentional fixture rule: the director never invents patrol movement,
  // reinforcements, or random destinations. Legacy or V2 systems must make
  // every subsequent behavioral decision explicitly.
 }
}
