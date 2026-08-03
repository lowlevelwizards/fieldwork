import test from "node:test";
import assert from "node:assert/strict";
import { getSandboxFixture } from "../data/behavior-lab-fixtures.js";
import { simulateFixture } from "./helpers/simulate-fixture.mjs";

const FIXTURES=["open_contact","observation","cover_position","casualty_recovery"];

test("unactivated V2 fixtures remain inert",()=>{
  for(const fixture of ["cover_position"]){
    const game=simulateFixture(fixture,{seconds:12});
    assert.equal(game.aiV2.scheduler.summary().activeActions,0,fixture);
    assert.equal(game.aiV2.teamResponses.count(),0,fixture);
    assert.equal(game.aiV2.teamProcedures.count(),0,fixture);
    assert.equal(game.aiV2.encounterOutcomes.count(),0,fixture);
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
