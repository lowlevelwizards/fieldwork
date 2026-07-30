import { getItemDefinition } from "../data/items.js";
import { findEntity } from "./world-entities.js";
import { backpackUsedPips, transferItem } from "./item-locations.js";

function facingVector(facing) {
  if (facing === "up") return { x: 0, y: -1 };
  if (facing === "down") return { x: 0, y: 1 };
  if (facing === "left") return { x: -1, y: 0 };
  return { x: 1, y: 0 };
}

export class InventorySystem {
  constructor(game) {
    this.game = game;
  }

  getUsedPips() { return backpackUsedPips(this.game); }
  getItems() { return this.game.backpack.itemInstanceIds.map((id) => findEntity(this.game.entities, id)).filter(Boolean); }

  pack(itemId) {
    const item = findEntity(this.game.entities, itemId);
    const result = transferItem(this.game, itemId, { type: "backpack", ownerId: this.game.backpack.id });
    this.game.pushMessage(result.ok ? `${item.name} packed` : result.reason);
    if (result.ok) this.game.operator.packPulse = 1;
    return result.ok;
  }

  hold(itemId) {
    const item = findEntity(this.game.entities, itemId);
    const result = transferItem(this.game, itemId, { type: "hands", ownerId: this.game.operator.id });
    this.game.pushMessage(result.ok ? `${item.name} in hands` : result.reason);
    return result.ok;
  }

  drop(itemId) {
    const item = findEntity(this.game.entities, itemId);
    if (!item) return false;
    const point = this.findDropPoint(item);
    if (!point) {
      this.game.pushMessage("No room to drop");
      return false;
    }
    const result = transferItem(this.game, itemId, { type: "world", x: point.x, y: point.y });
    this.game.pushMessage(result.ok ? `${item.name} dropped` : result.reason);
    return result.ok;
  }

  findDropPoint(item) {
    const op = this.game.operator;
    const forward = facingVector(op.facing);
    const candidates = [
      { x: op.x + forward.x * 48 - item.width / 2, y: op.y + forward.y * 48 - item.height / 2 },
      { x: op.x + 42 - item.width / 2, y: op.y - item.height / 2 },
      { x: op.x - 42 - item.width / 2, y: op.y - item.height / 2 },
      { x: op.x - item.width / 2, y: op.y + 48 - item.height / 2 }
    ];
    return candidates.find((point) => !this.game.isRectBlocked({ x: point.x, y: point.y, width: item.width, height: item.height }, item.id)) ?? null;
  }
}
