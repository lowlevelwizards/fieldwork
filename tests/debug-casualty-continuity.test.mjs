import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

test("diagnose casualty recovery continuity",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"casualty_recovery"});
  const snapshots=[];
  for(let step=0;step<100;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%10===0){
      const medic=game.actors.find(actor=>actor.aiV2CasualtyAssignment?.observe||actor.role==="Field Medic"||actor.aiV2Capabilities?.medical>0);
      const casualty=game.actors.find(actor=>["critical","unconscious","serious"].includes(actor.medical?.condition)&&actor.id!==medic?.id);
      snapshots.push({
        t:Number(game.aiV2?.elapsed?.toFixed?.(2)??0),
        medic:medic?{id:medic.id,x:Number(medic.x.toFixed(1)),y:Number(medic.y.toFixed(1)),task:medic.currentTask,action:medic.currentAction}:null,
        casualty:casualty?{id:casualty.id,x:Number(casualty.x.toFixed(1)),y:Number(casualty.y.toFixed(1)),condition:casualty.medical?.condition}:null,
        actions:medic?(game.aiV2?.scheduler?.getActions?.(medic.id)??[]).map(action=>({id:action.id,type:action.type,state:action.state,endReason:action.endReason??null})):[],
        obligations:medic?(game.aiV2?.actorObligations?.getActorObligations?.(medic.id,{activeOnly:false})??[]).map(item=>({id:item.id,status:item.status,kind:item.concernKind,responsibility:item.responsibility,activeActionIds:item.activeActionIds,interruptionCount:item.interruptionCount})):[]
      });
    }
  }
  const entries=(game.aiV2?.decisionLog?.entries??[]).filter(entry=>entry.actionType==="ApproachCasualty"||entry.type.includes("obligation")).map(entry=>({type:entry.type,time:entry.time,actorId:entry.actorId,actionId:entry.actionId??null,actionType:entry.actionType??null,data:entry.data}));
  console.log("CASUALTY_SNAPSHOTS",JSON.stringify(snapshots));
  console.log("CASUALTY_EVENTS",JSON.stringify(entries.slice(0,160)));
  assert.ok(true);
});
