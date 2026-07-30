import { getItemDefinition } from "../data/items.js";

const ITEM_SIZES = {
  radio_battery: [28, 18], bandage: [22, 14], compass: [18, 18], water_bottle: [18, 28], rope_bundle: [26, 18]
};

function makeItem(id, definitionId, x, y, locationType, ownerId = null, visibility = "visible") {
  const def = getItemDefinition(definitionId);
  const [width, height] = ITEM_SIZES[definitionId];
  return { id, type: "item", name: def.name, definitionId, x, y, width, height, groundY: y + height, interactionRadius: 72, collision: false, state: locationType, locationType, locationOwnerId: ownerId, visibility, revealed: visibility === "visible", priority: 42 };
}

function makeContainer({ id, containerType, name, x, y, width, height, searchDuration = 1.4, itemInstanceIds = [], state = "closed", collision = true, priority = 26, anchors = [] }) {
  return { id, type: "container", containerType, name, x, y, width, height, groundY: y + height, interactionRadius: 94, collision, state, animation: state === "open" ? 1 : 0, searchProgress: 0, searchDuration, searched: false, priority, itemInstanceIds, anchors, revealQueue: [], revealClock: 0 };
}

function makeProp({ id, propType, name, x, y, width, height, interaction = null, text = "", collision = false, priority = 8 }) {
  return { id, type: "prop", propType, name, x, y, width, height, groundY: y + height, interactionRadius: 88, collision, interaction, text, priority };
}

export const siteLayouts = [
  { id: "A", battery: "locker_01", compass: "crate_01", bandage2: "duffel_01" },
  { id: "B", battery: "crate_01", compass: "locker_01", bandage2: "tote_01" },
  { id: "C", battery: "truck_box_01", compass: "crate_01", bandage2: "locker_01" }
];

