import { findEntity, getAvailableAction } from "./world-entities.js";
import { transferItem } from "./item-locations.js";

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
    this.previousTargetId = null;
  }

  update(delta) {
    if (this.searchingEntityId) {
      const entity = findEntity(this.game.entities, this.searchingEntityId);
      if (!entity || distanceToEntity(this.game.operator, entity) > entity.interactionRadius + 14) this.cancelSearch("Search interrupted");
      else {
        entity.searchProgress = Math.min(1, entity.searchProgress + delta / entity.searchDuration);
        this.game.operator.searchPose = Math.sin(entity.searchProgress * Math.PI * 7) * 0.5 + 0.5;
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
    for (const entity of [...this.game.entities, ...this.game.actors]) {
      const action = getAvailableAction(entity, this.game);
      if (!action) continue;
      const cx = entity.x + entity.width / 2;
      const cy = entity.y + entity.height / 2;
      const dx = cx - op.x;
      const dy = cy - op.y;
      const distance = Math.hypot(dx, dy);
      if (distance > entity.interactionRadius) continue;
      const dot = distance > 0 ? (dx / distance) * forward.x + (dy / distance) * forward.y : 1;
      const facingPenalty = dot < -0.35 ? 48 : dot < 0.15 ? 13 : 0;
      const stickyBonus = entity.id === this.previousTargetId ? 14 : 0;
      const itemBonus = entity.type === "item" ? 4 : 0;
      candidates.push({ entity, action, score: distance + facingPenalty - (entity.priority || 0) - stickyBonus - itemBonus });
    }
    candidates.sort((a, b) => a.score - b.score || a.entity.id.localeCompare(b.entity.id));
    const winner = candidates[0] ?? null;
    this.targetId = winner?.entity.id ?? null;
    this.activeAction = winner?.action ?? null;
    this.previousTargetId = this.targetId;
  }

  trigger() {
    if (!this.targetId || !this.activeAction || this.activeAction.disabled) return false;
    const entity = findEntity([...this.game.entities, ...this.game.actors], this.targetId);
    if (!entity) return false;
    const action = this.activeAction.id;

    if (action === "assess") {
      entity.assessed = true;
      this.game.assessmentRequest = { actor: entity, text: "Conscious. Bleeding from the lower leg. Needs a clean bandage. Can move with assistance once stabilized." };
      this.game.emitEvent("assess", entity); return true;
    }
    if (action === "use_bandage") return this.game.incident.applyBandage();
    if (action === "give_water") return this.game.incident.giveWater();
    if (action === "assist") return this.game.incident.beginAssist();
    if (action === "release_assist") { this.game.assistedActorId = null; this.game.pushMessage("Ada sits back down"); entity.seated = true; return true; }
    if (action === "install_battery") return this.game.incident.installBattery();
    if (action === "talk") { this.game.openDialogue(entity); return true; }
    if (action === "open") {
      entity.state = "opening"; entity.collision = false; this.game.emitEvent("doorOpened", entity); this.game.pushMessage("Door opened"); return true;
    }
    if (action === "close") {
      const doorway = { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
      if (this.game.isRectBlocked(doorway, entity.id, true)) { this.game.pushMessage("Door blocked"); return false; }
      entity.state = "closing"; this.game.emitEvent("doorClosed", entity); this.game.pushMessage("Door closed"); return true;
    }
    if (action === "open_container") {
      entity.state = "opening"; this.game.emitEvent("containerOpened", entity); return true;
    }
    if (action === "close_container") {
      entity.state = "closing"; this.game.emitEvent("containerClosed", entity); return true;
    }
    if (action === "search") {
      this.searchingEntityId = entity.id; entity.state = "searching"; entity.searchProgress = 0;
      this.game.operator.lockedByInteraction = true; this.game.operator.searchTargetId = entity.id;
      this.game.emitEvent("searchStarted", entity); return true;
    }
    if (action === "read" || action === "examine") {
      this.game.openWorldText(entity, action); return true;
    }
    if (action === "pack") return this.game.inventory.pack(entity.id);
    if (action === "take") {
      const result = transferItem(this.game, entity.id, { type: "hands", ownerId: this.game.operator.id });
      this.game.pushMessage(result.ok ? `${entity.name} taken` : result.reason);
      if (result.ok) this.game.emitEvent("itemTaken", entity);
      return result.ok;
    }
    return false;
  }

  dropCarriedItem() { const id = this.game.operator.carriedItemInstanceId; return id ? this.game.inventory.drop(id) : false; }

  cancelSearch(message = null) {
    const entity = findEntity(this.game.entities, this.searchingEntityId);
    if (entity) { entity.state = "open"; entity.searchProgress = 0; }
    this.searchingEntityId = null; this.game.operator.lockedByInteraction = false; this.game.operator.searchPose = 0; this.game.operator.searchTargetId = null;
    if (message) this.game.pushMessage(message);
  }

  completeSearch(container) {
    container.state = "open"; container.searched = true; container.searchProgress = 1;
    this.searchingEntityId = null; this.game.operator.lockedByInteraction = false; this.game.operator.searchPose = 0; this.game.operator.searchTargetId = null;
    const ids = [...container.itemInstanceIds];
    ids.forEach((id, index) => {
      const item = findEntity(this.game.entities, id);
      if (!item) return;
      const anchor = container.anchors[index] ?? { x: 18 + index * 26, y: container.height - 7 };
      item.x = container.x + anchor.x; item.y = container.y + anchor.y; item.groundY = item.y + item.height;
      item.locationType = "world"; item.locationOwnerId = null; item.state = "world"; item.revealed = false;
      item.revealAt = performance.now() + index * 180;
    });
    container.itemInstanceIds = [];
    const count = ids.length;
    this.game.pushMessage(count ? `${count} ${count === 1 ? "item" : "items"} found` : "Nothing useful");
    this.game.emitEvent("searchCompleted", container);
  }

  getTarget() { return findEntity([...this.game.entities, ...this.game.actors], this.targetId); }
}
