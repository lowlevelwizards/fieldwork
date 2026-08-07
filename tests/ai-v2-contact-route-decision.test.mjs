import test from "node:test";
import assert from "node:assert/strict";
import { ContactResolutionService } from "../js/ai-v2/encounters/contact-resolution-service.js";
import { ContactRouteDecisionState } from "../js/ai-v2/decisions/contact-route-decision-state.js";
import { ContactRoutePlanService } from "../js/ai-v2/position/contact-route-plan-service.js";
import { ContactResolutionRuntime } from "../js/ai-v2/actors/contact-resolution-runtime.js";
import { OperationalTravelRuntime } from "../js/ai-v2/actors/operational-travel-runtime.js";

function routeGame({aPos={x:0,y:0},bPos={x:0,y:450},aRoute=[{x:0,y:0},{x:600,y:0}],bRoute=[{x:0,y:450},{x:600,y:450}],aStatus="deployed",bStatus="deployed"}={}){
  const operations=new Map([
    ["opA",{id:"opA",status:aStatus,objectiveId:"objA",routePlan:{waypoints:aRoute.map((p,i)=>({id:`a${i}`,...p})),returnWaypoints:[...aRoute].reverse().map((p,i)=>({id:`ar${i}`,...p}))},actorRouteProgress:{a:{mode:aStatus==="returning"?"return":"outbound",index:1,complete:false}}}],
    ["opB",{id:"opB",status:bStatus,objectiveId:"objB",routePlan:{waypoints:bRoute.map((p,i)=>({id:`b${i}`,...p})),returnWaypoints:[...bRoute].reverse().map((p,i)=>({id:`br${i}`,...p}))},actorRouteProgress:{b:{mode:bStatus==="returning"?"return":"outbound",index:1,complete:false}}}]
  ]);
  const actors=[
    {id:"a",teamId:"A",operationId:"opA",x:aPos.x,y:aPos.y,vx:0,vy:0,radius:18,medical:{dead:false,unconscious:false,condition:"healthy"}},
    {id:"b",teamId:"B",operationId:"opB",x:bPos.x,y:bPos.y,vx:0,vy:0,radius:18,medical:{dead:false,unconscious:false,condition:"healthy"}}
  ];
  const living={
    geography:{enabled:true},
    getOperation(id){const op=operations.get(id);return op?structuredClone(op):null;},
    operationRouteStatus(operationId,actorId){
      const op=operations.get(operationId),progress=op?.actorRouteProgress?.[actorId];if(!op||!progress)return null;
      const points=progress.mode==="return"?op.routePlan.returnWaypoints:op.routePlan.waypoints;
      return{operationId,actorId,mode:progress.mode,index:progress.index,complete:progress.complete,waypoint:progress.complete?null:structuredClone(points[progress.index]),total:points.length};
    },
    markActorRouteWaypoint({operationId="opA",actorId,mode,index}){
      const op=operations.get(operationId)??[...operations.values()].find(item=>item.actorRouteProgress?.[actorId]);
      const progress=op?.actorRouteProgress?.[actorId];if(!progress||progress.mode!==mode||progress.index!==index)return false;
      const points=mode==="return"?op.routePlan.returnWaypoints:op.routePlan.waypoints;progress.index+=1;if(progress.index>=points.length)progress.complete=true;return true;
    }
  };
  return{game:{scenarioMode:"live",actors,livingSandbox:living},actors,operations};
}

function spatial({observerTeamId="A",subjectTeamId="B",routeConflict=true,objectiveConflict=false,separation=260,severity=.82,relationship="unknown",parallelMovement=false}={}){
  const ownA=observerTeamId==="A";
  return{
    key:"A::B",observerTeamId,subjectTeamId,relationship,separation,
    ownCenter:ownA?{x:0,y:0}:{x:300,y:0},otherCenter:ownA?{x:300,y:0}:{x:0,y:0},
    ownRadius:45,otherRadius:45,minimumSeparation:220,contactRegionRadius:170,
    routeConflict,routeConflictSeverity:severity,objectiveConflict,operationConflict:false,materiallyRelevant:true,
    conflictPoint:{x:150,y:0},ownRouteDirection:ownA?{x:1,y:0}:{x:-1,y:0},otherRouteDirection:ownA?{x:-1,y:0}:{x:1,y:0},
    parallelMovement,headOnMovement:!parallelMovement,crossingMovement:false
  };
}
function response(teamId,id="avoid_contact",overrides={}){return{teamId,missionId:`m${teamId}`,subjectId:teamId==="A"?"b":"a",selected:{id},ledger:{missionValue:.7,timePressure:.4,teamPreservation:.75,mobilityOrientation:.7,...overrides}};}
function encounter(teamId,spatialRecord,{physicalHostileEvidence=false}={}){return{teamId,subjectId:teamId==="A"?"b":"a",subjectTeamId:teamId==="A"?"B":"A",state:"relevant",contactResolution:spatialRecord,physicalHostileEvidence,relationship:spatialRecord.relationship};}
function stores(responses,encounters){return{
  teamResponses:{summary:()=>responses,get:teamId=>responses.find(item=>item.teamId===teamId)??null},
  teamEncounters:{getBestTeamHypothesis:teamId=>encounters.find(item=>item.teamId===teamId)??null}
};}

