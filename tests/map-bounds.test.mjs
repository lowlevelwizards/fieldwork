import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";
import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";

test("fixture 05 activates its authored width before movement clamping",()=>{
  const game=new ContinuousGameState({
    scenario:"sandbox",
    aiRuntime:"v2",
    sandboxFixture:"objective_initiative"
  });

  assert.ok(game.operator.x>4400,"fixture 05 should spawn beyond the former four-bay boundary");
  game.update(.05,{x:0,y:0});

  assert.equal(MAP_WIDTH,5500);
  assert.equal(MAP_HEIGHT,2000);
  assert.ok(game.operator.x>4400,"the first movement frame must not clamp the operator back into fixture 04");
  assert.equal(game.getCollisionReason(game.operator.x,game.operator.y,game.operator.radius),null);
});

test("creating the normal operations world restores its own map bounds",()=>{
  const game=new ContinuousGameState({scenario:"operations",aiRuntime:"legacy"});
  game.getCollisionReason(game.operator.x,game.operator.y,game.operator.radius);
  assert.equal(MAP_WIDTH,4400);
  assert.equal(MAP_HEIGHT,2000);
  assert.equal(game.getCollisionReason(4450,850,18),"map boundary");
});
