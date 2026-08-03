import test from "node:test";
import assert from "node:assert/strict";
import { getFieldRelayVisualState } from "../js/presentation/world-entity-renderer.js";

test("field relay visual state remains readable through objective progression",()=>{
  const offline=getFieldRelayVisualState({state:"offline",progress:0});
  assert.equal(offline.label,"OFFLINE");
  assert.equal(offline.panelOpen,false);

  const inspected=getFieldRelayVisualState({state:"repairable",progress:0});
  assert.equal(inspected.label,"INSPECTED · REPAIRABLE");
  assert.equal(inspected.panelOpen,true);

  const working=getFieldRelayVisualState({state:"being_restored",progress:.46});
  assert.equal(working.label,"RESTORING 46%");
  assert.equal(working.progress,.46);
  assert.equal(working.panelOpen,true);

  const operational=getFieldRelayVisualState({state:"operational",progress:1});
  assert.equal(operational.label,"OPERATIONAL");
  assert.equal(operational.progress,1);
  assert.equal(operational.panelOpen,false);
  assert.notEqual(operational.screen,offline.screen);
});
