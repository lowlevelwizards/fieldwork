import { projectOutsideObstacles } from "./actor-motion.js";
import {
  BEHAVIOR_LAB_ACTOR_CATALOG,
  SANDBOX_FIXTURE_IDS as BASE_SANDBOX_FIXTURE_IDS,
  SANDBOX_FIXTURES as BASE_SANDBOX_FIXTURES,
  getSandboxFixture as getBaseSandboxFixture
} from "../data/behavior-lab-fixtures.js";
import { applyBehaviorLab2POverlay } from "../data/behavior-lab-2.0p.js";
import { applyBehaviorLab2QOverlay } from "../data/behavior-lab-2.0q.js";
import { OBJECTIVE_INITIATIVE_FIXTURE, OBJECTIVE_INITIATIVE_FIXTURE_ID } from "../data/behavior-lab-2.0r.js";
import { applyBehaviorLab2SOverlay } from "../data/behavior-lab-2.0s.js";
import { applyBehaviorLab2UOverlay } from "../data/behavior-lab-2.0u.js";
import { LivingSandboxState } from "./ai-v2/sandbox/living-sandbox-state.js";
import { sandboxMap } from "../data/behavior-lab-map.js";

export const SANDBOX_FIXTURE_IDS=Object.freeze({
 ...BASE_SANDBOX_FIXTURE_IDS,
 OBJECTIVE_INITIATIVE:OBJECTIVE_INITIATIVE_FIXTURE_ID
});
export { sandboxMap };

function applyCurrentOverlays(fixture){return applyBehaviorLab2QOverlay(applyBehaviorLab2POverlay(fixture));}
const CURRENT_OBJECTIVE_INITIATIVE_FIXTURE=applyBehaviorLab2UOverlay(applyBehaviorLab2SOverlay(OBJECTIVE_INITIATIVE_FIXTURE));

export const SANDBOX_FIXTURES=Object.freeze({
  ...Object.fromEntries(Object.entries(BASE_SANDBOX_FIXTURES).map(([id,fixture])=>[id,applyCurrentOverlays(fixture)])),
  [OBJECTIVE_INITIATIVE_FIXTURE_ID]:CURRENT_OBJECTIVE_INITIATIVE_FIXTURE
});

export function getSandboxFixture(id){
  if(id===OBJECTIVE_INITIATIVE_FIXTURE_ID)return CURRENT_OBJECTIVE_INITIATIVE_FIXTURE;
  return SANDBOX_FIXTURES[id]??applyCurrentOverlays(getBaseSandboxFixture(id));
}

const {
  factionNames:FACTION_NAMES,
  kits:KITS,
  defaultRoles:DEFAULT_ROLES,
  names:NAMES
}=BEHAVIOR_LAB_ACTOR_CATALOG;