export function createWorldEntities(map, layoutIndex = 0) {
  const layout = siteLayouts[layoutIndex % siteLayouts.length];
  const s = map.shed;
  const doorX = s.x + s.doorGap.start;
  const doorY = s.y + s.height - s.wallThickness;
  const containers = [
    makeContainer({ id: "crate_01", containerType: "crate", name: "Supply Crate", x: s.x + 62, y: s.y + 116, width: 78, height: 52, searchDuration: 1.25, anchors: [{x:12,y:43},{x:42,y:44},{x:66,y:42}] }),
    makeContainer({ id: "locker_01", containerType: "locker", name: "Metal Locker", x: s.x + 260, y: s.y + 54, width: 60, height: 122, searchDuration: 1.85, anchors: [{x:12,y:89},{x:35,y:92}] }),
    makeContainer({ id: "tote_01", containerType: "tote", name: "Storage Tote", x: 1270, y: 530, width: 70, height: 42, searchDuration: 0.95, anchors: [{x:15,y:34},{x:49,y:35}] }),
    makeContainer({ id: "duffel_01", containerType: "duffel", name: "Duffel Bag", x: 1215, y: 1185, width: 72, height: 36, searchDuration: 0.8, collision: false, anchors: [{x:18,y:27},{x:50,y:27}] }),
    makeContainer({ id: "truck_box_01", containerType: "truck_box", name: "Truck Storage", x: 888, y: 695, width: 92, height: 48, searchDuration: 1.45, anchors: [{x:16,y:38},{x:50,y:38}] }),
    makeContainer({ id: "workbench_drawer_01", containerType: "drawer", name: "Workbench Drawer", x: 1290, y: 438, width: 94, height: 38, searchDuration: 1.2, anchors: [{x:20,y:31},{x:61,y:31}] })
  ];

  const placement = new Map();
  const add = (containerId, itemId, definitionId, visibility = "hidden") => {
    if (!placement.has(containerId)) placement.set(containerId, []);
    placement.get(containerId).push({ itemId, definitionId, visibility });
  };
  add(layout.battery, "battery_001", "radio_battery", "hidden");
  add(layout.compass, "compass_001", "compass", "hidden");
  add("tote_01", "bandage_001", "bandage", "hidden");
  add("duffel_01", "water_001", "water_bottle", "hidden");
  add("workbench_drawer_01", "rope_001", "rope_bundle", "hidden");
  add(layout.bandage2, "bandage_002", "bandage", "hidden");

  const items = [];
  for (const container of containers) {
    const assigned = placement.get(container.id) ?? [];
    container.itemInstanceIds = assigned.map((entry) => entry.itemId);
    assigned.forEach((entry, index) => {
      const anchor = container.anchors[index] ?? { x: 18 + index * 24, y: container.height - 8 };
      items.push(makeItem(entry.itemId, entry.definitionId, container.x + anchor.x, container.y + anchor.y, "container", container.id, entry.visibility));
    });
  }

  // One visible object teaches that not everything needs searching.
  items.push(makeItem("water_visible_01", "water_bottle", 1388, 448, "world", null, "visible"));

  return [
    { id: "shed_door_01", type: "door", name: "Shed Door", x: doorX, y: doorY, width: s.doorGap.width, height: s.wallThickness, groundY: doorY + s.wallThickness, interactionRadius: 92, collision: true, state: "closed", animation: 0, priority: 34 },
    ...containers,
    ...items,
    makeProp({ id: "trail_sign_01", propType: "sign", name: "Route Maintenance Sign", x: 520, y: 390, width: 92, height: 88, interaction: "read", collision: true, priority: 18, text: "NORTH SERVICE ROUTE\n\n□ Clear drainage ditch\n□ Replace repeater battery\n✓ Inspect north culvert\n\nThe lower route is marked closed. Someone has crossed out the date." }),
    makeProp({ id: "radio_cradle_01", propType: "radio", name: "Empty Radio Cradle", x: 1410, y: 430, width: 58, height: 34, interaction: "examine", text: "A clean rectangle marks where a field radio once sat. The battery lead is still connected." }),
    makeProp({ id: "truck_01", propType: "truck", name: "Maintenance Truck", x: 720, y: 650, width: 340, height: 158, interaction: "examine", collision: true, text: "The cab is empty. The keys are gone, but the rear storage box is still latched." }),
    makeProp({ id: "picnic_01", propType: "picnic", name: "Break Table", x: 1120, y: 1110, width: 300, height: 120, interaction: "examine", collision: true, text: "A ring from a metal cup stains the tabletop. Someone left in the middle of a break." }),
    makeProp({ id: "shelf_01", propType: "shelf", name: "Open Shelf", x: 1360, y: 392, width: 130, height: 72, interaction: "examine", collision: true, text: "Most of the shelf has been cleared. One bottle was left behind." })
  ];
}

export function findEntity(entities, id) { return entities.find((entity) => entity.id === id) ?? null; }

export function getAvailableAction(entity, game) {
  if (!entity) return null;
  if (entity.type === "door") {
    if (entity.state === "closed") return { id: "open", label: "Open" };
    if (entity.state === "open") return { id: "close", label: "Close" };
  }
  if (entity.type === "container") {
    if (entity.state === "closed") return { id: "open_container", label: "Open" };
    if (entity.state === "open" && !entity.searched) return { id: "search", label: "Search", hold: true };
    if (entity.state === "open" && entity.searched) return { id: "close_container", label: "Close" };
  }
  if (entity.type === "prop" && entity.interaction) return { id: entity.interaction, label: entity.interaction === "read" ? "Read" : "Examine" };
  if (entity.type === "item" && entity.locationType === "world" && entity.revealed) {
    const def = getItemDefinition(entity.definitionId);
    const used = game.inventory?.getUsedPips?.() ?? 0;
    if (used + def.sizePips <= game.backpack.capacityPips) return { id: "pack", label: "Pack" };
    if (!game.operator.carriedItemInstanceId) return { id: "take", label: "Take" };
    return { id: "occupied", label: "Backpack Full", disabled: true };
  }
  return null;
}
