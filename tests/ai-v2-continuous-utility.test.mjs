import test from "node:test";
import assert from "node:assert/strict";
import { ActorUtilityEvaluationService } from "../js/ai-v2/actors/actor-utility-evaluation-service.js";
import { DirectionalCoverService } from "../js/ai-v2/position/directional-cover-service.js";
import { TacticalRepositionAction } from "../js/ai-v2/actions/tactical-reposition-action.js";
import { ACTION_AUTHORITY_TIERS } from "../js/ai-v2/authority/actor-action-arbiter.js";

test("material hostile contact sharply devalues unchanged mission travel",()=>{
  const service=new ActorUtilityEvaluationService();
  const actor={id:"a",x:0,y:0};
  const result=service.evaluate({actor,game:{},agenda:{selected:{id:"travel"}},now:1,picture:{
    visibleThreats:[{relationship:"hostile",confidence:90}],contactPressure:.82,threatPrecision:1,
    incomingFire:[],suppressionValue:0,exposed:true,
    currentCover:{protected:false,protection:0},bestCover:{utility:{protection:.8}},selfAidNeed:null,woundState:null,
    weaponReadiness:{reloadRequired:false},nearestFriendly:null,localCongestion:0,securitySupport:0
  }});
  const contact=result.candidates.find(item=>item.kind==="react_to_contact");
  const travel=result.candidates.find(item=>item.kind==="continue_mission");
  assert.ok(contact.score>.7);
  assert.ok(travel.score<.1);
  assert.ok(["react_to_contact","seek_cover"].includes(result.selected.kind));
});

test("one cover object exposes distinct actor-sized rear slots",()=>{
  const service=new DirectionalCoverService();
  const slots=service.buildSlots({game:{map:{obstacles:[{id:"rock",type:"rock",x:200,y:200,radius:54}]}},threatPoint:{x:200,y:0},teamActors:[{x:200,y:330}],policy:{minimumProtection:.25,maximumCoverDistance:600}});
  const rockSlots=slots.filter(slot=>slot.sourceObjectId==="rock");
  assert.ok(rockSlots.length>=2);
  assert.equal(new Set(rockSlots.map(slot=>slot.id)).size,rockSlots.length);
  assert.ok(rockSlots.every(slot=>slot.capacity===1));
});

test("immediate-survival cover movement may preempt objective relocation ownership",()=>{
  const actor={id:"a",x:0,y:0,medical:{condition:"healthy",dead:false,unconscious:false}};
  const services={teamProcedures:{getActorRole:()=>({
    procedureId:"restore_field_relay",
    fulfillment:{need:"objective_mission_role"},
    permissions:{relocate:true}
  })}};
  const localMove=new TacticalRepositionAction({actorId:actor.id,directive:{destination:{x:120,y:0},provenance:{source:"continuous_utility"}}});
  localMove.metadata.actorBrainPlan={authorityTier:ACTION_AUTHORITY_TIERS.GOVERNING_RESPONSE};
  assert.equal(localMove.canStart({game:{actors:[actor]},services}),false);

  const emergencyMove=new TacticalRepositionAction({actorId:actor.id,directive:{destination:{x:120,y:0},provenance:{source:"continuous_utility"}}});
  emergencyMove.metadata.actorBrainPlan={authorityTier:ACTION_AUTHORITY_TIERS.IMMEDIATE_SURVIVAL};
  assert.equal(emergencyMove.canStart({game:{actors:[actor]},services}),true);
});
