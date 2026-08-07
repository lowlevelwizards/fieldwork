import test from "node:test";
import assert from "node:assert/strict";
import { ContactRouteDecisionState } from "../js/ai-v2/decisions/contact-route-decision-state.js";
import { ContactRoutePlanService } from "../js/ai-v2/position/contact-route-plan-service.js";

function fixture({responseId="engage_contact"}={}){
  const actors=[
    {id:"a",teamId:"A",x:0,y:0,operationId:"opA",medical:{dead:false,unconscious:false},aiV2RouteIntent:{strategicProgress:.4}},
    {id:"b",teamId:"B",x:300,y:0,operationId:"opB",medical:{dead:false,unconscious:false},aiV2RouteIntent:{strategicProgress:.4}}
  ];
  const operations={opA:{status:"deployed"},opB:{status:"deployed"}};
  const game={actors,livingSandbox:{getOperation:id=>operations[id]??null}};
  const responses=["A","B"].map(teamId=>({teamId,missionId:`m${teamId}`,subjectId:teamId==="A"?"b":"a",selected:{id:responseId},ledger:{missionValue:.7,timePressure:.4,teamPreservation:.75,mobilityOrientation:.65}}));
  const spatial=(teamId)=>({
    observerTeamId:teamId,subjectTeamId:teamId==="A"?"B":"A",relationship:"hostile",materiallyRelevant:true,
    separation:220,minimumSeparation:210,routeConflict:true,routeConflictSeverity:.82,objectiveConflict:false,
    ownCenter:teamId==="A"?{x:0,y:0}:{x:300,y:0},otherCenter:teamId==="A"?{x:300,y:0}:{x:0,y:0},
    ownRouteDirection:teamId==="A"?{x:1,y:0}:{x:-1,y:0},otherRouteDirection:teamId==="A"?{x:-1,y:0}:{x:1,y:0},conflictPoint:{x:150,y:0}
  });
  const encounters=["A","B"].map(teamId=>({teamId,subjectId:teamId==="A"?"b":"a",subjectTeamId:teamId==="A"?"B":"A",state:"relevant",relationship:"hostile",contactResolution:spatial(teamId)}));
  return{
    game,actors,
    teamResponses:{summary:()=>responses,get:teamId=>responses.find(item=>item.teamId===teamId)},
    teamEncounters:{getBestTeamHypothesis:teamId=>encounters.find(item=>item.teamId===teamId)}
  };
}

test("left-right body pacing does not reset contact-route liveness when access and strategic progress stay unchanged",()=>{
  const {game,actors,teamResponses,teamEncounters}=fixture();
  const state=new ContactRouteDecisionState({stalemateAfter:8});
  state.update({game,teamResponses,teamEncounters,now:0});
  assert.equal(state.summary()[0].mode,"engage");
  actors[0].x=85;actors[1].x=215;
  state.update({game,teamResponses,teamEncounters,now:4});
  actors[0].x=-85;actors[1].x=385;
  state.update({game,teamResponses,teamEncounters,now:7});
  state.update({game,teamResponses,teamEncounters,now:8.2});
  const decision=state.summary()[0];
  assert.equal(decision.mode,"withdraw","motion around one cover object is not evidence that the route obstruction is resolving");
  assert.equal(decision.recoveryFrom,"engage_stalemate");
});

test("a stalled withdrawal cannot remain an endless retreat and changes to a route-preserving pass",()=>{
  const {game,teamResponses,teamEncounters}=fixture({responseId:"withdraw"});
  const state=new ContactRouteDecisionState({stalemateAfter:8,recoveryHold:5.5});
  state.update({game,teamResponses,teamEncounters,now:0});
  assert.equal(state.summary()[0].mode,"withdraw");
  state.update({game,teamResponses,teamEncounters,now:8.2});
  assert.equal(state.summary()[0].mode,"pass");
});

test("yield uses one fixed pair anchor instead of moving the goalpost with the actor",()=>{
  const planner=new ContactRoutePlanService();
  const decision={routeMode:"yield",routeSuspended:false,side:1,clearance:300,yieldPoint:{x:-140,y:90},routeDirection:{x:1,y:0},pairKey:"A::B"};
  const routeIntent={currentSegment:{from:{x:0,y:0},to:{x:300,y:0}}};
  const first=planner.apply({actor:{x:0,y:0},baseDestination:{x:180,y:0},routeIntent,decision});
  const second=planner.apply({actor:{x:-75,y:30},baseDestination:{x:180,y:0},routeIntent,decision});
  assert.deepEqual(first.destination,{x:-140,y:90});
  assert.deepEqual(second.destination,first.destination,"moving toward the yield pocket must not move the yield pocket itself");
});
