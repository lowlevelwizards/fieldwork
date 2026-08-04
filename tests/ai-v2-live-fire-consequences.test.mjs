import test from "node:test";
import assert from "node:assert/strict";
import { FireExecutor } from "../js/ai-v2/execution/fire-executor.js";
import { WoundSystem } from "../js/wound-system.js";

function actor(id,teamId,x,y){return{id,teamId,name:id,x,y,radius:18,height:70,medical:null,aiV2Suppression:0};}
function gameWith(shooter,target){
  const operator={id:"operator",teamId:"player",name:"operator",x:-1000,y:-1000,radius:18};
  const game={operator,actors:[shooter,target],map:{obstacles:[]},combat:{effects:[],decals:[]},bloodDecals:[],aiV2ThreatEvents:[],pushMessage(){},aiV2:{elapsed:12,decisionLog:{entries:[],record(entry){this.entries.push(entry);}}}};
  game.wounds=new WoundSystem(game);
  return game;
}

test("live protective fire can create a deterministic wound while demonstrative fire can never injure",()=>{
  let wounded=null;
  for(let index=0;index<48&&!wounded;index+=1){
    const shooter=actor(`shooter_${index}`,"a",0,0),target=actor(`target_${index}`,"b",260,0);
    const game=gameWith(shooter,target);
    const result=new FireExecutor().fireProtectiveShot({game,actor:shooter,targetPoint:{x:300,y:0},shotIndex:0,spread:0,allowInjury:true,injuryScale:1});
    if(result.wound)wounded={result,target,game};
  }
  assert.ok(wounded,"the deterministic sample should include at least one physical wound");
  assert.equal(wounded.target.medical.wounds.length,1);
  assert.equal(wounded.game.aiV2.decisionLog.entries.some(entry=>entry.type==="live_ballistic_wound"),true);

  const warningShooter=actor("warning_shooter","a",0,0),warningTarget=actor("warning_target","b",260,0);
  const warningGame=gameWith(warningShooter,warningTarget);
  const warning=new FireExecutor().fireProtectiveShot({game:warningGame,actor:warningShooter,targetPoint:{x:300,y:0},shotIndex:0,spread:0,allowInjury:false,injuryScale:1,emitThreatEvent:true,eventKind:"warning_shot_near_miss"});
  assert.equal(warning.fired,true);
  assert.equal(warning.wound,null);
  assert.equal(warningTarget.medical.wounds.length,0);
});
