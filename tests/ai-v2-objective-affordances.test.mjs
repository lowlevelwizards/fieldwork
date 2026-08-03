import test from "node:test";
import assert from "node:assert/strict";
import { ObjectiveStateStore } from "../js/ai-v2/objectives/objective-state-store.js";
import { ObjectiveApproachService } from "../js/ai-v2/objectives/objective-approach-service.js";

test("objective work has exclusive ownership and changes state through inspection before restoration",()=>{
  const entity={
    id:"relay",aiObjective:true,objectiveKind:"restore_relay",name:"Relay",x:100,y:100,
    interactionRadius:80,state:"offline",progress:0,objectiveRequirements:{inspectDuration:1,workDuration:2}
  };
  const store=new ObjectiveStateStore();
  store.syncFromGame({entities:[entity]});
  assert.equal(store.claimWork({objectiveId:"relay",actorId:"a",teamId:"team",now:0}).ok,true);
  assert.equal(store.claimWork({objectiveId:"relay",actorId:"b",teamId:"team",now:0}).ok,false);
  assert.equal(store.inspect({objectiveId:"relay",actorId:"a",now:1}).ok,true);
  assert.equal(store.get("relay").state,"repairable");
  assert.equal(store.advanceWork({objectiveId:"relay",actorId:"a",teamId:"team",delta:1,now:2}).completed,false);
  const completion=store.advanceWork({objectiveId:"relay",actorId:"a",teamId:"team",delta:1,now:3});
  assert.equal(completion.completed,true);
  assert.equal(store.get("relay").state,"operational");
  assert.equal(store.get("relay").completedByTeamId,"team");
  assert.equal(store.releaseWork("relay","a",{now:3,reason:"complete"}),true);
  assert.equal(store.claimSummary().length,0);
});

test("objective approach selection changes when the shortest cardinal approach is blocked",()=>{
  const service=new ObjectiveApproachService();
  const objective={id:"relay",x:500,y:500,interactionRadius:80};
  const actors=[{id:"a",x:500,y:900},{id:"b",x:450,y:920},{id:"c",x:550,y:920}];
  const openGame={map:{obstacles:[]}};
  const open=service.getOrSelect({game:openGame,teamId:"open",objective,teamActors:actors,plan:{stagingDistance:220,roleSpacing:100,maximumTravel:1000},now:0});
  assert.equal(open.directionId,"south");

  const blockedGame={map:{obstacles:[{type:"rock",x:500,y:720,radius:95}]}};
  const blocked=service.getOrSelect({game:blockedGame,teamId:"blocked",objective,teamActors:actors,plan:{stagingDistance:220,roleSpacing:100,maximumTravel:1000},now:0});
  assert.notEqual(blocked.directionId,"south");
  assert.equal(new Set(Object.values(blocked.rolePoints).map(point=>`${Math.round(point.x)},${Math.round(point.y)}`)).size,3);
});
