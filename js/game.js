import { mapData, MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";
import { operatorDefinition } from "../data/operators.js";
import { createWorldEntities } from "./world-entities.js";
import { InteractionSystem } from "./interaction.js";
import { InventorySystem } from "./inventory.js";
import { createActors, updateActors } from "./actors.js";

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
    this.siteLayoutIndex = Math.floor(Math.random() * 3);
    this.siteLayoutId = ["A", "B", "C"][this.siteLayoutIndex];
    this.entities = createWorldEntities(mapData, this.siteLayoutIndex);
    this.actors = createActors();
    this.clockMinutes = 7 * 60 + 45;
    this.timeScale = 1;
    this.weather = ["Clear", "Cloudy", "Fog"][Math.floor(Math.random() * 3)];
    this.dialogueRequest = null;
    this.wildlife = Array.from({ length: 9 }, (_, index) => ({ id: `wild_${index}`, x: 220 + Math.random() * 1700, y: 220 + Math.random() * 1180, phase: Math.random() * Math.PI * 2, speed: 7 + Math.random() * 10 }));
    this.backpack = { id: "mara_field_pack", ownerOperatorId: "mara_velez", capacityPips: 8, itemInstanceIds: [] };
    this.operator = { ...operatorDefinition, x: mapData.spawn.x, y: mapData.spawn.y, vx: 0, vy: 0, facing: operatorDefinition.startingFacing, walkingPhase: 0, carriedItemInstanceId: null, lockedByInteraction: false, packPulse: 0, searchPose: 0, searchTargetId: null };
    this.inventory = new InventorySystem(this);
    this.interaction = new InteractionSystem(this);
    this.messages = [];
    this.worldTextRequest = null;
    this.objectiveSecured = false;
    this.eventLog = [];
  }

  resetPosition() {
    Object.assign(this.operator, { x: this.map.spawn.x, y: this.map.spawn.y, vx: 0, vy: 0, facing: this.operator.startingFacing });
    if (this.interaction.searchingEntityId) this.interaction.cancelSearch();
  }

  emitEvent(name, entity = null) { this.eventLog.push({ name, entityId: entity?.id ?? null, time: performance.now() }); this.eventLog = this.eventLog.slice(-20); }

  openWorldText(entity, mode) { this.worldTextRequest = { entity, mode }; }

  openDialogue(actor) {
    const lineIndex = actor.relationship === "Unknown" ? 0 : 1 + Math.floor(Math.random() * Math.max(1, actor.greeting.length - 1));
    actor.relationship = "Met";
    this.dialogueRequest = { actor, text: actor.greeting[lineIndex] ?? actor.greeting[0] };
  }

  getTimeLabel() {
    const total = Math.floor(this.clockMinutes) % 1440;
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  getDayPhase() { const h = (this.clockMinutes / 60) % 24; return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening"; }

  pushMessage(text, duration = 2.1) {
    this.messages = this.messages.filter((message) => message.text !== text).slice(-1);
    this.messages.push({ text, time: duration, duration });
  }

  update(delta, move) {
    this.clockMinutes = (this.clockMinutes + delta * this.timeScale) % 1440;
    updateActors(this, delta);
    for (const bird of this.wildlife) { bird.phase += delta * bird.speed * 0.1; bird.x += Math.cos(bird.phase) * delta * bird.speed; bird.y += Math.sin(bird.phase * 0.7) * delta * bird.speed * 0.35; }
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
    const now = performance.now();
    for (const entity of this.entities) {
      if (entity.type === "item" && entity.locationType === "world" && !entity.revealed && entity.revealAt && now >= entity.revealAt) { entity.revealed = true; this.emitEvent("itemRevealed", entity); }
    }
    const battery = this.entities.find((entity) => entity.id === "battery_001");
    if (!this.objectiveSecured && battery && (battery.locationType === "backpack" || battery.locationType === "hands")) { this.objectiveSecured = true; this.pushMessage("Radio battery secured", 3); }
    this.interaction.update(delta);
    for (const message of this.messages) message.time -= delta;
    this.messages = this.messages.filter((message) => message.time > 0);
  }

  #updateEntityAnimations(delta) {
    for (const entity of this.entities) {
      if (entity.type !== "door" && entity.type !== "container") continue;
      const duration = entity.type === "door" ? 0.24 : 0.3;
      if (entity.state === "opening") {
        entity.animation = Math.min(1, (entity.animation || 0) + delta / duration);
        if (entity.animation >= 1) entity.state = "open";
      } else if (entity.state === "closing") {
        entity.animation = Math.max(0, (entity.animation || 0) - delta / duration);
        if (entity.animation <= 0) { entity.state = "closed"; if (entity.type === "door") entity.collision = true; }
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
