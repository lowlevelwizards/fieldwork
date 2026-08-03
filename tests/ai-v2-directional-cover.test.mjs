import test from "node:test";
import assert from "node:assert/strict";
import { DirectionalCoverService } from "../js/ai-v2/position/directional-cover-service.js";
import { PositionSlotClaimService } from "../js/ai-v2/position/position-slot-claim-service.js";

test("directional cover protects only from the threat direction it was derived from",()=>{
  const service=new DirectionalCoverService();
  const game={
    sandboxFixtureId:"test",
    map:{
      sandboxLayout:{zones:[{id:"test",x:-500,y:-500,width:1000,height:1000}]},
      obstacles:[{type:"rock",x:100,y:100,radius:40}]
    }
  };
  const actors=[{id:"anchor",x:100,y:20,radius:18}];
  const slots=service.buildSlots({
    game,
    threatPoint:{x:100,y:320},
    teamActors:actors,
    policy:{maximumCoverDistance:300,minimumProtection:.72}
  });
  assert.equal(slots.length,1);
  assert.ok(slots[0].point.y<100);
  assert.ok(slots[0].utility.protection>=.72);

  const valid=service.isSlotValid({game,slot:slots[0],threatPoint:{x:100,y:320},policy:{minimumProtection:.72}});
  assert.equal(valid.valid,true);
  const reversed=service.isSlotValid({game,slot:slots[0],threatPoint:{x:100,y:-240},policy:{minimumProtection:.72}});
  assert.equal(reversed.valid,false);
});

test("finite position slots reject a second actor and preserve occupied ownership",()=>{
  const claims=new PositionSlotClaimService();
  const slot={id:"rock:one",sourceObjectId:"rock",point:{x:10,y:20}};
  assert.equal(claims.claim({actorId:"a",slot,now:1}).ok,true);
  assert.equal(claims.claim({actorId:"b",slot,now:1}).ok,false);
  assert.equal(claims.occupy("a",{now:2}),true);
  assert.equal(claims.getForActor("a",2).status,"occupied");
  assert.equal(claims.summary(2).length,1);
  assert.equal(claims.releaseActor("a",{now:3,reason:"test_complete"}),true);
  assert.deepEqual(claims.summary(3),[]);
});
