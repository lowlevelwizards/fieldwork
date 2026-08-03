import { mapData, MAP_WIDTH, MAP_HEIGHT, activateMapBounds } from "../data/map.js";
import { operatorDefinition } from "../data/operators.js";
import { getItemDefinition } from "../data/items.js";
import { createWorldEntities, findEntity } from "./world-entities.js";
import { InteractionSystem } from "./interaction.js";
import { InventorySystem } from "./inventory.js";
import { createActors, updateActors } from "./actors.js";
import { IncidentController } from "./incident.js";
import { ExcursionController } from "./excursion.js";
import { createPlaces } from "./places.js";
import { OperationSystem } from "./operations.js";

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function circleRectCollision(cx, cy, radius, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.width);
  const ny = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}
function rectsOverlap(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
export function resolveFacing(move, currentFacing) {
  if (Math.hypot(move.x, move.y) < .08) return currentFacing;
  if (Math.abs(move.x) > Math.abs(move.y)) return move.x < 0 ? "left" : "right";
  return move.y < 0 ? "up" : "down";
}

export class GameState {
  constructor() {
    this.map = mapData;
    activateMapBounds(this.map);
    this.siteLayoutIndex = Math.floor(Math.random() * 3);
    this.siteLayoutId = ["A", "B", "C"][this.siteLayoutIndex];
    this.entities = createWorldEntities(mapData, this.siteLayoutIndex);
    this.actors = createActors();
    this.places = createPlaces(mapData);
    this.clockMinutes = 7 * 60 + 45;
    this.timeScale = 6;
    this.weather = ["Clear", "Cloudy", "Fog"][Math.floor(Math.random() * 3)];
    this.dialogueRequest = null;
    this.assessmentRequest = null;
    this.routeReviewRequest = false;
    this.assistedActorId = null;
    this.waterExposure = 0;
    this.messages = [];
    this.lastCollisionReason = null;
    this.lastCollisionRecovery = null;
    this.wildlife = Array.from({ length: 12 }, (_, i) => ({ id: `wild_${i}`, x: 220 + Math.random() * 3800, y: 220 + Math.random() * 1450, phase: Math.random() * Math.PI * 2, speed: 7 + Math.random() * 10 }));
    this.backpack = { id: "mara_field_pack", ownerOperatorId: "mara_velez", capacityPips: 8, itemInstanceIds: [] };
    this.operator = { ...operatorDefinition, x: mapData.spawn.x, y: mapData.spawn.y, vx: 0, vy: 0, facing: operatorDefinition.startingFacing, walkingPhase: 0, carriedItemInstanceId: null, lockedByInteraction: false, packPulse: 0, searchPose: 0, searchTargetId: null };
    this.inventory = new InventorySystem(this);
    this.interaction = new InteractionSystem(this);
    this.worldTextRequest = null;
    this.objectiveSecured = false;
    this.eventLog = [];
    this.incident = new IncidentController(this);
    this.excursion = new ExcursionController(this);
    this.operations = new OperationSystem(this);
    this.ensureOperatorSafe("initial spawn", false);
  }

  #shedWalls() {
    const s = this.map.shed, t = s.wallThickness;
    return [
      { id: "shed_wall_top", x: s.x, y: s.y, width: s.width, height: t },
      { id: "shed_wall_left", x: s.x, y: s.y, width: t, height: s.height },
      { id: "shed_wall_right", x: s.x + s.width - t, y: s.y, width: t, height: s.height },
      { id: "shed_wall_bottom_left", x: s.x, y: s.y + s.height - t, width: s.doorGap.start, height: t },
      { id: "shed_wall_bottom_right", x: s.x + s.doorGap.start + s.doorGap.width, y: s.y + s.height - t, width: s.width - s.doorGap.start - s.doorGap.width, height: t }
    ];
  }

  getCollisionReason(x = this.operator.x, y = this.operator.y, radius = this.operator.radius) {
    activateMapBounds(this.map);
    if (x - radius < 0 || y - radius < 0 || x + radius > MAP_WIDTH || y + radius > MAP_HEIGHT) return "map boundary";
    for (let i = 0; i < this.map.obstacles.length; i++) {
      const obstacle = this.map.obstacles[i], dx = x - obstacle.x, dy = y - obstacle.y, minimum = radius + obstacle.radius;
      if (dx * dx + dy * dy < minimum * minimum) return `${obstacle.type || "obstacle"}_${i}`;
    }
    for (const wall of this.#shedWalls()) if (circleRectCollision(x, y, radius, wall)) return wall.id;
    for (const entity of this.entities) {
      if (entity.revealed === false || !entity.collision) continue;
      if (circleRectCollision(x, y, radius, entity)) return entity.id;
    }
    return null;
  }

  findNearestSafePosition(x, y, radius = this.operator.radius, maxDistance = 360) {
    if (!this.getCollisionReason(x, y, radius)) return { x, y };
    const angularSteps = 24;
    for (let distance = 12; distance <= maxDistance; distance += 12) {
      for (let step = 0; step < angularSteps; step++) {
        const angle = (step / angularSteps) * Math.PI * 2;
        const candidate = {
          x: clamp(x + Math.cos(angle) * distance, radius, MAP_WIDTH - radius),
          y: clamp(y + Math.sin(angle) * distance, radius, MAP_HEIGHT - radius)
        };
        if (!this.getCollisionReason(candidate.x, candidate.y, radius)) return candidate;
      }
    }
    const fallback = { x: clamp(this.map.spawn.x, radius, MAP_WIDTH - radius), y: clamp(this.map.spawn.y, radius, MAP_HEIGHT - radius) };
    return this.getCollisionReason(fallback.x, fallback.y, radius) ? null : fallback;
  }

  ensureOperatorSafe(context = "movement", notify = true) {
    const op = this.operator;
    const reason = this.getCollisionReason(op.x, op.y, op.radius);
    this.lastCollisionReason = reason;
    if (!reason) return false;
    const from = { x: op.x, y: op.y };
    const safe = this.findNearestSafePosition(op.x, op.y, op.radius);
    if (!safe) return false;
    Object.assign(op, { x: safe.x, y: safe.y, vx: 0, vy: 0 });
    this.lastCollisionRecovery = { context, reason, from, to: safe };
    this.lastCollisionReason = null;
    if (notify) this.pushMessage("Moved to the nearest clear ground", 2.8);
    this.emitEvent("operatorDepenetrated");
    return true;
  }

  resetPosition() {
    const safe = this.findNearestSafePosition(this.map.spawn.x, this.map.spawn.y, this.operator.radius) || { x: 300, y: 850 };
    Object.assign(this.operator, { x: safe.x, y: safe.y, vx: 0, vy: 0, facing: this.operator.startingFacing });
    this.lastCollisionReason = this.getCollisionReason(safe.x, safe.y, this.operator.radius);
    this.lastCollisionRecovery = { context: "manual reset", reason: "reset requested", from: null, to: safe };
    if (this.interaction.searchingEntityId) this.interaction.cancelSearch();
    this.pushMessage("Returned to clear ground", 2.4);
  }

  emitEvent(name, entity = null) { this.eventLog.push({ name, entityId: entity?.id ?? null, time: performance.now() }); this.eventLog = this.eventLog.slice(-30); }
  openWorldText(entity, mode) { this.worldTextRequest = { entity, mode }; }
  openDialogue(actor) {
    const lineIndex = actor.relationship === "Unknown" ? 0 : 1 + Math.floor(Math.random() * Math.max(1, actor.greeting.length - 1));
    actor.relationship = "Met";
    let text = actor.greeting[lineIndex] ?? actor.greeting[0];
    if (actor.id === "worker_ada") {
      if (!actor.assessed) text = "Please—my leg. I slipped beside the truck.";
      else if (!this.incident.bandageUsed) text = "The bleeding needs a clean bandage.";
      else if (!this.incident.waterUsed) text = "The bleeding is controlled. Some water would help.";
      else if (!this.incident.workerSheltered) text = "Thank you. I am recovering, but I still need help getting to the break table.";
      else text = "I am all right here. Restore the radio so dispatch knows where we are.";
    }
    if (actor.id === "worker_tomas" && this.incident.state === "resolved" && this.excursion.state === "available") text = "Dispatch got through. The north culvert is backing up again. Take a look when you're ready.";
    this.dialogueRequest = { actor, text };
  }
  getHeldItem() { return this.operator.carriedItemInstanceId ? findEntity(this.entities, this.operator.carriedItemInstanceId) : null; }
  getTimeLabel() { const total = Math.floor(this.clockMinutes) % 1440, h = Math.floor(total / 60), m = total % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
  getDayPhase() { const h = (this.clockMinutes / 60) % 24; return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening"; }
  pushMessage(text, duration = 2.1) { this.messages = this.messages.filter(m => m.text !== text).slice(-2); this.messages.push({ text, time: duration, duration }); }
  isInWater() { const water = findEntity(this.entities, "culvert_water_01"); return water ? circleRectCollision(this.operator.x, this.operator.y, this.operator.radius, water) : false; }
  updateWetness(delta) {
    const inWater = this.isInWater();
    if (inWater) {
      this.waterExposure += delta;
      const held = this.getHeldItem();
      if (this.waterExposure > .8 && held) {
        const def = getItemDefinition(held.definitionId);
        if (def.wettable && held.condition !== "wet") { held.condition = "wet"; this.pushMessage(`${held.name} soaked through`, 2.4); this.emitEvent("itemBecameWet", held); }
      }
    } else this.waterExposure = Math.max(0, this.waterExposure - delta * 2);
  }

  update(delta, move) {
    this.clockMinutes = (this.clockMinutes + delta * this.timeScale) % 1440;
    updateActors(this, delta);
    this.incident.update(delta);
    this.excursion.update(delta);
    this.operations.update(delta);
    for (const bird of this.wildlife) { bird.phase += delta * bird.speed * .1; bird.x += Math.cos(bird.phase) * delta * bird.speed; bird.y += Math.sin(bird.phase * .7) * delta * bird.speed * .35; }

    this.ensureOperatorSafe("automatic collision recovery", true);
    const op = this.operator, effectiveMove = op.lockedByInteraction ? { x: 0, y: 0 } : move, held = this.getHeldItem(), heldDef = held ? getItemDefinition(held.definitionId) : null;
    const water = findEntity(this.entities, "culvert_water_01"), waterSlow = this.isInWater() ? (water?.depth === "rising" ? .42 : .55) : 1;
    const speedMultiplier = (this.assistedActorId ? .48 : 1) * (heldDef?.movementMultiplier ?? 1) * waterSlow;
    const targetVx = effectiveMove.x * op.moveSpeed * speedMultiplier, targetVy = effectiveMove.y * op.moveSpeed * speedMultiplier;
    const rate = Math.hypot(effectiveMove.x, effectiveMove.y) > .01 ? op.acceleration : op.deceleration, maxChange = rate * delta;
    op.vx += clamp(targetVx - op.vx, -maxChange, maxChange);
    op.vy += clamp(targetVy - op.vy, -maxChange, maxChange);
    op.facing = resolveFacing(effectiveMove, op.facing);
    if (Math.hypot(op.vx, op.vy) > 4) op.walkingPhase += delta * 9;
    op.packPulse = Math.max(0, op.packPulse - delta * 4);
    this.#moveAxis("x", op.vx * delta);
    this.#moveAxis("y", op.vy * delta);
    this.#updateEntityAnimations(delta);
    this.updateWetness(delta);
    const now = performance.now();
    for (const entity of this.entities) if (entity.type === "item" && entity.locationType === "world" && !entity.revealed && entity.revealAt && now >= entity.revealAt) { entity.revealed = true; this.emitEvent("itemRevealed", entity); }
    const battery = findEntity(this.entities, "battery_001");
    if (!this.objectiveSecured && battery && (battery.locationType === "backpack" || battery.locationType === "hands")) { this.objectiveSecured = true; this.pushMessage("Radio battery secured", 3); }
    this.interaction.update(delta);
    for (const message of this.messages) message.time -= delta;
    this.messages = this.messages.filter(m => m.time > 0);
  }

  #updateEntityAnimations(delta) {
    for (const entity of this.entities) {
      if (entity.type !== "door" && entity.type !== "container") continue;
      const duration = entity.type === "door" ? .24 : .3;
      if (entity.state === "opening") { entity.animation = Math.min(1, (entity.animation || 0) + delta / duration); if (entity.animation >= 1) entity.state = "open"; }
      else if (entity.state === "closing") { entity.animation = Math.max(0, (entity.animation || 0) - delta / duration); if (entity.animation <= 0) { entity.state = "closed"; if (entity.type === "door") entity.collision = true; } }
    }
  }
  #moveAxis(axis, amount) {
    activateMapBounds(this.map);
    const op = this.operator, previous = op[axis];
    op[axis] += amount;
    op.x = clamp(op.x, op.radius, MAP_WIDTH - op.radius);
    op.y = clamp(op.y, op.radius, MAP_HEIGHT - op.radius);
    const reason = this.getCollisionReason(op.x, op.y, op.radius);
    if (reason) { this.lastCollisionReason = reason; op[axis] = previous; if (axis === "x") op.vx = 0; else op.vy = 0; }
    else this.lastCollisionReason = null;
  }
  isRectBlocked(rect, ignoredEntityId = null, includeOperator = false) {
    activateMapBounds(this.map);
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > MAP_WIDTH || rect.y + rect.height > MAP_HEIGHT) return true;
    if (this.#shedWalls().some(w => rectsOverlap(rect, w))) return true;
    for (const obstacle of this.map.obstacles) if (circleRectCollision(obstacle.x, obstacle.y, obstacle.radius, rect)) return true;
    for (const entity of this.entities) {
      if (entity.id === ignoredEntityId || entity.revealed === false || entity.type === "item" && entity.locationType !== "world") continue;
      if ((entity.collision || entity.type === "item") && rectsOverlap(rect, entity)) return true;
    }
    if (includeOperator && circleRectCollision(this.operator.x, this.operator.y, this.operator.radius, rect)) return true;
    return false;
  }
}
