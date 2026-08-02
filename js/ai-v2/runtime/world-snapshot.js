function freezeArray(items){return Object.freeze(items.map(item=>Object.freeze(item)));}

export function captureWorldSnapshot(game,{elapsed=0}={}){
  const actors=game.actors.map(actor=>({
    id:actor.id,
    teamId:actor.teamId??null,
    factionId:actor.factionId??null,
    operationId:actor.operationId??null,
    role:actor.role??null,
    procedureRole:actor.procedureRole??null,
    x:actor.x,
    y:actor.y,
    vx:actor.vx??0,
    vy:actor.vy??0,
    facing:actor.facing??null,
    lookAngle:Number.isFinite(actor.lookAngle)?actor.lookAngle:null,
    conscious:!(actor.medical?.unconscious||actor.medical?.dead),
    dead:Boolean(actor.medical?.dead),
    condition:actor.medical?.condition??"unknown",
    currentTask:actor.currentTask??null,
    currentAction:actor.currentAction??null,
    v2Assignment:actor.aiV2Assignment?Object.freeze({
      mission:actor.aiV2Assignment.mission,
      task:actor.aiV2Assignment.task,
      procedure:actor.aiV2Assignment.procedure,
      phase:actor.aiV2Assignment.phase,
      role:actor.aiV2Assignment.role,
      action:actor.aiV2Assignment.action,
      sector:Object.freeze({...actor.aiV2Assignment.sector})
    }):null
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
    fixtureId:game.sandboxFixtureId??null,
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
