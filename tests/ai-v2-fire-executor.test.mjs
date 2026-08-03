import test from "node:test";
import assert from "node:assert/strict";
import { FireExecutor } from "../js/ai-v2/execution/fire-executor.js";

function actor(id,teamId,x,y){
  return{
    id,teamId,x,y,radius:18,lookAngle:0,facing:"right",
    medical:{dead:false,unconscious:false},
    aiV2Suppression:0
  };
}

function gameWith(actors){
  return{
    actors,
    map:{obstacles:[]},
    combat:{effects:[],decals:[]},
    aiV2ThreatEvents:[]
  };
}

test("protective fire rejects a friendly firing-line obstruction without consuming ammunition",()=>{
  const shooter=actor("shooter","team_a",0,0);
  const friendly=actor("friendly","team_a",100,0);
  const game=gameWith([shooter,friendly]);
  const executor=new FireExecutor();
  executor.ensureWeapon(shooter);
  const before=shooter.ammoInMagazine;
  const result=executor.fireProtectiveShot({game,actor:shooter,targetPoint:{x:300,y:0},shotIndex:0,spread:0});
  assert.equal(result.fired,false);
  assert.equal(result.reason,"friendly_in_line");
  assert.equal(result.blockedByActorId,friendly.id);
  assert.equal(shooter.ammoInMagazine,before);
});

test("protective fire is deterministic and consumes one finite round",()=>{
  const shooter=actor("shooter","team_a",0,0);
  const enemy=actor("enemy","team_b",240,70);
  const game=gameWith([shooter,enemy]);
  const executor=new FireExecutor();
  executor.ensureWeapon(shooter);
  const before=shooter.ammoInMagazine;
  const result=executor.fireProtectiveShot({game,actor:shooter,targetPoint:{x:300,y:0},shotIndex:2,spread:.05});
  assert.equal(result.fired,true);
  assert.equal(shooter.ammoInMagazine,before-1);
  assert.equal(game.combat.effects.filter(effect=>effect.type==="muzzle").length,1);
  assert.equal(game.combat.effects.filter(effect=>effect.type==="tracer").length,1);
  assert.equal(game.combat.decals.length,1);
});


test("an explicitly perceptible near miss emits one bounded physical threat event",()=>{
  const shooter=actor("shooter","team_a",0,0);
  const enemy=actor("enemy","team_b",260,72);
  const game=gameWith([shooter,enemy]);
  const executor=new FireExecutor();
  const result=executor.fireProtectiveShot({
    game,actor:shooter,targetPoint:{x:300,y:0},shotIndex:0,spread:0,
    emitThreatEvent:true,eventKind:"warning_shot_near_miss",eventConfidence:96
  });
  assert.equal(result.fired,true);
  assert.equal(game.aiV2ThreatEvents.length,1);
  const event=game.aiV2ThreatEvents[0];
  assert.equal(event.kind,"warning_shot_near_miss");
  assert.equal(event.targetActorId,enemy.id);
  assert.equal(event.sourceTeamId,shooter.teamId);
  assert.equal(event.subjectId,`threat_source_${shooter.id}`);
  assert.ok(event.nearMissDistance<=128);
});