function actorFromSpec(faction,teamId,index,spec,fixture){
 const id=spec.actorId??`sandbox_${fixture.id}_${faction}_${index}`;
 const roles=DEFAULT_ROLES[faction];
 return {
  id,
  name:spec.name??NAMES[faction][index%NAMES[faction].length],
  role:spec.role??roles[index%roles.length],
  type:"actor",
  teamId,
  factionId:faction,
  operationId:spec.operationId??`behavior_lab_${fixture.id}`,
  kitId:spec.kitId??KITS[faction][index%KITS[faction].length],
  x:spec.x,
  y:spec.y,
  width:44,
  height:70,
  groundY:spec.y+34,
  radius:18,
  vx:0,
  vy:0,
  moveSpeed:spec.moveSpeed??112+(index%3)*8,
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
  sandboxStatic:spec.sandboxStatic??true,
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

function objectiveFromSpec(spec){
 return{
  id:spec.id,
  type:"prop",
  propType:"field_relay",
  objectiveKind:spec.objectiveKind??"restore_relay",
  name:spec.name??"Field Objective",
  x:spec.x,
  y:spec.y,
  width:spec.width??66,
  height:spec.height??90,
  groundY:spec.y+(spec.height??90),
  interactionRadius:spec.interactionRadius??82,
  securityRadius:spec.securityRadius??280,
  collision:spec.collision!==false,
  priority:44,
  revealed:true,
  aiObjective:true,
  state:spec.state??"offline",
  progress:spec.progress??0,
  objectiveRequirements:{...(spec.requirements??{})},
  sandboxNeed:spec.sandboxNeed?{
   ...spec.sandboxNeed,
   capabilityNeeds:{...(spec.sandboxNeed.capabilityNeeds??{})}
  }:null,
  completedByTeamId:null,
  lastChangedAt:0
 };
}

function cloneMission(teamSpec){
 return teamSpec.aiV2Mission?{
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
  defensivePlan:teamSpec.aiV2Mission.defensivePlan?{...teamSpec.aiV2Mission.defensivePlan}:null,
  objectivePlan:teamSpec.aiV2Mission.objectivePlan?{
   ...teamSpec.aiV2Mission.objectivePlan,
   approachPolicy:teamSpec.aiV2Mission.objectivePlan.approachPolicy?{...teamSpec.aiV2Mission.objectivePlan.approachPolicy}:null
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
  contactPolicy:teamSpec.aiV2Mission.contactPolicy?{...teamSpec.aiV2Mission.contactPolicy,report:{...(teamSpec.aiV2Mission.contactPolicy.report??{})}}:null,
  responsePolicy:teamSpec.aiV2Mission.responsePolicy?{...teamSpec.aiV2Mission.responsePolicy}:null,
  responseBias:teamSpec.aiV2Mission.responseBias?{...teamSpec.aiV2Mission.responseBias}:null
 }:null;
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
  this.stimulusEmitted=false;
  this.processedLivingOutcomeIds=new Set();
  this.fixture=getSandboxFixture(fixtureId);
  this.livingState=this.fixture.livingSandbox?new LivingSandboxState({config:this.fixture.livingSandbox}):null;
 }
 getOperation(id){return this.livingState?.getOperation(id)??null;}
 claim(){return false;}
 get selectedOperation(){return null;}
 summary(){
  if(!this.livingState)return[];
  return this.livingState.summary().operations.map(operation=>({
   id:operation.id,
   factionId:operation.factionId,
   title:operation.label,
   summary:`${operation.factionLabel} operation for ${operation.objectiveLabel}.`,
   status:operation.status,
   current:operation.status==="returning"?"Returning from the completed worksite":operation.status==="completed"?"Returned and recovering":"AI V2 mission active",
   playerEligible:false,
   claimed:false
  }));
 }
 start(){
  if(this.initialized)return;
  this.initialized=true;
  this.game.sandboxFixture=this.fixture;
  if(this.livingState){
   this.livingState.decisionLog=this.game.aiV2?.decisionLog??null;
   this.game.livingSandbox=this.livingState;
  }
  for(const spec of this.fixture.objectives??[]){
   if(!this.game.entities.some(entity=>entity.id===spec.id))this.game.entities.push(objectiveFromSpec(spec));
  }
  for(const [teamIndex,teamSpec] of this.fixture.teams.entries())this.#spawnAuthoredTeam(teamSpec,teamIndex);
  this.game.pushMessage(`${this.fixture.index} ${this.fixture.label} — ${this.fixture.question}`,4.8);
 }
 #spawnAuthoredTeam(teamSpec,teamIndex){
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
   aiV2Mission:cloneMission(teamSpec)
  });
 }
 #compileLivingMission(operation,objective){
  const exit=operation.entryPoint;
  const worksiteBoundary=objective.sandboxNeed?.worksiteBoundary??null;
  return{
   id:operation.id,
   problemKind:"baseline_objective",
   title:operation.label,
   objective:`Restore ${objective.name??operation.objectiveLabel} because the current world state requires functioning route infrastructure.`,
   immediateTask:`Approach, inspect, restore, and secure ${objective.name??operation.objectiveLabel}.`,
   successCondition:`${objective.name??operation.objectiveLabel} is operational and the team can return to faction availability.`,
   abortCondition:"No capable technical specialist or physically usable approach remains.",
   concernArea:{type:"circle",label:`${objective.name??operation.objectiveLabel} worksite`,x:objective.x,y:objective.y,radius:560,falloff:240},
   interference:worksiteBoundary?{
    kind:"active_worksite_intrusion",
    label:"Approach conflicts with active technical work",
    reason:`An unknown armed contact is moving inside ${worksiteBoundary.label??"the active worksite"}; the approach may interfere with the operation.`
   }:null,
   boundary:worksiteBoundary?{
    ...worksiteBoundary,
    area:{type:"circle",label:worksiteBoundary.label??`${objective.name??operation.objectiveLabel} worksite`,x:objective.x,y:objective.y,radius:worksiteBoundary.radius??460,falloff:worksiteBoundary.falloff??180},
    allowedActivities:[...(worksiteBoundary.allowedActivities??["approaching","repositioning","observing"])]
   }:null,
   objectivePlan:{
    id:`${operation.id}_objective_plan`,
    objectiveId:objective.id,
    desiredState:operation.desiredState,
    securityFocusDistance:330,
    approachPolicy:{maximumTravel:1500,stagingDistance:250,interactionDistance:68,roleSpacing:108,speedMultiplier:.74,arrivalRadius:11,claimSpacing:72}
   },
   withdrawalPlan:{
    id:`${operation.id}_return_route`,
    label:`${operation.factionLabel} entry route`,
    exitPoint:{x:exit.x,y:exit.y},
    roleOffsets:{lead:{x:-70,y:0},middle:{x:0,y:0},rear:{x:70,y:0}},
    speedMultiplier:.68,
    arrivalRadius:14,
    claimSpacing:70
   },
   decisionContext:{
    missionValue:.92,
    teamPreservation:.82,
    informationNeed:.5,
    positionSecurity:.6,
    concealmentValue:.2,
    detectionRisk:.14,
    timePressure:.52+operation.urgency*.2,
    resourceConservation:.84,
    exitOptions:.78,
    enemyDisruption:.08,
    securityOrientation:.72,
    stealthOrientation:.28,
    mobilityOrientation:.76,
    careOrientation:.52,
    positionLabel:`${objective.name??operation.objectiveLabel} worksite`,
    exitLabel:`${operation.factionLabel} entry route`
   },
   contactPolicy:{passiveVision:true,maximumRange:820,fieldOfViewDegrees:118,report:{method:"local_voice",range:620,minimumConfidence:22,reason:"Share credible ambient contact and meaningful activity while the operation continues"}},
   responsePolicy:{minimumHold:2.4,reassessEvery:.85,switchMargin:.06},
   responseBias:worksiteBoundary
    ?{warn:.3,monitor_departure:.16,heighten_watch:-.08,continue_observation:-.04,withdraw_silently:.2}
    :{heighten_watch:.12,continue_observation:.02,withdraw_silently:.24}
  };
 }
 #deployLivingOperation(operation){
  const objective=this.game.entities.find(entity=>entity.id===operation.objectiveId);
  const faction=this.livingState?.getFaction(operation.factionId);
  if(!objective||!faction)return false;
  const teamId=`living_team_${operation.id}`;
  const rosterById=new Map(faction.roster.map(member=>[member.id,member]));
  const actorIds=[];
  const offsets=[-82,0,82];
  for(const [index,rosterId] of operation.rosterIds.entries()){
   const member=rosterById.get(rosterId);
   if(!member)continue;
   const actor=actorFromSpec(operation.factionId,teamId,index,{
    actorId:`living_actor_${operation.id}_${rosterId}`,
    name:member.name,
    role:member.role,
    kitId:member.kitId,
    operationId:operation.id,
    x:operation.entryPoint.x+offsets[index%offsets.length],
    y:operation.entryPoint.y+Math.abs(offsets[index%offsets.length])*.12,
    facing:operation.entryPoint.facing,
    task:`Deploying for ${operation.label}`,
    mission:operation.label,
    sandboxStatic:false,
    aiV2Capabilities:{...member.capabilities}
   },this.fixture);
   const clear=projectOutsideObstacles(this.game,actor.x,actor.y,actor.radius);
   actor.x=clear.x;actor.y=clear.y;actor.groundY=actor.y+34;
   this.game.actors.push(actor);
   actorIds.push(actor.id);
  }
  if(actorIds.length!==operation.rosterIds.length)return false;
  this.teams.push({
   id:teamId,
   factionId:operation.factionId,
   memberIds:actorIds,
   mission:operation.label,
   task:`Restore ${objective.name??operation.objectiveLabel}`,
   fixtureId:this.fixture.id,
   operationId:operation.id,
   operationStatus:"deployed",
   aiV2Mission:this.#compileLivingMission(operation,objective)
  });
  this.livingState.markDeployed({operationId:operation.id,teamId,actorIds,now:this.elapsed});
  this.game.pushMessage(`${operation.factionLabel} dispatches a team: ${operation.label}`,3.2);
  return true;
 }
 #consumeLivingOperationOutcomes(){
  for(const operation of this.livingState?.activeOperations?.()??[]){
   if(operation.status!=="deployed"||!operation.teamId)continue;
   const outcome=this.game.aiV2?.encounterOutcomes?.getLatest?.(operation.teamId)??null;
   if(!outcome?.id||this.processedLivingOutcomeIds.has(outcome.id)||outcome.kind!=="withdrew_without_reply")continue;
   const blocker=(this.livingState?.activeOperations?.()??[]).find(candidate=>candidate.teamId===outcome.counterpartTeamId)??null;
   if(!this.livingState?.interruptOperation?.(operation.id,{
    now:this.elapsed,
    reason:"withdrew_after_worksite_warning",
    blockingOperationId:blocker?.id??null,
    outcomeId:outcome.id
   }))continue;
   this.processedLivingOutcomeIds.add(outcome.id);
   const team=this.teams.find(candidate=>candidate.id===operation.teamId);
   if(team)team.operationStatus="interrupted";
   for(const actorId of operation.actorIds){
    const actor=this.game.actors.find(candidate=>candidate.id===actorId);
    if(!actor)continue;
    actor.currentTask="Returning after the operation was deferred";
    actor.currentAction="Withdrawal complete; preparing to leave the active world";
   }
   this.game.pushMessage(`${operation.factionLabel} defers ${operation.objectiveLabel} after withdrawing from the active worksite.`,3.2);
  }
 }
 #beginLivingReturn(operation){
  if(!this.livingState?.beginReturn(operation.id,{now:this.elapsed}))return;
  const team=this.teams.find(candidate=>candidate.id===operation.teamId);
  if(team)team.operationStatus="returning";
  for(const actorId of operation.actorIds){
   const actor=this.game.actors.find(candidate=>candidate.id===actorId);
   if(!actor)continue;
   actor.currentTask="Packing the completed worksite for return";
   actor.currentAction="Holding before abstract return";
  }
  this.game.pushMessage(`${operation.factionLabel} completed ${operation.objectiveLabel} and is preparing to return.`,3);
 }
 #completeLivingReturn(operation){
  const interrupted=operation.status==="interrupted";
  for(const actorId of operation.actorIds)this.game.aiV2?.scheduler?.cancelActor?.(actorId,{now:this.elapsed,reason:interrupted?"operation_deferred":"operation_returned"});
  const actorSet=new Set(operation.actorIds);
  this.game.actors=this.game.actors.filter(actor=>!actorSet.has(actor.id));
  this.teams=this.teams.filter(team=>team.id!==operation.teamId);
  this.livingState?.completeReturn(operation.id,{now:this.elapsed});
  this.game.pushMessage(interrupted
   ?`${operation.factionLabel} team returned with the operation deferred for retry.`
   :`${operation.factionLabel} team returned; its operators are recovering.`,3);
 }
 #updateLivingSandbox(){
  if(!this.livingState||this.game.aiRuntimeMode!=="v2")return;
  const objectives=this.game.entities.filter(entity=>entity.aiObjective);
  this.livingState.decisionLog??=this.game.aiV2?.decisionLog??null;
  this.livingState.updateRecovery({now:this.elapsed});
  this.livingState.syncObjectives(objectives,{now:this.elapsed});
  this.#consumeLivingOperationOutcomes();

  for(const operation of this.livingState.activeOperations()){
   if(operation.status!=="deployed")continue;
   const objective=objectives.find(candidate=>candidate.id===operation.objectiveId);
   if(objective?.state===operation.desiredState)this.#beginLivingReturn(operation);
  }
  for(const operation of this.livingState.readyReturns({now:this.elapsed}))this.#completeLivingReturn(operation);

  const proposal=this.livingState.proposeDispatch({objectives,now:this.elapsed});
  if(proposal&&!this.#deployLivingOperation(proposal)){
   this.game.pushMessage(`Unable to assemble ${proposal.factionLabel} operation.`,2.4);
  }
 }
 #seedCriticalCasualty(actor){
  const medical=this.game.wounds.ensure(actor);
  medical.blood=82;
  medical.shock=52;
  this.game.wounds.seedWound(actor,{region:"torso",severity:"catastrophic",controlled:false,label:`${this.fixture.id}_seeded_casualty`});
  actor.currentTask="Critical casualty awaiting recovery";
  actor.currentAction="Incapacitated";
 }
 #emitHostileStimulus(){
  const stimulus=this.fixture.hostileStimulus;
  if(!stimulus||this.stimulusEmitted||this.game.aiRuntimeMode!=="v2"||this.elapsed<(stimulus.delay??0))return;
  const source=this.game.actors.find(actor=>actor.factionId===stimulus.sourceFactionId&&actor.role===stimulus.sourceRole);
  const target=this.game.actors.find(actor=>actor.factionId===stimulus.targetFactionId&&actor.role===stimulus.targetRole);
  if(!source||!target)return;
  this.stimulusEmitted=true;
  const impactOffset=stimulus.impactOffset??{x:34,y:12};
  const sourcePoint={x:source.x,y:source.y};
  const impactPoint={x:target.x+(impactOffset.x??0),y:target.y+(impactOffset.y??0)};
  this.game.aiV2ThreatEvents??=[];
  this.game.aiV2ThreatEvents.push({
   id:stimulus.id,
   kind:stimulus.kind??"near_miss",
   targetActorId:target.id,
   sourcePoint,
   impactPoint,
   confidence:stimulus.confidence??92,
   immediateDuration:stimulus.immediateDuration??3.2,
   emittedAt:this.elapsed
  });
  source.magazineSize??=20;
  source.ammoInMagazine??=source.magazineSize;
  source.ammoInMagazine=Math.max(0,source.ammoInMagazine-1);
  source.currentAction="Fired one controlled hostile round";
  target.currentAction="Round passed close";
  const angle=Math.atan2(impactPoint.y-sourcePoint.y,impactPoint.x-sourcePoint.x);
  this.game.combat?.effects?.push?.({type:"muzzle",x:sourcePoint.x,y:sourcePoint.y,angle,life:.085,maxLife:.085,source:"behavior_lab"});
  this.game.combat?.effects?.push?.({type:"tracer",x1:sourcePoint.x,y1:sourcePoint.y,x2:impactPoint.x,y2:impactPoint.y,life:.16,maxLife:.16,source:"behavior_lab"});
  this.game.combat?.decals?.push?.({type:"impact",x:impactPoint.x,y:impactPoint.y,angle,life:28,maxLife:28});
  this.game.pushMessage("A controlled round cracks through the open lane.",2.4);
 }
 update(delta){
  this.start();
  this.elapsed+=delta;
  if(this.livingState)this.#updateLivingSandbox();
  else this.#emitHostileStimulus();
  // Fixtures author world facts and controlled stimuli. AI V2 owns mission
  // initiative, role assignment, movement, work, and tactical reactions.
  // The living sandbox additionally owns strategic need recognition,
  // faction dispatch, abstract return, roster recovery, and operation history.
 }
}
