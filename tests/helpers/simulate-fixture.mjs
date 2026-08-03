import { ContinuousGameState } from "../../js/continuous-game-state.js";

export function simulateFixture(fixture,{seconds=35,delta=.05,aiRuntime="v2"}={}){
  const game=new ContinuousGameState({
    scenario:"sandbox",
    aiRuntime,
    sandboxFixture:fixture
  });
  const steps=Math.ceil(seconds/delta);
  for(let step=0;step<steps;step+=1)game.update(delta,{x:0,y:0});
  return game;
}

export function entriesOf(game,type,actionType=null){
  return game.aiV2?.decisionLog?.entries?.filter(entry=>
    entry.type===type&&(!actionType||entry.actionType===actionType)
  )??[];
}

export function activeActions(game){
  return game.actors.flatMap(actor=>game.aiV2?.scheduler?.getActions?.(actor.id)??[]);
}

export function outcomeKinds(game){
  return game.aiV2?.encounterOutcomes?.summary?.().flatMap(entry=>entry.outcomes.map(outcome=>outcome.kind))??[];
}
