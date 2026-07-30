import { getItemDefinition } from "../data/items.js";

export function createWorldEntities(map) {
  const shed = map.shed;
  const doorX = shed.x + shed.doorGap.start;
  const doorY = shed.y + shed.height - shed.wallThickness;

  return [
    {
      id: "shed_door_01",
      type: "door",
      name: "Shed Door",
      x: doorX,
      y: doorY,
      width: shed.doorGap.width,
      height: shed.wallThickness,
      groundY: doorY + shed.wallThickness,
      interactionRadius: 92,
      collision: true,
      state: "closed",
      animation: 0,
      priority: 30
    },
    {
      id: "shed_crate_01",
      type: "crate",
      name: "Storage Crate",
      x: shed.x + shed.width / 2 - 35,
      y: shed.y + 86,
      width: 70,
      height: 48,
      groundY: shed.y + 134,
      interactionRadius: 88,
      collision: true,
      state: "unsearched",
      searchProgress: 0,
      priority: 20
    },
    {
      id: "battery_001",
      type: "item",
      name: getItemDefinition("radio_battery").name,
      definitionId: "radio_battery",
      x: shed.x + shed.width / 2 + 42,
      y: shed.y + 146,
      width: 28,
      height: 18,
      groundY: shed.y + 164,
      interactionRadius: 72,
      collision: false,
      state: "hidden",
      locationType: "hidden",
      priority: 40
    }
  ];
}

export function findEntity(entities, id) {
  return entities.find((entity) => entity.id === id) ?? null;
}

export function getAvailableAction(entity, game) {
  if (!entity) return null;
  if (entity.type === "door" && entity.state === "closed") return { id: "open", label: "Open", hold: false };
  if (entity.type === "crate" && entity.state === "unsearched") return { id: "search", label: "Search", hold: true };
  if (entity.type === "item" && entity.locationType === "world") {
    if (game.operator.carriedItemInstanceId) return { id: "occupied", label: "Hands Occupied", disabled: true };
    return { id: "take", label: "Take", hold: false };
  }
  return null;
}
