import test from "node:test";
import assert from "node:assert/strict";
import { AmbientPerceptionRuntime } from "../js/ai-v2/senses/ambient-perception-runtime.js";
import { ActorTacticalPictureService } from "../js/ai-v2/actors/actor-tactical-picture-service.js";
import { ActorObligationStore } from "../js/ai-v2/actors/actor-obligation-store.js";
import { ActorTacticalCommitmentStore } from "../js/ai-v2/actors/actor-tactical-commitment-store.js";
import { ConcernFulfillmentRuntime } from "../js/ai-v2/actors/concern-fulfillment-runtime.js";
import { SelfAidAction } from "../js/ai-v2/actions/self-aid-action.js";
import { CircumventContactAction } from "../js/ai-v2/actions/circumvent-contact-action.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { AIV2Action } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";
import { ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";
import { BehavioralTruthMonitor } from "../js/ai-v2/diagnostics/behavioral-truth-monitor.js";

function actor(id,{teamId="team_a",factionId="northline",x=0,y=0,lookAngle=0}={}){
  return{
    id,name:id,teamId,factionId,x,y,lookAngle,radius:18,
    medical:{condition:"active",dead:false,unconscious:false,bleedingRate:0},
    aiV2MedicalSupplies:{bandage:1},aiV2Capabilities:{observation:.6},
    aiV2Suppression:0,ammoInMagazine:20,magazineSize:20,pose:"ready",vx:0,vy:0
  };
}

test("close awareness detects an opposing actor behind the normal FOV while hard cover still blocks vision",()=>{
  const observer=actor("observer",{x:0,y:0,lookAngle:0});
  const target=actor("target",{teamId:"team_b",factionId:"commune",x:-180,y:0});
  const observations=[];
  const runtime=new AmbientPerceptionRuntime({scanInterval:.1,closeAwarenessRange:260});
  const missions=new Map([["team_a",{contactPolicy:{passiveVision:true,maximumRange:780,fieldOfViewDegrees:100}}],["team_b",{contactPolicy:{passiveVision:true,maximumRange:780,fieldOfViewDegrees:100}}]]);
  const visibleByObserver=new Map();
  runtime.update(.12,{game:{scenarioMode:"live",livingSandbox:{liveMode:true},actors:[observer,target],map:{obstacles:[],brush:[]}},missions,personalKnowledge:{observe:payload=>{observations.push(payload);return{observationCount:1,confidence:24};}},visibleByObserver,now:.12});
  assert.equal(visibleByObserver.get(observer.id).has(target.id),true);
  assert.equal(observations.find(item=>item.observer.id===observer.id&&item.target.id===target.id)?.evidence.closeAwareness,true);

  const blockedRuntime=new AmbientPerceptionRuntime({scanInterval:.1,closeAwarenessRange:260});
  const blockedVisible=new Map();
  blockedRuntime.update(.12,{game:{scenarioMode:"live",livingSandbox:{liveMode:true},actors:[observer,target],map:{obstacles:[{type:"wall",x:-90,y:0,radius:44}],brush:[]}},missions,personalKnowledge:{observe:()=>({observationCount:1,confidence:24})},visibleByObserver:blockedVisible,now:.12});
  assert.equal(blockedVisible.get(observer.id)?.has(target.id)??false,false);
});

test("completed tactical cover remains a protected relationship instead of disappearing next frame",()=>{
  const a=actor("a");
  a.aiV2CoverOccupancy={status:"protected",point:{x:0,y:0},threatPoint:{x:220,y:0},protection:.72,enteredAt:2,slot:{id:"slot_a",point:{x:0,y:0}}};
  const service=new ActorTacticalPictureService({directionalCover:{findBestSlot:()=>null}});
  service.update({
    game:{actors:[a],map:{obstacles:[]},wounds:{getAssessment:()=>null,getTreatmentNeed:()=>null}},
    personalKnowledge:{getContacts:()=>[{relationship:"hostile",currentlyVisible:true,subjectTeamId:"team_b",confidence:40,distance:220,lastObservedAt:3,approximatePosition:{x:220,y:0}}]},
    teamKnowledge:{getTeamContacts:()=>[]},threatKnowledge:{getThreats:()=>[]},teamProcedures:{getActorRole:()=>null},teamAgenda:{get:()=>null},now:3
  });
  const picture=service.get(a.id);
  assert.equal(picture.currentCover.protected,true);
  assert.equal(picture.currentCover.sourceType,"tactical_cover_occupancy");
  assert.equal(picture.exposed,false);
});

test("sharing a concern id does not falsely mark an obligation as acting",()=>{
  const a=actor("a");
  const concern={id:"casualty:c",teamId:"team_a",kind:"friendly_casualty",subjectId:"c",missionId:"m",desiredEffect:"stabilize_and_recover",importance:1,urgency:1,status:"active",point:{x:80,y:0}};
  const assignment={id:"casualty:c:carrier_or_aid_provider:0",concernId:concern.id,responsibility:"carrier_or_aid_provider",required:true};
  const game={actors:[a],wounds:{getAssessment:()=>null,getTreatmentNeed:()=>null}};
  const store=new ActorObligationStore();
  store.syncSources({game,teamConcerns:{get:()=>concern},concernStaffing:{getActorAssignments:()=>[assignment]},now:0});
  const obligation=store.getPrimaryForActor(a.id);
  const scheduler=new ActionScheduler();
  const unrelated=new AIV2Action({type:"HoldReady",actorId:a.id,channels:[ACTION_CHANNELS.ATTENTION]});
  unrelated.metadata.actorBrainPlan={concernId:concern.id};
  assert.equal(scheduler.start(unrelated,{now:.1,context:{}}).ok,true);
  store.reconcileExecution({game,scheduler,now:.1});
  assert.notEqual(store.getById(obligation.id).status,"acting");

  scheduler.cancelAction(a.id,unrelated,{now:.2,reason:"test",context:{}});
  const related=new AIV2Action({type:"Care",actorId:a.id,channels:[ACTION_CHANNELS.ATTENTION]});
  related.metadata.actorBrainPlan={concernId:concern.id,obligationId:obligation.id};
  assert.equal(scheduler.start(related,{now:.3,context:{}}).ok,true);
  store.reconcileExecution({game,scheduler,now:.3});
  assert.equal(store.getById(obligation.id).status,"acting");
});

test("bounded self aid can start after deferral but yields to another active caregiver",()=>{
  const a=actor("a");a.medical.bleedingRate=.7;a.aiV2TacticalPicture={treatmentSafe:false};
  const game={actors:[a],wounds:{getTreatmentNeed:()=>({type:"bandage"})}};
  const action=new SelfAidAction({actorId:a.id,allowExposed:true});
  assert.equal(action.canStart({game,services:{casualtyCare:{getController:()=>null}}}),true);
  assert.equal(action.canStart({game,services:{casualtyCare:{getController:()=>"medic_b"}}}),false);
});

test("live staffed casualty care directly approaches and then treats the assigned casualty",()=>{
  const provider=actor("provider",{x:0,y:0});
  const casualty=actor("casualty",{x:180,y:0});casualty.medical.condition="serious";casualty.medical.bleedingRate=.8;
  const assignment={id:"casualty:casualty:carrier_or_aid_provider:0",concernId:"casualty:casualty",responsibility:"carrier_or_aid_provider",required:true};
  const concern={id:assignment.concernId,teamId:"team_a",kind:"friendly_casualty",subjectId:casualty.id,missionId:"m",status:"active",desiredEffect:"stabilize_and_recover",importance:1,urgency:1};
  const obligation={id:`staffed:${assignment.id}`,priority:1.2,urgency:1,authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE};
  const proposals=[];
  const runtime=new ConcernFulfillmentRuntime({brain:{submit:proposal=>proposals.push(proposal)},spatialIntentFields:{build:()=>({id:"care",goal:{x:180,y:0},focus:{x:180,y:0},region:{type:"circle",center:{x:180,y:0},innerRadius:0,outerRadius:32}}),isSatisfied:()=>false}});
  const game={scenarioMode:"live",livingSandbox:{liveMode:true},actors:[provider,casualty],wounds:{getTreatmentNeed:()=>({type:"bandage"})}};
  const common={game,teamConcerns:{get:()=>concern},concernStaffing:{getActorAssignments:id=>id===provider.id?[assignment]:[]},actorObligations:{findForActor:()=>obligation,markBlocked:()=>true},teamProcedures:{getActorRole:()=>null,get:()=>null}};
  runtime.update({...common,now:0});
  assert.equal(proposals[0].action.type,"MoveWithinIntentField");
  assert.equal(proposals[0].obligationId,obligation.id);
  assert.equal(proposals[0].authorityTier,ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE);

  proposals.length=0;provider.x=130;
  runtime.update({...common,now:1});
  assert.equal(proposals[0].action.type,"TreatAssignedCasualty");
  assert.equal(proposals[0].obligationId,obligation.id);
});

test("reaffirming one tactical commitment preserves its anchor and original expiry",()=>{
  const store=new ActorTacticalCommitmentStore();
  const first=store.commit({actorId:"a",key:"cover:threat",kind:"seek_cover",anchorPoint:{x:100,y:10},threatPoint:{x:300,y:0},minimumUntil:4,maximumUntil:10},{now:0});
  const second=store.commit({actorId:"a",key:"cover:threat",kind:"seek_cover",anchorPoint:{x:170,y:50},threatPoint:{x:310,y:5},minimumUntil:9,maximumUntil:20},{now:3});
  assert.deepEqual(second.anchorPoint,first.anchorPoint);
  assert.equal(second.minimumUntil,4);
  assert.equal(second.maximumUntil,10);
  assert.deepEqual(second.threatPoint,{x:310,y:5});
});

test("contest contact completes after a bounded hold and installs a reassessment cooldown",()=>{
  const a=actor("a");
  const action=new CircumventContactAction({actorId:a.id,directive:{mode:"contest",destination:{x:40,y:0},focus:{x:160,y:0},initialDistance:40,holdDuration:2}});
  const game={actors:[a],aiV2:{elapsed:5}};
  const services={attention:{turnToward:()=>{}},locomotion:{moveWithIntent:()=>({arrived:true,distance:0}),stop:()=>{}}};
  action.start(0,{game});
  assert.equal(action.update(1,{game,services}),null);
  game.aiV2.elapsed=6;
  const result=action.update(1.1,{game,services});
  assert.equal(result.status,"completed");
  assert.ok(a.aiV2ContactResolutionResolvedUntil>game.aiV2.elapsed);
  assert.equal(a.operationPausedByEncounter,false);
});

test("behavioral truth does not report same-faction teams as hostile pass-bys",()=>{
  const left=actor("left",{teamId:"team_1",factionId:"northline",x:0,y:0});
  const right=actor("right",{teamId:"team_2",factionId:"northline",x:50,y:0});
  const monitor=new BehavioralTruthMonitor({sampleInterval:.1,closeTeamDistance:280});
  monitor.update(.2,{game:{actors:[left,right]},scheduler:{getPrimaryAction:()=>null,getActions:()=>[]},teamConcerns:{summary:()=>[]},threatKnowledge:{isImmediate:()=>false},now:.2});
  assert.deepEqual(monitor.report({now:.2}).signals.closeUnreactedPairs,[]);
  assert.equal(monitor.report({now:.2}).teamPairs.length,0);
});
