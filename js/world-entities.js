import { getItemDefinition } from "../data/items.js";

function makeItem(id, definitionId, x, y, locationType, ownerId = null) {
  const def = getItemDefinition(definitionId);
  const sizes = {
    radio_battery: [28, 18], bandage: [22, 14], compass: [18, 18], water_bottle: [18, 28], rope_bundle: [26, 18]
  };
  const [width, height] = sizes[definitionId];
  return { id, type: "item", name: def.name, definitionId, x, y, width, height, groundY: y + height, interactionRadius: 74, collision: false, state: locationType, locationType, locationOwnerId: ownerId, priority: 40 };
}

export function createWorldEntities(map) {
  const shed = map.shed;
  const doorX = shed.x + shed.doorGap.start;
  const doorY = shed.y + shed.height - shed.wallThickness;
  const crateId = "shed_crate_01";
  return [
    { id: "shed_door_01", type: "door", name: "Shed Door", x: doorX, y: doorY, width: shed.doorGap.width, height: shed.wallThickness, groundY: doorY + shed.wallThickness, interactionRadius: 92, collision: true, state: "closed", animation: 0, priority: 30 },
    { id: crateId, type: "crate", name: "Storage Crate", x: shed.x + shed.width / 2 - 35, y: shed.y + 86, width: 70, height: 48, groundY: shed.y + 134, interactionRadius: 88, collision: true, state: "unsearched", searchProgress: 0, priority: 20, itemInstanceIds: ["battery_001", "bandage_001", "compass_001"] },
    makeItem("battery_001", "radio_battery", shed.x + shed.width / 2 + 42, shed.y + 146, "container", crateId),
    makeItem("bandage_001", "bandage", shed.x + shed.width / 2 - 7, shed.y + 153, "container", crateId),
    makeItem("compass_001", "compass", shed.x + shed.width / 2 - 42, shed.y + 151, "container", crateId),
    makeItem("water_001", "water_bottle", shed.x + 84, shed.y + 174, "world"),
    makeItem("rope_001", "rope_bundle", shed.x + shed.width - 88, shed.y + 176, "world")
  ];
}

export function findEntity(entities, id) { return entities.find((entity) => entity.id === id) ?? null; }

export function getAvailableAction(entity, game) {
  if (!entity) return null;
  if (entity.type === "door") {
    if (entity.state === "closed") return { id: "open", label: "Open" };
    if (entity.state === "open") return { id: "close", label: "Close" };
  }
  if (entity.type === "crate" && entity.state === "unsearched") return { id: "search", label: "Search", hold: true };
  if (entity.type === "item" && entity.locationType === "world") {
    const def = getItemDefinition(entity.definitionId);
    const used = game.inventory?.getUsedPips?.() ?? 0;
    if (used + def.sizePips <= game.backpack.capacityPips) return { id: "pack", label: "Pack" };
    if (!game.operator.carriedItemInstanceId) return { id: "take", label: "Take" };
    return { id: "occupied", label: "Backpack Full", disabled: true };
  }
  return null;
}
