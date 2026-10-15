import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

test("diagnose casualty recovery continuity",()=>{
  const game=new ContinuousGameState({scenario:"sandbox",aiRuntime:"v2",sandboxFixture:"casualty_recovery"});
  const snapshots=[];
  for(let step=0;step<260;step+=1){
    game.update(.05,{x:0,y:0});
    if(step%20===0){
      const caregiver=game.actors.find(actor=>(game.aiV2?.actorObligations?.getActorObligations?.(actor.id,{activeOnly:false})??[]).some(item=>item.responsibility==="carrier_or_aid_provider"))??game.actors[1];
      const obligation=(game.aiV2?.actorObligations?.getActorObligations?.(caregiver.id,{activeOnly:false})??[]).find(item=>item.responsibility==="carrier_or_aid_provider")??null;
      const casualty=obligation?game.actors.find(actor=>actor.id===obligation.subjectId):game.actors.find(actor=>actor.medical?.condition==="critical");
      const procedure=game.aiV2?.teamProcedures?.get?.(caregiver.teamId)??null;
      snapshots.push({
        t:Number(game.aiV2?.elapsed?.toFixed?.(2)??0),
        caregiver:{id:caregiver.id,x:Number(caregiver.x.toFixed(1)),y:Number(caregiver.y.toFixed(1)),task:caregiver.currentTask,action:caregiver.currentAction},
        casualty:casualty?{id:casualty.id,x:Number(casualty.x.toFixed(1)),y:Number(casualty.y.toFixed(1)),condition:casualty.medical?.condition,beingDragged:Boolean(casualty.beingDragged)}:null,
        separation:casualty?Number(Math.hypot(caregiver.x-casualty.x,caregiver.y-casualty.y).toFixed(1)):null,
        procedure:procedure?{id:procedure.procedureId,phase:procedure.phase?.id}:null,
        actions:(game.aiV2?.scheduler?.getActions?.(caregiver.id)??[]).map(action=>({id:action.id,type:action.type,state:action.state,endReason:action.endReason??null,destination:action.directive?.destination??null})),
        obligation:obligation?{id:obligation.id,status:obligation.status,activeActionIds:obligation.activeActionIds,interruptionCount:obligation.interruptionCount}:null,
        claims:game.aiV2?.destinationClaims?.summary?.(game.aiV2.elapsed)??[],
        patients:game.aiV2?.casualtyCare?.summary?.()??[]
      });
    }
  }
  const tracked=new Set(["ApproachCasualty","AssessCasualty","DragCasualty","StabilizeCasualty"]);
  const entries=(game.aiV2?.decisionLog?.entries??[]).filter(entry=>tracked.has(entry.actionType)||String(entry.type).includes("procedure")||String(entry.type).includes("obligation")).map(entry=>({type:entry.type,time:entry.time,actorId:entry.actorId,actionId:entry.actionId??null,actionType:entry.actionType??null,data:entry.data}));
  console.log("CASUALTY_SNAPSHOTS",JSON.stringify(snapshots));
  console.log("CASUALTY_EVENTS",JSON.stringify(entries.slice(0,260)));
  assert.ok(true);
});
