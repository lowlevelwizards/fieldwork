import { mapData, MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";
import { operatorDefinition } from "../data/operators.js";
import { createWorldEntities } from "./world-entities.js";
import { InteractionSystem } from "./interaction.js";
import { InventorySystem } from "./inventory.js";

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function circleRectCollision(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.width);
  const nearestY = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}
function rectsOverlap(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

export function resolveFacing(move, currentFacing) {
  if (Math.hypot(move.x, move.y) < 0.08) return currentFacing;
  if (Math.abs(move.x) > Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

export class GameState {
  constructor() {
    this.map = mapData;
    this.entities = createWorldEntities(mapData);
    this.backpack = { id: "mara_field_pack", ownerOperatorId: "mara_velez", capacityPips: 8, itemInstanceIds: [] };
    this.operator = { ...operatorDefinition, x: mapData.spawn.x, y: mapData.spawn.y, vx: 0, vy: 0, facing: operatorDefinition.startingFacing, walkingPhase: 0, carriedItemInstanceId: null, lockedByInteraction: false, packPulse: 0 };
    this.inventory = new InventorySystem(this);
    this.interaction = new InteractionSystem(this);
    this.messages = [];
  }

  resetPosition() {
    Object.assign(this.operator, { x: this.map.spawn.x, y: this.map.spawn.y, vx: 0, vy: 0, facing: this.operator.startingFacing });
    if (this.interaction.searchingEntityId) this.interaction.cancelSearch();
  }

  pushMessage(text, duration = 2.1) {
    this.messages = this.messages.filter((message) => message.text !== text).slice(-1);
    this.messages.push({ text, time: duration, duration });
  }

  update(delta, move) {
    const op = this.operator;
    const effectiveMove = op.lockedByInteraction ? { x: 0, y: 0 } : move;
    const targetVx = effectiveMove.x * op.moveSpeed;
    const targetVy = effectiveMove.y * op.moveSpeed;
    const rate = Math.hypot(effectiveMove.x, effectiveMove.y) > 0.01 ? op.acceleration : op.deceleration;
    const maxChange = rate * delta;
    op.vx += clamp(targetVx - op.vx, -maxChange, maxChange);
    op.vy += clamp(targetVy - op.vy, -maxChange, maxChange);
    op.facing = resolveFacing(effectiveMove, op.facing);
    if (Math.hypot(op.vx, op.vy) > 4) op.walkingPhase += delta * 9;
    op.packPulse = Math.max(0, op.packPulse - delta * 4);

    this.#moveAxis("x", op.vx * delta);
    this.#moveAxis("y", op.vy * delta);
    this.#updateEntityAnimations(delta);
    this.interaction.update(delta);
    for (const message of this.messages) message.time -= delta;
    this.messages = this.messages.filter((message) => message.time > 0);
  }

  #updateEntityAnimations(delta) {
    for (const entity of this.entities) {
      if (entity.type !== "door") continue;
      if (entity.state === "opening") {
        entity.animation = Math.min(1, entity.animation + delta / 0.24);
        if (entity.animation >= 1) entity.state = "open";
      } else if (entity.state === "closing") {
        entity.animation = Math.max(0, entity.animation - delta / 0.24);
        if (entity.animation <= 0) { entity.state = "closed"; entity.collision = true; }
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
      if (axis === "x") op.vx = 0; else op.vy = 0;
    }
  }

  #shedWalls() {
    const s = this.map.shed; const t = s.wallThickness;
    return [
      { x: s.x, y: s.y, width: s.width, height: t }, { x: s.x, y: s.y, width: t, height: s.height },
      { x: s.x + s.width - t, y: s.y, width: t, height: s.height }, { x: s.x, y: s.y + s.height - t, width: s.doorGap.start, height: t },
      { x: s.x + s.doorGap.start + s.doorGap.width, y: s.y + s.height - t, width: s.width - s.doorGap.start - s.doorGap.width, height: t }
    ];
  }

  #collides(x, y, radius) {
    for (const obstacle of this.map.obstacles) {
      const dx = x - obstacle.x; const dy = y - obstacle.y; const minimum = radius + obstacle.radius;
      if (dx * dx + dy * dy < minimum * minimum) return true;
    }
    if (this.#shedWalls().some((wall) => circleRectCollision(x, y, radius, wall))) return true;
    return this.entities.some((entity) => entity.collision && circleRectCollision(x, y, radius, entity));
  }

  isRectBlocked(rect, ignoredEntityId = null, includeOperator = false) {
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > MAP_WIDTH || rect.y + rect.height > MAP_HEIGHT) return true;
    if (this.#shedWalls().some((wall) => rectsOverlap(rect, wall))) return true;
    for (const obstacle of this.map.obstacles) {
      if (circleRectCollision(obstacle.x, obstacle.y, obstacle.radius, rect)) return true;
    }
    for (const entity of this.entities) {
      if (entity.id === ignoredEntityId || entity.type === "item" && entity.locationType !== "world") continue;
      if ((entity.collision || entity.type === "item") && rectsOverlap(rect, entity)) return true;
    }
    if (includeOperator && circleRectCollision(this.operator.x, this.operator.y, this.operator.radius, rect)) return true;
    return false;
  }
}
