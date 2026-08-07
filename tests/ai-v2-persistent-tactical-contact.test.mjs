import test from "node:test";
import assert from "node:assert/strict";
import { TacticalContactBeliefService } from "../js/ai-v2/actors/tactical-contact-belief-service.js";
import { ActorTacticalPictureService } from "../js/ai-v2/actors/actor-tactical-picture-service.js";
import { ActorUtilityEvaluationService } from "../js/ai-v2/actors/actor-utility-evaluation-service.js";
import { navigationWeights } from "../js/ai-v2/execution/tactical-navigation-policy.js";

const actor={id:"a",teamId:"blue",x:0,y:0,medical:{dead:false,unconscious:false},aiV2Suppression:0,aiV2MedicalSupplies:{}};
const lostContact=(overrides={})=>({
  subjectId:"enemy_1",subjectTeamId:"red",relationship:"hostile",identity:"recognized_faction_operator",confidence:72,
  approximatePosition:{x:180,y:0},lastObservedAt:0,currentlyVisible:false,distance:180,
  track:{movementDirection:"east",estimatedSpeed:50,currentActivity:"repositioning",intentHypothesis:{id:"unknown"}},
  ...overrides
});
const visibleContact=(overrides={})=>lostContact({currentlyVisible:true,lastObservedAt:8,approximatePosition:{x:86,y:30},confidence:84,...overrides});
const report=(overrides={})=>({
  id:"report_1",sourceActorId:"ally",subjectId:"enemy_1",subjectTeamId:"red",relationship:"hostile",identity:"recognized_faction_operator",
  confidence:58,approximatePosition:{x:210,y:-40},sourceObservationAt:4,reportedAt:4.6,lastUpdatedAt:4.6,
  movementDirection:"east",estimatedSpeed:42,activity:"repositioning",intentHypothesis:{id:"uncertain"},...overrides
});
const incoming=(overrides={})=>({
  id:"threat_1",eventId:"shot_1",subjectId:"threat_source_shot_1",confidence:92,approximatePosition:{x:230,y:10},lastObservedAt:4,
  immediateUntil:7,eventKind:"near_miss",track:{currentActivity:"firing",estimatedSpeed:0,movementDirection:"unknown",intentHypothesis:{id:"hostile"}},...overrides
});

test("LOS loss preserves a tactically meaningful contact belief",()=>{
  const service=new TacticalContactBeliefService();
  const result=service.buildForActor({actor,personalContacts:[lostContact()],now:5});
  assert.equal(result.best?.state,"tracked_unseen");
  assert.ok(result.contactPressure>.2);
  assert.equal(result.best?.currentlyVisible,false);
});

test("uncertainty grows while unseen contact ages",()=>{
  const service=new TacticalContactBeliefService();
  const early=service.buildForActor({actor,personalContacts:[lostContact()],now:1}).best;
  const later=service.buildForActor({actor,personalContacts:[lostContact()],now:7}).best;
  assert.ok(later.uncertaintyRadius>early.uncertaintyRadius);
});

test("short-term motion prediction advances along observed movement",()=>{
  const service=new TacticalContactBeliefService({predictionHorizon:3.2});
  const result=service.buildForActor({actor,personalContacts:[lostContact()],now:2}).best;
  assert.ok(result.center.x>180);
  assert.ok(result.predictionAge>0);
});

test("prediction stops extrapolating after the short horizon",()=>{
  const service=new TacticalContactBeliefService({predictionHorizon:3.2});
  const atFour=service.buildForActor({actor,personalContacts:[lostContact()],now:4}).best;
  const atNine=service.buildForActor({actor,personalContacts:[lostContact()],now:9}).best;
  assert.ok(Math.abs(atFour.center.x-atNine.center.x)<.001);
  assert.ok(atNine.uncertaintyRadius>atFour.uncertaintyRadius);
  assert.equal(atNine.predictionLimited,true);
});

test("fresh direct reacquisition collapses uncertainty and overrides prediction",()=>{
  const service=new TacticalContactBeliefService();
  const predicted=service.buildForActor({actor,personalContacts:[lostContact()],now:8}).best;
  const reacquired=service.buildForActor({actor,personalContacts:[visibleContact()],now:8}).best;
  assert.ok(reacquired.uncertaintyRadius<predicted.uncertaintyRadius);
  assert.ok(Math.hypot(reacquired.center.x-86,reacquired.center.y-30)<1);
  assert.equal(reacquired.state,"visible_confirmed");
});

test("a received team report creates a lower-precision tactical belief",()=>{
  const service=new TacticalContactBeliefService();
  const result=service.buildForActor({actor,receivedReports:[report()],now:6});
  assert.equal(result.best?.state,"team_reported");
  assert.ok(result.contactPressure>.12);
  assert.ok(result.best.uncertaintyRadius>35);
});

