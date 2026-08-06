import test from "node:test";
import assert from "node:assert/strict";
import { TeamConcernStaffingService } from "../js/ai-v2/decisions/team-concern-staffing-service.js";

function actor(id,x,capabilities,medical={condition:"healthy"}){return{id,name:id,teamId:"team_a",x,y:0,aiV2Capabilities:capabilities,medical};}
function concern(id,kind,point,staffing,importance=.8,urgency=.5){return{id,teamId:"team_a",kind,label:id,desiredEffect:`effect_${id}`,point,staffing,status:"active",importance,urgency};}

function board(concerns){
  const state={concerns:structuredClone(concerns)};
  return{
    state,
    summary:()=>[{teamId:"team_a",concerns:structuredClone(state.concerns)}],
    setStaffingAssignments(teamId,assignments){
      for(const item of state.concerns){
        item.staffing=item.staffing.map(requirement=>{
          const assigned=assignments.filter(entry=>entry.concernId===item.id&&entry.responsibility===requirement.responsibility);
          return{...requirement,filled:assigned.length,assignedActorIds:assigned.map(entry=>entry.actorId)};
        });
      }
    }
  };
}

test("concern staffing allocates capability-matched actors while preserving concurrent mission and casualty work",()=>{
  const actors=[
    actor("tech",0,{technicalWork:.95,security:.35,casualtyCare:.15}),
    actor("guard",120,{technicalWork:.2,security:.92,casualtyCare:.2}),
    actor("medic",240,{technicalWork:.1,security:.3,casualtyCare:.98,medicalCare:.98})
  ];
  const concerns=[
    concern("mission:repair","mission_progress",{x:40,y:0},[
      {responsibility:"objective_specialist",minimum:1,preferred:1,capability:"technicalWork"},
      {responsibility:"local_security",minimum:1,preferred:1,capability:"security"}
    ]),
    concern("casualty:wounded","friendly_casualty",{x:260,y:0},[
      {responsibility:"carrier_or_aid_provider",minimum:1,preferred:1,capability:"casualtyCare"}
    ],1,1)
  ];
  const concernsBoard=board(concerns);
  const service=new TeamConcernStaffingService();
  service.update({game:{actors},teamConcerns:concernsBoard,teamProcedures:null,now:1});
  assert.equal(service.findForActor("tech",{responsibility:"objective_specialist"})?.concernId,"mission:repair");
  assert.equal(service.findForActor("guard",{responsibility:"local_security"})?.concernId,"mission:repair");
  assert.equal(service.findForActor("medic",{responsibility:"carrier_or_aid_provider"})?.concernId,"casualty:wounded");
  assert.equal(service.summary().length,3);
  assert.deepEqual(concernsBoard.state.concerns.find(item=>item.id==="mission:repair").staffing.map(item=>item.filled),[1,1]);
});

test("staffing remains stable until the incumbent becomes incapable, then reassigns narrowly",()=>{
  const primary=actor("primary",0,{security:.9});
  const reserve=actor("reserve",30,{security:.82});
  const concernsBoard=board([concern("contact:hostile","hostile_contact",{x:200,y:0},[{responsibility:"immediate_security",minimum:1,preferred:1,capability:"security"}],1,1)]);
  const service=new TeamConcernStaffingService({switchMargin:.2});
  service.update({game:{actors:[primary,reserve]},teamConcerns:concernsBoard,now:1});
  const first=service.summary()[0];
  service.update({game:{actors:[primary,reserve]},teamConcerns:concernsBoard,now:2});
  assert.equal(service.summary()[0].actorId,first.actorId);
  const disabled=first.actorId==="primary"?primary:reserve;
  disabled.medical={condition:"critical"};
  service.update({game:{actors:[primary,reserve]},teamConcerns:concernsBoard,now:3});
  assert.notEqual(service.summary()[0].actorId,first.actorId);
});

import { ConcernFulfillmentRuntime } from "../js/ai-v2/actors/concern-fulfillment-runtime.js";
import { SpatialIntentFieldService } from "../js/ai-v2/position/spatial-intent-field-service.js";

test("an unowned live actor directly fulfills a staffed secondary security concern through the brain",()=>{
  const operator=actor("security",0,{security:.9});
  const hostile=concern("contact:one","hostile_contact",{x:400,y:0},[{responsibility:"immediate_security",minimum:1,preferred:1,capability:"security"}],1,1);
  const assignmentRecord={id:"contact:one:immediate_security:0",actorId:operator.id,actorName:operator.name,teamId:operator.teamId,concernId:hostile.id,concernKind:hostile.kind,responsibility:"immediate_security",desiredEffect:hostile.desiredEffect,required:true,assignedAt:1};
  const submitted=[];
  const runtime=new ConcernFulfillmentRuntime({brain:{submit:proposal=>submitted.push(proposal)},spatialIntentFields:new SpatialIntentFieldService()});
  runtime.update({
    game:{scenarioMode:"live",livingSandbox:{liveMode:true},actors:[operator]},
    teamConcerns:{get:()=>hostile},
    concernStaffing:{getActorAssignments:()=>[assignmentRecord]},
    teamProcedures:{getActorRole:()=>null},now:2
  });
  assert.equal(submitted.length,1);
  assert.equal(submitted[0].action.type,"MoveWithinIntentField");
  assert.equal(submitted[0].concernId,hostile.id);
  assert.equal(submitted[0].desiredEffect,hostile.desiredEffect);
});
