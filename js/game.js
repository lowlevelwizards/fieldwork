import { mapData, MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";
import { operatorDefinition } from "../data/operators.js";
import { createWorldEntities } from "./world-entities.js";
import { InteractionSystem } from "./interaction.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function circleRectCollision(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.width);
  const nearestY = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

export function resolveFacing(move, currentFacing) {
  if (Math.hypot(move.x, move.y) < 0.08) return currentFacing;
  if (Math.abs(move.x) > Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

export class GameState {
  constructor() {
    this.map = mapData;
    this.entities = createWorldEntities(mapData);
    this.operator = {
      ...operatorDefinition,
      x: mapData.spawn.x,
      y: mapData.spawn.y,
      vx: 0,
      vy: 0,
      facing: operatorDefinition.startingFacing,
      walkingPhase: 0,
      carriedItemInstanceId: null,
      lockedByInteraction: false
    };
    this.interaction = new InteractionSystem(this);
    this.message = null;
    this.messageTime = 0;
  }

  resetPosition() {
    this.operator.x = this.map.spawn.x;
    this.operator.y = this.map.spawn.y;
    this.operator.vx = 0;
    this.operator.vy = 0;
    this.operator.facing = this.operator.startingFacing;
    if (this.interaction.searchingEntityId) this.interaction.cancelSearch();
  }

  pushMessage(text, duration = 2.1) {
    this.message = text;
    this.messageTime = duration;
  }

  update(delta, move) {
    const op = this.operator;
    const effectiveMove = op.lockedByInteraction ? { x: 0, y: 0 } : move;
    const targetVx = effectiveMove.x * op.moveSpeed;
    const targetVy = effectiveMove.y * op.moveSpeed;
    const inputMagnitude = Math.hypot(effectiveMove.x, effectiveMove.y);
    const rate = inputMagnitude > 0.01 ? op.acceleration : op.deceleration;
    const maxChange = rate * delta;

    op.vx += clamp(targetVx - op.vx, -maxChange, maxChange);
    op.vy += clamp(targetVy - op.vy, -maxChange, maxChange);
    op.facing = resolveFacing(effectiveMove, op.facing);

    if (Math.hypot(op.vx, op.vy) > 4) op.walkingPhase += delta * 9;

    this.#moveAxis("x", op.vx * delta);
    this.#moveAxis("y", op.vy * delta);
    this.#updateEntityAnimations(delta);
    this.interaction.update(delta);

    if (this.messageTime > 0) {
      this.messageTime -= delta;
      if (this.messageTime <= 0) this.message = null;
    }
  }

  #updateEntityAnimations(delta) {
    for (const entity of this.entities) {
      if (entity.type === "door" && entity.state === "opening") {
        entity.animation = Math.min(1, entity.animation + delta / 0.24);
        if (entity.animation >= 1) entity.state = "open";
      }
    }
  }

  #moveAxis(axis, amount) {
    const op = this.operator;
    const previous = op[axis];
    op[axis] += amount;
    op.x = clamp(op.x, op.radius, MAP_WIDTH - op.radius);
    op.y = clamp(op.y, op.radius, MAP_HEIGHT - op.radius);

    if (this.#collides(op.x, op.y, op.radius)) {
      op[axis] = previous;
      if (axis === "x") op.vx = 0;
      else op.vy = 0;
    }
  }

  #collides(x, y, radius) {
    for (const obstacle of this.map.obstacles) {
      const dx = x - obstacle.x;
      const dy = y - obstacle.y;
      const minimum = radius + obstacle.radius;
      if (dx * dx + dy * dy < minimum * minimum) return true;
    }

    const s = this.map.shed;
    const t = s.wallThickness;
    const walls = [
      { x: s.x, y: s.y, width: s.width, height: t },
      { x: s.x, y: s.y, width: t, height: s.height },
      { x: s.x + s.width - t, y: s.y, width: t, height: s.height },
      { x: s.x, y: s.y + s.height - t, width: s.doorGap.start, height: t },
      {
        x: s.x + s.doorGap.start + s.doorGap.width,
        y: s.y + s.height - t,
        width: s.width - s.doorGap.start - s.doorGap.width,
        height: t
      }
    ];
    if (walls.some((wall) => circleRectCollision(x, y, radius, wall))) return true;

    for (const entity of this.entities) {
      if (!entity.collision) continue;
      if (circleRectCollision(x, y, radius, entity)) return true;
    }
    return false;
  }
}
