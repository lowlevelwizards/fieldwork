import test from "node:test";
import assert from "node:assert/strict";
import { ContactResolutionService } from "../js/ai-v2/encounters/contact-resolution-service.js";

function makeGame({withBelief=true,hiddenY=900}={}){
  const operations=new Map([
    ["opA",{id:"opA",status:"deployed",objectiveId:"objA",routePlan:{waypoints:[{id:"a0",x:0,y:0},{id:"a1",x:700,y:0}],returnWaypoints:[]},actorRouteProgress:{a:{mode:"outbound",index:1,complete:false}}}],
    ["opB",{id:"opB",status:"deployed",objectiveId:"objB",routePlan:{waypoints:[{id:"b0",x:0,y:hiddenY},{id:"b1",x:700,y:hiddenY}],returnWaypoints:[]},actorRouteProgress:{b:{mode:"outbound",index:1,complete:false}}}]
  ]);
  const actors=[
    {id:"a",teamId:"A",operationId:"opA",x:0,y:0,radius:18,medical:{dead:false,unconscious:false}},
    {id:"b",teamId:"B",operationId:"opB",x:300,y:hiddenY,radius:18,medical:{dead:false,unconscious:false}}
  ];
  const livingSandbox={
    getOperation:id=>structuredClone(operations.get(id)),
    operationRouteStatus(operationId,actorId){
      const operation=operations.get(operationId),progress=operation.actorRouteProgress[actorId];
      const points=operation.routePlan.waypoints;
      return{operationId,actorId,mode:progress.mode,index:progress.index,complete:progress.complete,waypoint:points[progress.index],total:points.length};
    }
  };
  const game={scenarioMode:"live",actors,livingSandbox};
  game.aiV2={
    tacticalPictures:{get(actorId){return actorId==="a"?{contactBeliefs:withBelief?[{subjectTeamId:"B",center:{x:310,y:40},uncertaintyRadius:72,confidence:.76,tacticalSalience:.82,lastConfirmedAt:4,motion:{direction:"east",speed:28}}]:[]}:null;}},
    teamUnderstanding:{get:()=>({operationHypothesis:{objectiveId:"objB"}})}
  };
  return game;
}

test("live contact-route conflict follows the 3.2F belief region instead of a hidden team's exact body or route",()=>{
  const game=makeGame();
  const result=new ContactResolutionService().assess({game,observerTeamId:"A",subjectTeamId:"B",relationship:"unknown",now:5});
  assert.equal(result.evidenceBound,true);
  assert.equal(result.routeConflict,true,"the believed contact region overlaps A's route and must matter even though hidden ground truth is elsewhere");
  assert.ok(result.otherCenter.y<100,"route geometry should use the believed contact center");
  assert.ok(Math.abs(result.otherCenter.y-game.actors[1].y)>700,"hidden ground truth must not leak back into route conflict geometry");
});

test("an unseen team physically on the route cannot create a contact-route decision without actor knowledge",()=>{
  const game=makeGame({withBelief:false,hiddenY:0});
  const result=new ContactResolutionService().assess({game,observerTeamId:"A",subjectTeamId:"B",relationship:"unknown",now:5});
  assert.equal(result,null,"live route conflict must wait for personal or communicated tactical evidence rather than reading hidden world truth");
});
