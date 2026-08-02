function freezeArray(items){return Object.freeze(items.map(item=>Object.freeze(item)));}

export function captureWorldSnapshot(game,{elapsed=0}={}){
  const actors=game.actors.map(actor=>({
    id:actor.id,
    teamId:actor.teamId??null,
    factionId:actor.factionId??null,
    operationId:actor.operationId??null,
    role:actor.role??null,
    x:actor.x,
    y:actor.y,
    vx:actor.vx??0,
    vy:actor.vy??0,
    conscious:!(actor.medical?.unconscious||actor.medical?.dead),
    dead:Boolean(actor.medical?.dead),
    condition:actor.medical?.condition??"unknown",
    currentTask:actor.currentTask??null
  }));

  const entities=game.entities.map(entity=>({
    id:entity.id,
    type:entity.type??null,
    definitionId:entity.definitionId??null,
    locationType:entity.locationType??null,
    state:entity.state??null,
    x:entity.x??null,
    y:entity.y??null,
    revealed:entity.revealed!==false
  }));

  return Object.freeze({
    elapsed,
    scenario:game.scenarioMode,
    aiRuntime:game.aiRuntimeMode,
    clockMinutes:game.clockMinutes,
    weather:game.weather,
    operator:Object.freeze({
      id:game.operator.id,
      x:game.operator.x,
      y:game.operator.y,
      condition:game.operator.medical?.condition??"unknown"
    }),
    actors:freezeArray(actors),
    entities:freezeArray(entities)
  });
}
