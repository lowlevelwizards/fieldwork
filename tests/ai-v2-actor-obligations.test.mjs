import test from "node:test";
import assert from "node:assert/strict";
import { ActorObligationStore } from "../js/ai-v2/actors/actor-obligation-store.js";
import { ConcernFulfillmentRuntime } from "../js/ai-v2/actors/concern-fulfillment-runtime.js";
import { ActionScheduler } from "../js/ai-v2/actions/action-scheduler.js";
import { AIV2Action } from "../js/ai-v2/actions/action.js";
import { ACTION_CHANNELS } from "../js/ai-v2/actions/action-channels.js";
import { ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";

function actor(id="actor_a"){
  return{id,name:id,teamId:"team_a",x:0,y:0,medical:{condition:"active",dead:false,unconscious:false,bleedingRate:0},aiV2MedicalSupplies:{bandage:1}};
}

function concern(){
  return{id:"contact:team_b",teamId:"team_a",kind:"hostile_contact",subjectId:"team_b",missionId:"mission_a",label:"Hostile contact",desiredEffect:"preserve_standoff_and_survivability",importance:.95,urgency:.9,status:"active",point:{x:240,y:0},legacyProjection:{procedureId:"mission_procedure"}};
}

function assignment(){
  return{id:"contact:team_b:contact_security:0",teamId:"team_a",concernId:"contact:team_b",concernKind:"hostile_contact",subjectId:"team_b",missionId:"mission_a",desiredEffect:"preserve_standoff_and_survivability",responsibility:"contact_security",required:true,priority:1.2,actorId:"actor_a"};
}

test("staffed actor obligation survives an atomic action gap until its source resolves",()=>{
  const a=actor();
  const c=concern();
  const asn=assignment();
  const store=new ActorObligationStore();
  const teamConcerns={get:()=>c};
  let liveAssignments=[asn];
  const concernStaffing={getActorAssignments:()=>liveAssignments};
  const game={actors:[a],wounds:{getAssessment:()=>null,getTreatmentNeed:()=>null}};
  store.syncSources({game,teamConcerns,concernStaffing,now:1});
  const obligation=store.getPrimaryForActor(a.id);
  assert.equal(obligation.status,"accepted");
  assert.equal(obligation.authorityTier,ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE);

  const scheduler=new ActionScheduler();
  const action=new AIV2Action({type:"TestObligationAction",actorId:a.id,channels:[ACTION_CHANNELS.ATTENTION]});
  action.metadata.actorBrainPlan={obligationId:obligation.id,concernId:c.id};
  assert.equal(scheduler.start(action,{now:1,context:{}}).ok,true);
  store.reconcileExecution({game,scheduler,now:1.1});
  assert.equal(store.getPrimaryForActor(a.id).status,"acting");

  scheduler.cancelAction(a.id,action,{now:1.2,reason:"temporary_preemption",context:{}});
  store.reconcileExecution({game,scheduler,now:1.2});
  const afterGap=store.getPrimaryForActor(a.id);
  assert.equal(afterGap.status,"accepted");
  assert.equal(afterGap.interruptionCount,1);
  assert.equal(afterGap.acceptedAt,1);

  store.syncSources({game,teamConcerns,concernStaffing,now:2});
  assert.equal(store.getPrimaryForActor(a.id).acceptedAt,1);
  liveAssignments=[];
  store.syncSources({game,teamConcerns,concernStaffing,now:3});
  assert.equal(store.getById(obligation.id).status,"resolved");
});

test("self aid becomes an immediate persistent obligation and resolves only after treatment need clears",()=>{
  const a=actor();a.medical.bleedingRate=.7;
  let needsTreatment=true;
  const game={actors:[a],wounds:{getAssessment:()=>({bleeding:.7}),getTreatmentNeed:()=>needsTreatment?{type:"bandage"}:null}};
  const store=new ActorObligationStore();
  store.syncSources({game,teamConcerns:{get:()=>null},concernStaffing:{getActorAssignments:()=>[]},now:0});
  const obligation=store.findForActor(a.id,{kind:"self_aid"});
  assert.ok(obligation);
  assert.equal(obligation.authorityTier,ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL);
  assert.equal(obligation.desiredEffect,"treat_bandage");

  const scheduler=new ActionScheduler();
  const action=new AIV2Action({type:"SelfAid",actorId:a.id,channels:[ACTION_CHANNELS.HANDS]});
  scheduler.start(action,{now:.1,context:{}});
  store.reconcileExecution({game,scheduler,now:.1});
  assert.equal(store.findForActor(a.id,{kind:"self_aid"}).status,"acting");
  assert.equal(action.metadata.actorBrainPlan.obligationId,obligation.id);

  needsTreatment=false;
  store.syncSources({game,teamConcerns:{get:()=>null},concernStaffing:{getActorAssignments:()=>[]},now:1});
  assert.equal(store.getById(obligation.id).status,"resolved");
});

test("an unrelated mission procedure no longer suppresses a staffed hostile-contact obligation",()=>{
  const a=actor();const c=concern();const asn=assignment();
  const obligation={id:`staffed:${asn.id}`,priority:1.2,urgency:.98,authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE};
  const proposals=[];
  const brain={submit:proposal=>{proposals.push(proposal);return "proposal";}};
  const spatialIntentFields={build:()=>({id:"intent",label:"Contact security",reason:"Preserve hostile standoff",goal:{x:180,y:0},focus:{x:240,y:0},region:{type:"annulus",center:{x:240,y:0},innerRadius:160,outerRadius:340}}),isSatisfied:()=>false};
  const runtime=new ConcernFulfillmentRuntime({brain,spatialIntentFields});
  const game={scenarioMode:"live",livingSandbox:{liveMode:true},actors:[a]};
  const teamConcerns={get:()=>c};
  const concernStaffing={getActorAssignments:()=>[asn]};
  const actorObligations={findForActor:()=>obligation,markBlocked:()=>true};
  const teamProcedures={getActorRole:()=>({procedureId:"mission_procedure",roleId:"objective_specialist"}),get:()=>({procedureId:"mission_procedure",subjectId:"objective_a"})};
  runtime.update({game,teamConcerns,concernStaffing,actorObligations,teamProcedures,now:0});
  assert.equal(proposals.length,1);
  assert.equal(proposals[0].obligationId,obligation.id);
  assert.equal(proposals[0].authorityTier,ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE);

  proposals.length=0;
  const matchingProcedure={...teamProcedures,get:()=>({procedureId:"contact_procedure",subjectId:"team_b"}),getActorRole:()=>({procedureId:"contact_procedure",roleId:"contact_security"})};
  runtime.update({game,teamConcerns,concernStaffing,actorObligations,teamProcedures:matchingProcedure,now:1});
  assert.equal(proposals.length,0);
  assert.equal(runtime.get(a.id)[0].proceduralInteraction,true);
});

import { ActorActionArbiter } from "../js/ai-v2/authority/actor-action-arbiter.js";
import { UnifiedActorBrain } from "../js/ai-v2/actors/unified-actor-brain.js";

test("required hostile-contact obligation can displace unchanged mission travel",()=>{
  const a=actor();const c=concern();const asn=assignment();
  const scheduler=new ActionScheduler();
  const arbiter=new ActorActionArbiter({scheduler});
  const brain=new UnifiedActorBrain({scheduler,arbiter});
  const context={game:{scenarioMode:"live",livingSandbox:{liveMode:true},actors:[a]},services:{teamConcerns:{getActive:()=>[c]},concernStaffing:{hasAssignment:(actorId,id)=>actorId===a.id&&id===asn.id}}};
  brain.beginFrame({now:0,context});
  const route=new AIV2Action({type:"ContinueMissionTravel",actorId:a.id,channels:[ACTION_CHANNELS.LOCOMOTION],priority:10});
  brain.submit({actorId:a.id,action:route,score:3,urgency:.4,authorityTier:ACTION_AUTHORITY_TIERS.MISSION_RESPONSIBILITY,source:"test_route"});
  brain.resolve({now:0,context});
  assert.equal(scheduler.hasAction(a.id,"ContinueMissionTravel"),true);

  const proposals=[];
  const recordingBrain={submit:proposal=>{proposals.push(proposal);brain.submit(proposal);}};
  const spatialIntentFields={build:()=>({id:"intent",label:"Contact security",reason:"Preserve hostile standoff",goal:{x:180,y:0},focus:{x:240,y:0},region:{type:"annulus",center:{x:240,y:0},innerRadius:160,outerRadius:340}}),isSatisfied:()=>false};
  const fulfillment=new ConcernFulfillmentRuntime({brain:recordingBrain,spatialIntentFields});
  const obligation={id:`staffed:${asn.id}`,priority:1.2,urgency:.98,authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE};
  brain.beginFrame({now:1,context});
  fulfillment.update({game:context.game,teamConcerns:{get:()=>c},concernStaffing:{getActorAssignments:()=>[asn]},actorObligations:{findForActor:()=>obligation,markBlocked:()=>true},teamProcedures:{getActorRole:()=>null,get:()=>null},now:1});
  brain.resolve({now:1,context:{...context,services:{...context.services,concernStaffing:{...context.services.concernStaffing,getActorAssignments:()=>[asn]}}}});
  assert.equal(proposals[0].authorityTier,ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE);
  assert.equal(scheduler.hasAction(a.id,"ContinueMissionTravel"),false);
  assert.equal(scheduler.hasAction(a.id,"MoveWithinIntentField"),true);
});
