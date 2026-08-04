import test from "node:test";
import assert from "node:assert/strict";
import { entriesOf, outcomeKinds, simulateFixture } from "./helpers/simulate-fixture.mjs";

test("observation fixture completes warning, staged withdrawal, and de-escalation",()=>{
  const game=simulateFixture("observation",{seconds:35});
  const warnings=entriesOf(game,"directed_warning_delivered");
  assert.equal(warnings.length,1,"the boundary warning should be delivered exactly once");
  assert.equal(warnings[0].data.recipientIds.length,3,"all three valid Commune recipients should hear it");

  const withdrawalStarts=entriesOf(game,"action_started","WithdrawToRoute");
  assert.deepEqual(
    withdrawalStarts.map(entry=>entry.data.provenance?.roleId),
    ["withdrawal_lead","protected_mover","rear_watch"],
    "withdrawal roles should move in authored order"
  );
  assert.ok(
    withdrawalStarts.every((entry,index)=>index===0||entry.time>withdrawalStarts[index-1].time),
    "each withdrawal stage should begin after the previous stage"
  );

  assert.deepEqual(
    new Set(outcomeKinds(game)),
    new Set(["withdrew_without_reply","contact_departed_after_warning"])
  );
  for(const entry of game.aiV2.encounterOutcomes.summary()){
    for(const outcome of entry.outcomes){
      assert.equal(outcome.missionResolved,true);
      assert.equal(outcome.status,"resolved");
      assert.equal(outcome.violent,false);
    }
  }

  assert.equal(entriesOf(game,"action_started").some(entry=>/fire|aim/i.test(entry.actionType??"")),false);
  assert.deepEqual(game.aiV2.invariants.current,[]);
});
