import test from "node:test";
import assert from "node:assert/strict";
import { SpatialIntentFieldService } from "../js/ai-v2/position/spatial-intent-field-service.js";
import { TacticalSteeringService } from "../js/ai-v2/execution/tactical-steering-service.js";
import { MoveWithinIntentFieldAction } from "../js/ai-v2/actions/move-within-intent-field-action.js";

function actor(id,x=0,y=0){return{id,name:id,teamId:"team",x,y,radius:18,medical:{condition:"healthy"},aiV2Capabilities:{security:.8}};}
function assignment(id,actorId,responsibility="local_security"){return{id,actorId,actorName:actorId,concernId:"mission:one",concernKind:"mission_progress",responsibility,required:true,assignedAt:1};}
const concern={id:"mission:one",teamId:"team",kind:"mission_progress",label:"Repair relay",desiredEffect:"restore_relay",point:{x:300,y:200},importance:.8,urgency:.4,status:"active"};

test("spatial intent fields give staffed actors distinct stable valid positions instead of one exact destination",()=>{
  const service=new SpatialIntentFieldService();
  const left=actor("left"),right=actor("right");
  const a=service.build({actor:left,assignment:assignment("slot:left","left"),concern,now:1});
  const b=service.build({actor:right,assignment:assignment("slot:right","right"),concern,now:1});
  assert.equal(a.region.type,"annulus");
  assert.notDeepEqual(a.goal,b.goal);
  assert.deepEqual(service.build({actor:left,assignment:assignment("slot:left","left"),concern,now:2}).goal,a.goal);
  const satisfied={...left,x:a.goal.x,y:a.goal.y};
  assert.equal(service.isSatisfied(satisfied,a),true);
  satisfied.x=concern.point.x;satisfied.y=concern.point.y;
  assert.equal(service.isSatisfied(satisfied,a),false,"security intent preserves an inner standoff instead of collapsing onto the objective");
});

test("steering recognizes an entire annulus as satisfied",()=>{
  const steering=new TacticalSteeringService();
  const intent={region:{type:"annulus",center:{x:100,y:100},innerRadius:80,outerRadius:160,preferredRadius:120},goal:{x:220,y:100}};
  assert.equal(steering.regionSatisfied(actor("inside",220,100),intent),true);
  assert.equal(steering.regionSatisfied(actor("too_close",120,100),intent),false);
  assert.equal(steering.regionSatisfied(actor("too_far",300,100),intent),false);
});

test("intent-field movement remains valid only while its concern staffing assignment is active",()=>{
  const a=actor("operator");
  const intent={id:"field",kind:"concern_mission_progress",region:{type:"circle",center:{x:100,y:0},innerRadius:0,outerRadius:30,preferredRadius:10},goal:{x:90,y:0},label:"Mission support"};
  const action=new MoveWithinIntentFieldAction({actorId:a.id,directive:{assignmentId:"slot",concernId:"mission:one",responsibility:"mission_progress",intent}});
  const context={game:{actors:[a]},services:{concernStaffing:{hasAssignment:()=>true}}};
  assert.equal(action.canStart(context),true);
  context.services.concernStaffing.hasAssignment=()=>false;
  assert.equal(action.canContinue(context),false);
});
