import { getItemDefinition } from "../data/items.js";
import { findEntity } from "./world-entities.js";

export function backpackUsedPips(game) {
  return game.backpack.itemInstanceIds.reduce((total, id) => {
    const item = findEntity(game.entities, id);
    return total + (item ? getItemDefinition(item.definitionId).sizePips : 0);
  }, 0);
}

export function backpackRemainingPips(game) {
  return game.backpack.capacityPips - backpackUsedPips(game);
}

export function canFitInBackpack(game, item) {
  return getItemDefinition(item.definitionId).sizePips <= backpackRemainingPips(game);
}

export function transferItem(game, itemId, destination) {
  const item = findEntity(game.entities, itemId);
  if (!item || item.type !== "item") return { ok: false, reason: "Item missing" };

  if (destination.type === "backpack") {
    if (!canFitInBackpack(game, item)) return { ok: false, reason: "Backpack full" };
  }
  if (destination.type === "hands" && game.operator.carriedItemInstanceId && game.operator.carriedItemInstanceId !== itemId) {
    return { ok: false, reason: "Hands occupied" };
  }

  game.backpack.itemInstanceIds = game.backpack.itemInstanceIds.filter((id) => id !== itemId);
  if (game.operator.carriedItemInstanceId === itemId) game.operator.carriedItemInstanceId = null;

  item.locationType = destination.type;
  item.locationOwnerId = destination.ownerId ?? null;
  item.state = destination.type;

  if (destination.type === "backpack") {
    game.backpack.itemInstanceIds.push(itemId);
  } else if (destination.type === "hands") {
    game.operator.carriedItemInstanceId = itemId;
  } else if (destination.type === "world") {
    item.x = destination.x;
    item.y = destination.y;
    item.groundY = item.y + item.height;
  }
  return { ok: true, item };
}

export function validateItemLocations(game) {
  const errors = [];
  const seen = new Map();
  for (const item of game.entities.filter((entity) => entity.type === "item")) {
    let owners = 0;
    if (item.locationType === "world" || item.locationType === "hidden" || item.locationType === "container") owners += 1;
    if (game.operator.carriedItemInstanceId === item.id) owners += 1;
    if (game.backpack.itemInstanceIds.includes(item.id)) owners += 1;
    if (owners !== 1) errors.push(`${item.id}: ${owners} locations`);
    if (seen.has(item.id)) errors.push(`${item.id}: duplicate id`);
    seen.set(item.id, true);
  }
  if (backpackUsedPips(game) > game.backpack.capacityPips) errors.push("Backpack capacity exceeded");
  return errors;
}