test("stationary nearby teams on parallel non-conflicting routes do not manufacture route conflict",()=>{
  const {game}=routeGame();
  const service=new ContactResolutionService();
  const result=service.assess({game,observerTeamId:"A",subjectTeamId:"B",relationship:"unknown",now:1});
  assert.equal(result.routeConflict,false);
  assert.equal(result.materiallyRelevant,false,"mere proximity inside the old 620px heuristic must not freeze either route");
});

test("stationary teams with crossing intended corridors create a route conflict before physical overlap",()=>{
  const {game}=routeGame({
    aPos:{x:0,y:0},bPos:{x:300,y:-300},
    aRoute:[{x:0,y:0},{x:650,y:0}],bRoute:[{x:300,y:-300},{x:300,y:350}]
  });
  const service=new ContactResolutionService();
  const result=service.assess({game,observerTeamId:"A",subjectTeamId:"B",relationship:"unknown",now:1});
  assert.equal(result.routeConflict,true);
  assert.equal(result.materiallyRelevant,true);
  assert.ok(result.routeConflictSeverity>.45);
  assert.ok(Math.hypot(result.conflictPoint.x-300,result.conflictPoint.y)<80);
});

test("mutual avoidance becomes one stable pair pass with opposite sides",()=>{
  const {game,actors}=routeGame({bPos:{x:300,y:0}});
  const records=[response("A"),response("B")],encounters=[encounter("A",spatial()),encounter("B",spatial({observerTeamId:"B",subjectTeamId:"A"}))];
  const {teamResponses,teamEncounters}=stores(records,encounters);
  const state=new ContactRouteDecisionState();
  state.update({game,teamResponses,teamEncounters,now:0});
  const first=state.summary()[0];
  assert.equal(first.mode,"pass");
  assert.equal(first.directives.A.routeMode,"circumvent");
  assert.equal(first.directives.B.routeMode,"circumvent");
  assert.equal(first.directives.A.side,-first.directives.B.side);
  const side=actors[0].aiV2ContactRouteDecision.side;
  actors[0].x+=8;actors[1].x-=6;
  state.update({game,teamResponses,teamEncounters,now:1});
  assert.equal(actors[0].aiV2ContactRouteDecision.side,side,"small frame-to-frame geometry changes cannot flip the selected passing side");
});

test("material route-priority difference produces explicit yield rather than symmetrical avoidance",()=>{
  const {game,actors}=routeGame({bPos:{x:300,y:0},aStatus:"returning"});
  const records=[response("A","avoid_contact",{missionValue:.95,timePressure:.9,teamPreservation:.95}),response("B","avoid_contact",{missionValue:.25,timePressure:.1,teamPreservation:.5})];
  const encounters=[encounter("A",spatial()),encounter("B",spatial({observerTeamId:"B",subjectTeamId:"A"}))];
  const {teamResponses,teamEncounters}=stores(records,encounters);
  const state=new ContactRouteDecisionState();state.update({game,teamResponses,teamEncounters,now:0});
  const decision=state.summary()[0];
  assert.equal(decision.mode,"yield");
  assert.equal(decision.directives.A.routeMode,"continue");
  assert.equal(decision.directives.B.routeMode,"yield");
  assert.equal(actors[1].aiV2ContactRouteDecision.priorityTeamId,"A");
});

test("contact route overlay bends the physical destination without replacing strategic route intent",()=>{
  const plan=new ContactRoutePlanService();
  const actor={x:0,y:0};
  const base={x:190,y:0};
  const result=plan.apply({actor,baseDestination:base,routeIntent:{currentSegment:{from:{x:0,y:0},to:{x:300,y:0}}},decision:{routeMode:"circumvent",routeSuspended:false,side:1,clearance:280,conflictPoint:{x:160,y:0},routeDirection:{x:1,y:0},pairKey:"A::B",desiredEffect:"preserve_route_with_separation"}});
  assert.equal(result.active,true);
  assert.notDeepEqual(result.destination,base);
  assert.ok(result.destination.y>250,"stable side selection should create a real lateral bypass");
  assert.equal(result.desiredEffect,"preserve_route_with_separation");
});

test("engagement is an explicit route suspension rather than a competing travel proposal",()=>{
  const {game,actors}=routeGame({bPos:{x:300,y:0}});
  actors[0].aiV2ContactRouteDecision={pairKey:"A::B",routeMode:"engage",routeSuspended:true,subjectTeamId:"B"};
  const proposals=[];
  const runtime=new OperationalTravelRuntime({brain:{submit:item=>proposals.push(item)}});
  runtime.update({game,teamAgenda:{get:()=>null},teamProcedures:{getActorRole:()=>null},now:1,context:{}});
  assert.equal(proposals.filter(item=>item.actorId==="a").length,0,"normal strategic travel must not challenge an explicit route suspension");
  assert.equal(runtime.get("a").routeSuspended,true);
});

