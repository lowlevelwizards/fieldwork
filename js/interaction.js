import { findEntity, getAvailableAction } from "./world-entities.js";

function distanceToEntity(operator, entity) {
  const cx = entity.x + entity.width / 2;
  const cy = entity.y + entity.height / 2;
  return Math.hypot(operator.x - cx, operator.y - cy);
}

function facingVector(facing) {
  if (facing === "up") return { x: 0, y: -1 };
  if (facing === "down") return { x: 0, y: 1 };
  if (facing === "left") return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.targetId = null;
    this.activeAction = null;
    this.searchingEntityId = null;
  }

  update(delta) {
    if (this.searchingEntityId) {
      const entity = findEntity(this.game.entities, this.searchingEntityId);
      if (!entity || distanceToEntity(this.game.operator, entity) > entity.interactionRadius + 12) {
        this.cancelSearch("Search interrupted");
      } else {
        entity.searchProgress = Math.min(1, entity.searchProgress + delta / 1.25);
        if (entity.searchProgress >= 1) this.completeSearch(entity);
      }
    }

    this.refreshTarget();
  }

  refreshTarget() {
    if (this.searchingEntityId) {
      this.targetId = this.searchingEntityId;
      this.activeAction = { id: "searching", label: "Searching", disabled: true };
      return;
    }

    const op = this.game.operator;
    const forward = facingVector(op.facing);
    const candidates = [];

    for (const entity of this.game.entities) {
      const action = getAvailableAction(entity, this.game);
      if (!action) continue;
      const cx = entity.x + entity.width / 2;
      const cy = entity.y + entity.height / 2;
      const dx = cx - op.x;
      const dy = cy - op.y;
      const distance = Math.hypot(dx, dy);
      if (distance > entity.interactionRadius) continue;
      const dot = distance > 0 ? (dx / distance) * forward.x + (dy / distance) * forward.y : 1;
      const facingPenalty = dot < -0.35 ? 40 : dot < 0.15 ? 12 : 0;
      candidates.push({ entity, action, score: distance + facingPenalty - (entity.priority || 0) });
    }

    candidates.sort((a, b) => a.score - b.score);
    const winner = candidates[0] ?? null;
    this.targetId = winner?.entity.id ?? null;
    this.activeAction = winner?.action ?? null;
  }

  trigger() {
    if (!this.targetId || !this.activeAction || this.activeAction.disabled) return false;
    const entity = findEntity(this.game.entities, this.targetId);
    if (!entity) return false;

    if (this.activeAction.id === "open") {
      entity.state = "opening";
      entity.collision = false;
      this.game.pushMessage("Door opened");
      return true;
    }

    if (this.activeAction.id === "search") {
      this.searchingEntityId = entity.id;
      entity.state = "searching";
      entity.searchProgress = 0;
      this.game.operator.lockedByInteraction = true;
      return true;
    }

    if (this.activeAction.id === "take") {
      entity.locationType = "carried";
      entity.state = "carried";
      this.game.operator.carriedItemInstanceId = entity.id;
      this.game.pushMessage(`${entity.name} taken`);
      return true;
    }

    return false;
  }

  dropCarriedItem() {
    const op = this.game.operator;
    if (!op.carriedItemInstanceId) return false;
    const entity = findEntity(this.game.entities, op.carriedItemInstanceId);
    if (!entity) return false;

    const offset = facingVector(op.facing);
    entity.x = op.x + offset.x * 42 - entity.width / 2;
    entity.y = op.y + offset.y * 42 - entity.height / 2;
    entity.groundY = entity.y + entity.height;
    entity.locationType = "world";
    entity.state = "world";
    op.carriedItemInstanceId = null;
    this.game.pushMessage(`${entity.name} dropped`);
    return true;
  }

  cancelSearch(message = null) {
    const entity = findEntity(this.game.entities, this.searchingEntityId);
    if (entity) {
      entity.state = "unsearched";
      entity.searchProgress = 0;
    }
    this.searchingEntityId = null;
    this.game.operator.lockedByInteraction = false;
    if (message) this.game.pushMessage(message);
  }

  completeSearch(crate) {
    crate.state = "searched";
    crate.searchProgress = 1;
    this.searchingEntityId = null;
    this.game.operator.lockedByInteraction = false;
    const battery = findEntity(this.game.entities, "battery_001");
    battery.locationType = "world";
    battery.state = "world";
    this.game.pushMessage("Radio Battery found");
  }

  getTarget() {
    return findEntity(this.game.entities, this.targetId);
  }
}