test("an unreceived team report does not magically enter the actor tactical picture",()=>{
  const pictures=new ActorTacticalPictureService({directionalCover:{findBestSlot:()=>null}});
  const game={scenarioMode:"live",livingSandbox:{liveMode:true},actors:[actor],map:{obstacles:[]},wounds:{getAssessment:()=>null,getTreatmentNeed:()=>null}};
  pictures.update({
    game,personalKnowledge:{getContacts:()=>[]},threatKnowledge:{getThreats:()=>[]},
    teamKnowledge:{getReceivedContacts:()=>[],getTeamContacts:()=>[report()]},
    teamProcedures:{getActorRole:()=>null},teamAgenda:{get:()=>null},now:6
  });
  const picture=pictures.get(actor.id);
  assert.equal(picture.contactBeliefs.length,0);
  assert.equal(picture.threatPoint,null);
});

test("incoming fire creates a persistent anonymous hostile belief",()=>{
  const service=new TacticalContactBeliefService();
  const result=service.buildForActor({actor,incomingThreats:[incoming()],now:6});
  assert.equal(result.best?.subjectId,"threat_source_shot_1");
  assert.equal(result.best?.relationship,"hostile");
  assert.ok(result.contactPressure>.65);
});

test("anonymous hostile evidence does not falsely merge with a known contact",()=>{
  const service=new TacticalContactBeliefService();
  const result=service.buildForActor({actor,personalContacts:[lostContact()],incomingThreats:[incoming()],now:6});
  assert.equal(result.beliefs.length,2);
  assert.ok(result.beliefs.some(item=>item.subjectId==="enemy_1"));
  assert.ok(result.beliefs.some(item=>item.subjectId==="threat_source_shot_1"));
});

test("fresh contradictory report beats an old extrapolation without averaging identities",()=>{
  const service=new TacticalContactBeliefService();
  const old=lostContact({lastObservedAt:0,confidence:48,approximatePosition:{x:180,y:0}});
  const fresh=report({sourceObservationAt:9.2,reportedAt:9.5,confidence:72,approximatePosition:{x:-40,y:-220},movementDirection:"stationary",estimatedSpeed:0});
  const result=service.buildForActor({actor,personalContacts:[old],receivedReports:[fresh],now:10}).best;
  assert.ok(result.center.y<-150);
  assert.equal(result.contradictoryEvidence,true);
  assert.ok(result.uncertaintyRadius>60);
});

test("persistent contact keeps directional cover tactically meaningful after LOS loss",()=>{
  const pictures=new ActorTacticalPictureService({directionalCover:{findBestSlot:()=>null}});
  const coveredActor={...actor};
  const game={scenarioMode:"live",livingSandbox:{liveMode:true},actors:[coveredActor],map:{obstacles:[{id:"wall",x:45,y:0,radius:40,type:"wall"}]},wounds:{getAssessment:()=>null,getTreatmentNeed:()=>null}};
  pictures.update({
    game,personalKnowledge:{getContacts:()=>[lostContact({approximatePosition:{x:200,y:0},track:{movementDirection:"stationary",estimatedSpeed:0,currentActivity:"stationary"}})]},
    threatKnowledge:{getThreats:()=>[]},teamKnowledge:{getReceivedContacts:()=>[]},teamProcedures:{getActorRole:()=>null},teamAgenda:{get:()=>null},now:5
  });
  const picture=pictures.get(coveredActor.id);
  assert.ok(picture.threatPoint);
  assert.equal(picture.currentCover.protected,true);
});

test("contact pressure decays smoothly and mission utility returns",()=>{
  const service=new TacticalContactBeliefService();
  const early=service.buildForActor({actor,personalContacts:[lostContact()],now:3});
  const late=service.buildForActor({actor,personalContacts:[lostContact({confidence:38})],now:18});
  assert.ok(early.contactPressure>late.contactPressure);
  const utility=new ActorUtilityEvaluationService();
  const pressured=utility.evaluate({actor:{...actor,id:"u1"},picture:{contactPressure:.55,incomingFire:[],suppressionValue:0,exposed:false,currentCover:{protected:false,protection:0},bestCover:null,securitySupport:0,localCongestion:0,nearestFriendly:null,weaponReadiness:{reloadRequired:false}},agenda:{selected:{id:"mission"}},now:1});
  const calm=utility.evaluate({actor:{...actor,id:"u2"},picture:{contactPressure:.02,incomingFire:[],suppressionValue:0,exposed:false,currentCover:{protected:false,protection:0},bestCover:null,securitySupport:0,localCongestion:0,nearestFriendly:null,weaponReadiness:{reloadRequired:false}},agenda:{selected:{id:"mission"}},now:1});
  assert.ok(pressured.contactPressure>.5);
  assert.equal(calm.selected.kind,"continue_mission");
});

test("navigation keeps caution but weakens exact directional avoidance as uncertainty grows",()=>{
  const precise={...actor,aiV2TacticalPicture:{contactPressure:.62,threatPrecision:.9,suppressionState:"steady"}};
  const uncertain={...actor,aiV2TacticalPicture:{contactPressure:.62,threatPrecision:.12,suppressionState:"steady"}};
  const preciseWeights=navigationWeights({kind:"operation_route_corridor"},precise);
  const uncertainWeights=navigationWeights({kind:"operation_route_corridor"},uncertain);
  assert.ok(uncertainWeights.contactFactor>0);
  assert.ok(preciseWeights.contactFactor>uncertainWeights.contactFactor);
});