test("pass-through contact uses route overlay and submits no separate CircumventContact locomotion atom",()=>{
  const {game}=routeGame({bPos:{x:300,y:0}});
  const records=[response("A"),response("B")],encounters=[encounter("A",spatial()),encounter("B",spatial({observerTeamId:"B",subjectTeamId:"A"}))];
  const {teamResponses,teamEncounters}=stores(records,encounters);
  const proposals=[];
  const runtime=new ContactResolutionRuntime({scheduler:{hasAction:()=>false},brain:{submit:item=>proposals.push(item)}});
  runtime.update({game,teamResponses,teamEncounters,teamProcedures:{get:()=>null,getActorRole:()=>null},now:0});
  assert.equal(runtime.routeSummary()[0].mode,"pass");
  assert.equal(proposals.length,0,"pass/circumvent is now a route overlay, not a second locomotion owner");
  assert.equal(game.actors[0].operationPausedByEncounter,false);
  assert.equal(game.actors[0].aiV2ContactRouteDecision.routeMode,"circumvent");
});

test("unchanged engagement becomes a route stalemate and falls back to withdrawal",()=>{
  const {game}=routeGame({bPos:{x:300,y:0}});
  const hostileA=spatial({relationship:"hostile"}),hostileB=spatial({observerTeamId:"B",subjectTeamId:"A",relationship:"hostile"});
  const records=[response("A","engage_contact"),response("B","engage_contact")],encounters=[encounter("A",hostileA),encounter("B",hostileB)];
  const {teamResponses,teamEncounters}=stores(records,encounters);
  const state=new ContactRouteDecisionState({stalemateAfter:8});
  state.update({game,teamResponses,teamEncounters,now:0});
  assert.equal(state.summary()[0].mode,"engage");
  state.update({game,teamResponses,teamEncounters,now:8.2});
  const decision=state.summary()[0];
  assert.equal(decision.mode,"withdraw");
  assert.equal(decision.recoveryFrom,"engage_stalemate");
  assert.equal(game.actors[0].aiV2ContactRouteDecision.routeSuspended,true);
});

test("unchanged access contest falls back to right-of-way yield",()=>{
  const {game}=routeGame({bPos:{x:300,y:0}});
  const a=spatial({objectiveConflict:true}),b=spatial({observerTeamId:"B",subjectTeamId:"A",objectiveConflict:true});
  const records=[response("A","contest_access",{missionValue:.9,timePressure:.8}),response("B","contest_access",{missionValue:.4,timePressure:.2})],encounters=[encounter("A",a),encounter("B",b)];
  const {teamResponses,teamEncounters}=stores(records,encounters);
  const state=new ContactRouteDecisionState({stalemateAfter:8});
  state.update({game,teamResponses,teamEncounters,now:0});
  assert.equal(state.summary()[0].mode,"contest");
  state.update({game,teamResponses,teamEncounters,now:8.2});
  assert.equal(state.summary()[0].mode,"yield");
});

test("meaningful strategic route progress resets the contact decision liveness timer",()=>{
  const {game,actors}=routeGame({bPos:{x:300,y:0}});
  const hostileA=spatial({relationship:"hostile"}),hostileB=spatial({observerTeamId:"B",subjectTeamId:"A",relationship:"hostile"});
  const records=[response("A","engage_contact"),response("B","engage_contact")],encounters=[encounter("A",hostileA),encounter("B",hostileB)];
  const {teamResponses,teamEncounters}=stores(records,encounters);
  const state=new ContactRouteDecisionState({stalemateAfter:8});state.update({game,teamResponses,teamEncounters,now:0});
  actors[0].aiV2RouteIntent={strategicProgress:.05};
  state.update({game,teamResponses,teamEncounters,now:6});
  state.update({game,teamResponses,teamEncounters,now:9});
  assert.equal(state.summary()[0].mode,"engage","real strategic progress proves the route-level encounter is not yet a stalemate");
});

test("when contact ceases to be materially relevant the pair decision disappears and route suspension clears",()=>{
  const {game}=routeGame({bPos:{x:300,y:0}});
  let material=true;
  const records=[response("A","engage_contact"),response("B","engage_contact")];
  const encA=encounter("A",spatial({relationship:"hostile"})),encB=encounter("B",spatial({observerTeamId:"B",subjectTeamId:"A",relationship:"hostile"}));
  const teamResponses={summary:()=>records,get:teamId=>records.find(item=>item.teamId===teamId)};
  const teamEncounters={getBestTeamHypothesis:teamId=>{const base=teamId==="A"?encA:encB;return{...base,contactResolution:{...base.contactResolution,materiallyRelevant:material}};}};
  const state=new ContactRouteDecisionState();state.update({game,teamResponses,teamEncounters,now:0});
  assert.equal(game.actors[0].operationPausedByEncounter,true);
  material=false;state.update({game,teamResponses,teamEncounters,now:1});
  assert.equal(state.summary().length,0);
  assert.equal(game.actors[0].aiV2ContactRouteDecision,null);
  assert.equal(game.actors[0].operationPausedByEncounter,false);
});
