import test from "node:test";
import assert from "node:assert/strict";
import { getSandboxFixture } from "../js/combat-sandbox.js";
import { simulateFixture } from "./helpers/simulate-fixture.mjs";

const FIXTURES=["open_contact","observation","cover_position","casualty_recovery","objective_initiative"];

test("all current Behavior Lab fixtures initialize the isolated V2 runtime",()=>{
  for(const fixture of FIXTURES){
    const game=simulateFixture(fixture,{seconds:.25});
    assert.ok(game.aiV2,fixture);
    assert.equal(game.aiRuntimeMode,"v2",fixture);
    assert.deepEqual(game.aiV2.invariants.current,[],fixture);
  }
});

test("legacy fixtures initialize without activating AI V2",()=>{
  for(const fixture of FIXTURES){
    const game=simulateFixture(fixture,{seconds:.25,aiRuntime:"legacy"});
    assert.equal(game.aiV2,null,fixture);
    const expectedActors=getSandboxFixture(fixture).teams.reduce((sum,team)=>sum+team.actors.length,0);
    assert.equal(game.actors.length,expectedActors,fixture);
  }
});
