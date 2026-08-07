import test from "node:test";
import assert from "node:assert/strict";
import { ContinuousGameState } from "../js/continuous-game-state.js";

const HARD_DECISIONS=new Set(["engage","contest","pass","yield"]);

test("live contact-route decisions do not leave strategic travel fighting a suspension or an unchanged hard decision indefinitely",()=>{
  const game=new ContinuousGameState({scenario:"live",aiRuntime:"v2"});
  let sawDecision=false,sawSuspension=false,maxHardDecisionStaleAge=0;
  const samples=[];
  for(let step=0;step<1200;step+=1){
    game.update(.1,{x:0,y:0});
    if(step%10!==0)continue;
    for(const actor of game.actors??[]){
      const decision=actor.aiV2ContactRouteDecision;
      if(!decision)continue;
      sawDecision=true;
      const active=game.aiV2?.scheduler?.getActions?.(actor.id)??[];
      if(decision.routeSuspended){
        sawSuspension=true;
        assert.equal(active.some(action=>action.type==="FollowOperationRoute"),false,`${actor.name??actor.id} cannot simultaneously follow the operation route while ${decision.routeMode} explicitly suspends it`);
      }else{
        assert.equal(actor.operationPausedByEncounter,false,`${decision.routeMode} is a route overlay/continuation and must not pause the operation`);
      }
    }
    for(const decision of game.aiV2?.contactResolution?.routeSummary?.()??[]){
      if(!HARD_DECISIONS.has(decision.mode))continue;
      const staleAge=Math.max(0,game.aiV2.elapsed-(decision.lastMeaningfulChangeAt??game.aiV2.elapsed));
      maxHardDecisionStaleAge=Math.max(maxHardDecisionStaleAge,staleAge);
      if(staleAge>9.2)samples.push({time:Number(game.aiV2.elapsed.toFixed(1)),pair:decision.key,mode:decision.mode,staleAge:Number(staleAge.toFixed(1)),separation:Math.round(decision.separation??0)});
    }
  }
  assert.equal(sawDecision,true,"the living sandbox should naturally produce at least one material team contact in the soak window");
  assert.equal(sawSuspension,true,"the soak should exercise at least one explicit engage/contest/withdraw route suspension");
  assert.deepEqual(samples,[],`hard route decisions must transform or recover after their bounded liveness window; max observed age ${maxHardDecisionStaleAge.toFixed(1)}s`);
});
