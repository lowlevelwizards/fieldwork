import test from "node:test";
import assert from "node:assert/strict";
import { TacticalSteeringService } from "../js/ai-v2/execution/tactical-steering-service.js";
import { pathClearance } from "../js/ai-v2/execution/tactical-navigation-geometry.js";

function actor(overrides={}){return{id:"a",teamId:"t",x:0,y:0,vx:0,vy:0,radius:18,medical:{dead:false},aiV2TacticalPicture:{contactPressure:0,suppressionState:"steady"},...overrides};}
function game(actors,obstacles=[]){return{actors,map:{obstacles}};}

test("segment clearance rejects a path through an obstacle even when endpoint is clear",()=>{
  const g=game([],[{id:"rock",x:70,y:0,radius:24}]);
  const result=pathClearance(g,{x:0,y:0},{x:140,y:0},{actorRadius:18,clearance:7});
  assert.equal(result.clear,false);
  assert.equal(result.blockingObstacleId,"rock");
});

test("navigator chooses a clear lateral candidate before colliding with a blocking obstacle",()=>{
  const a=actor();const g=game([a],[{id:"rock",x:68,y:0,radius:24}]);
  const steering=new TacticalSteeringService();
  const target=steering.steer(a,{kind:"operation_route_corridor",goal:{x:220,y:0},lookAhead:112},{game:g,now:0});
  assert.notEqual(a.aiV2Steering.selected.angleDegrees,0);
  assert.equal(pathClearance(g,a,target,{actorRadius:a.radius,clearance:7}).clear,true);
});

test("local path continuity prevents immediate left-right oscillation",()=>{
  const a=actor();const g=game([a],[{id:"rock",x:68,y:0,radius:24}]);
  const steering=new TacticalSteeringService();
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:220,y:0},lookAhead:112},{game:g,now:0});
  const first=Math.sign(a.aiV2Steering.selected.angleDegrees);
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:220,y:0},lookAhead:112},{game:g,now:.12});
  const second=Math.sign(a.aiV2Steering.selected.angleDegrees);
  assert.notEqual(first,0);
  assert.equal(second,first);
});

test("predicted friendly congestion bends an actor away from a teammate occupying the direct line",()=>{
  const a=actor();const teammate=actor({id:"b",x:56,y:0,vx:0,vy:0});const g=game([a,teammate]);
  const steering=new TacticalSteeringService();
  steering.steer(a,{kind:"clear_congestion",goal:{x:180,y:0},lookAhead:100,preferredSeparationMin:62},{game:g,now:0});
  assert.ok(Math.abs(a.aiV2Steering.selected.angleDegrees)>=15);
});

test("meaningful contact shifts local path choice toward directional protection",()=>{
  const obstacle={id:"cover",x:40,y:-50,radius:18};
  const quiet=actor();const quietGame=game([quiet],[obstacle]);const quietSteering=new TacticalSteeringService();
  quietSteering.steer(quiet,{kind:"operation_route_corridor",goal:{x:180,y:0},lookAhead:110},{game:quietGame,now:0});
  const quietAngle=Math.abs(quiet.aiV2Steering.selected.angleDegrees);
  const threatened=actor({aiV2TacticalPicture:{contactPressure:.95,suppressionState:"pressured",threatPoint:{x:0,y:-220}}});
  const threatenedGame=game([threatened],[obstacle]);const threatenedSteering=new TacticalSteeringService();
  threatenedSteering.steer(threatened,{kind:"operation_route_corridor",goal:{x:180,y:0},lookAhead:110,threatPoint:{x:0,y:-220}},{game:threatenedGame,now:0});
  assert.ok(Math.abs(threatened.aiV2Steering.selected.angleDegrees)>quietAngle);
  assert.ok(threatened.aiV2Steering.selected.factors.cover>.5);
});

test("liveness degradation records a failed local method and expands recovery search",()=>{
  const a=actor();const g=game([a],[{id:"rock",x:68,y:0,radius:24}]);
  const steering=new TacticalSteeringService();
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:220,y:0},lookAhead:112},{game:g,now:0});
  const first=a.aiV2Steering.selected.angleDegrees;
  a.aiV2ActionLiveness={status:"warning",signals:{stalledFor:1.2,recentReversals:2,obstacleJamSeconds:.6}};
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:220,y:0},lookAhead:112},{game:g,now:.8});
  assert.equal(a.aiV2Steering.navigationMode,"recovery");
  assert.ok(a.aiV2Steering.recentFailures>=1);
  assert.notEqual(a.aiV2Steering.selected.angleDegrees,first);
});

test("recovery mode may choose a locally regressive route when forward paths are constrained",()=>{
  const a=actor({aiV2ActionLiveness:{status:"warning",signals:{stalledFor:1.4,recentReversals:3}}});
  const obstacles=[
    {id:"front",x:62,y:0,radius:30},
    {id:"upper",x:20,y:-58,radius:31},
    {id:"lower",x:20,y:58,radius:31}
  ];
  const g=game([a],obstacles);const steering=new TacticalSteeringService();
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:220,y:0},lookAhead:110},{game:g,now:1});
  assert.equal(a.aiV2Steering.navigationMode,"recovery");
  assert.ok(Math.abs(a.aiV2Steering.selected.angleDegrees)>=90);
});

test("material intent change discards stale route continuity",()=>{
  const a=actor();const g=game([a]);const steering=new TacticalSteeringService();
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:200,y:0},lookAhead:100},{game:g,now:0});
  const east={...a.aiV2Steering.target};
  steering.steer(a,{kind:"seek_cover",goal:{x:0,y:-200},lookAhead:100,threatPoint:{x:180,y:0}},{game:g,now:.1});
  const next=a.aiV2Steering.target;
  assert.ok(next.y<0);
  assert.ok(Math.abs(next.y)>Math.abs(next.x));
  assert.notDeepEqual(next,east);
});

test("corridor intent still favors useful forward progress after lateral avoidance",()=>{
  const a=actor();const g=game([a],[{id:"rock",x:62,y:0,radius:22}]);const steering=new TacticalSteeringService();
  steering.steer(a,{kind:"operation_route_corridor",goal:{x:240,y:0},lookAhead:110,corridor:{from:{x:0,y:0},to:{x:240,y:0},width:125}},{game:g,now:0});
  assert.ok(a.aiV2Steering.target.x>0);
  assert.ok(a.aiV2Steering.selected.factors.corridor>.35);
});
