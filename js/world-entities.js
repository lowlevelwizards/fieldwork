import { getItemDefinition } from "../data/items.js?v=081-perception-presentation-20260730";

const ITEM_SIZES = {
  radio_battery: [28, 18],
  bandage: [22, 14],
  compass: [18, 18],
  water_bottle: [18, 28],
  rope_bundle: [26, 18],
  service_case: [68, 34]
};

const ACTION_PRIORITY = {
  USE_MISSION_ITEM: 120,
  DEPOSIT: 115,
  CARE: 105,
  OBJECTIVE: 85,
  TALK: 50,
  GENERIC: 20
};

const REQUIRED_ITEMS = [
  { definitionId: "radio_battery", fallbackId: "battery_fallback_001", x: 1325, y: 470 },
  { definitionId: "bandage", fallbackId: "bandage_fallback_001", x: 1370, y: 470 },
  { definitionId: "water_bottle", fallbackId: "water_fallback_001", x: 1410, y: 470 },
  { definitionId: "rope_bundle", fallbackId: "rope_fallback_001", x: 1450, y: 470 }
];

function makeItem(id, definitionId, x, y, locationType, ownerId = null, visibility = "visible") {
  const def = getItemDefinition(definitionId);
  const [width, height] = ITEM_SIZES[definitionId];
  return {
    id, type: "item", name: def.name, definitionId, x, y, width, height,
    groundY: y + height, interactionRadius: 82, collision: false,
    state: locationType, locationType, locationOwnerId: ownerId,
    visibility, revealed: visibility === "visible", priority: 42, condition: "dry"
  };
}

function makeContainer({
  id, containerType, name, x, y, width, height, searchDuration = 1.4,
  itemInstanceIds = [], state = "closed", collision = true, priority = 26, anchors = []
}) {
  return {
    id, type: "container", containerType, name, x, y, width, height,
    groundY: y + height, interactionRadius: 94, collision, state,
    animation: state === "open" ? 1 : 0, searchProgress: 0, searchDuration,
    searched: false, priority, itemInstanceIds, anchors
  };
}

function makeProp({
  id, propType, name, x, y, width, height, interaction = null, text = "",
  collision = false, priority = 8, revealed = true
}) {
  return {
    id, type: "prop", propType, name, x, y, width, height,
    groundY: y + height, interactionRadius: 96, collision,
    interaction, text, priority, revealed
  };
}

export const siteLayouts = [
  { id: "A", battery: "locker_01", compass: "crate_01", bandage2: "duffel_01" },
  { id: "B", battery: "locker_01", compass: "crate_01", bandage2: "tote_01" },
  { id: "C", battery: "locker_01", compass: "crate_01", bandage2: "tote_01" }
];

function ensureRequiredItems(entities) {
  const containerIds = new Set(
    entities.filter(entity => entity.type === "container").map(entity => entity.id)
  );

  for (const required of REQUIRED_ITEMS) {
    const accessible = entities.some(entity => {
      if (entity.type !== "item" || entity.definitionId !== required.definitionId) return false;
      if (["consumed", "stored"].includes(entity.locationType)) return false;
      if (entity.locationType === "world") return true;
      return entity.locationType === "container" && containerIds.has(entity.locationOwnerId);
    });

    if (!accessible) {
      console.warn(`Missing accessible required item ${required.definitionId}; placing visible fallback`);
      entities.push(makeItem(
        required.fallbackId,
        required.definitionId,
        required.x,
        required.y,
        "world",
        null,
        "visible"
      ));
    }
  }
}

export function createWorldEntities(map, layoutIndex = 0) {
  const layout = siteLayouts[layoutIndex % siteLayouts.length];
  const s = map.shed;
  const doorX = s.x + s.doorGap.start;
  const doorY = s.y + s.height - s.wallThickness;

  const containers = [
    makeContainer({ id: "crate_01", containerType: "crate", name: "Supply Crate", x: s.x + 62, y: s.y + 116, width: 78, height: 52, searchDuration: 1.25, anchors: [{ x: 12, y: 43 }, { x: 42, y: 44 }, { x: 66, y: 42 }] }),
    makeContainer({ id: "locker_01", containerType: "locker", name: "Metal Locker", x: s.x + 260, y: s.y + 54, width: 60, height: 122, searchDuration: 1.85, anchors: [{ x: 12, y: 89 }, { x: 35, y: 92 }, { x: 24, y: 62 }] }),
    makeContainer({ id: "tote_01", containerType: "tote", name: "Storage Tote", x: 1270, y: 530, width: 70, height: 42, searchDuration: .95, anchors: [{ x: 15, y: 34 }, { x: 49, y: 35 }, { x: 32, y: 22 }] }),
    // Moved clear of Ada and the table interaction cluster.
    makeContainer({ id: "duffel_01", containerType: "duffel", name: "Duffel Bag", x: 1470, y: 1190, width: 72, height: 36, searchDuration: .8, collision: false, priority: 30, anchors: [{ x: 18, y: 27 }, { x: 50, y: 27 }] }),
    makeContainer({ id: "truck_box_01", containerType: "truck_box", name: "Truck Storage", x: 888, y: 695, width: 92, height: 48, searchDuration: 1.45, anchors: [{ x: 16, y: 38 }, { x: 50, y: 38 }, { x: 76, y: 36 }] }),
    makeContainer({ id: "workbench_drawer_01", containerType: "drawer", name: "Workbench Drawer", x: 1290, y: 438, width: 94, height: 38, searchDuration: 1.2, anchors: [{ x: 20, y: 31 }, { x: 61, y: 31 }, { x: 42, y: 18 }] })
  ];

  const placement = new Map();
  const add = (containerId, itemId, definitionId, visibility = "hidden") => {
    if (!placement.has(containerId)) placement.set(containerId, []);
    placement.get(containerId).push({ itemId, definitionId, visibility });
  };

  // Required set exists in every layout; only the container varies.
  add(layout.battery, "battery_001", "radio_battery");
  add(layout.compass, "compass_001", "compass");
  add("tote_01", "bandage_001", "bandage");
  add("duffel_01", "water_001", "water_bottle");
  add("workbench_drawer_01", "rope_001", "rope_bundle");
  add(layout.bandage2, "bandage_002", "bandage");

  const items = [];
  for (const container of containers) {
    const assigned = placement.get(container.id) ?? [];
    container.itemInstanceIds = assigned.map(entry => entry.itemId);
    assigned.forEach((entry, index) => {
      const anchor = container.anchors[index] ?? { x: 18 + index * 24, y: container.height - 8 };
      items.push(makeItem(
        entry.itemId,
        entry.definitionId,
        container.x + anchor.x,
        container.y + anchor.y,
        "container",
        container.id,
        entry.visibility
      ));
    });
  }

  items.push(makeItem("water_visible_01", "water_bottle", 1388, 448, "world"));
  items.push(makeItem("service_case_01", "service_case", 3990, 760, "world"));

  const entities = [
    { id: "shed_door_01", type: "door", name: "Shed Door", x: doorX, y: doorY, width: s.doorGap.width, height: s.wallThickness, groundY: doorY + s.wallThickness, interactionRadius: 92, collision: true, state: "closed", animation: 0, priority: 34 },
    ...containers,
    ...items,
    makeProp({ id: "trail_sign_01", propType: "sign", name: "North Route Board", x: 2220, y: 1000, width: 92, height: 88, interaction: "read", collision: true, priority: 24, text: "NORTH CULVERT\n\nDrainage obstruction reported. Suggested: rope, water, compass, basic medical supply." }),
    makeProp({ id: "radio_cradle_01", propType: "radio", name: "Empty Radio Cradle", x: 1410, y: 430, width: 58, height: 34, interaction: "examine", text: "A clean rectangle marks where a field radio once sat. The battery lead is still connected." }),
    makeProp({ id: "truck_01", propType: "truck", name: "Maintenance Truck", x: 720, y: 650, width: 340, height: 158, interaction: "examine", collision: true, text: "The cab is empty. The rear storage box is still latched." }),
    makeProp({ id: "picnic_01", propType: "picnic", name: "Break Table", x: 1120, y: 1110, width: 300, height: 120, interaction: "examine", collision: true, priority: 4, text: "A ring from a metal cup stains the tabletop." }),
    makeProp({ id: "shelf_01", propType: "shelf", name: "Open Shelf", x: 1360, y: 392, width: 130, height: 72, interaction: "examine", collision: true, text: "Most of the shelf has been cleared. One bottle was left behind." }),
    makeProp({ id: "culvert_marker_01", propType: "sign", name: "North Culvert Marker", x: 3650, y: 690, width: 74, height: 76, interaction: "examine", collision: true, text: "Marker 7N. The waterline is well above the painted service mark." }),
    makeProp({ id: "culvert_inspect_01", propType: "culvert", name: "Blocked Culvert", x: 3890, y: 900, width: 170, height: 120, interaction: "inspect_culvert", collision: true, priority: 54, text: "Branches and silt choke the grate." }),
    makeProp({ id: "culvert_debris_01", propType: "debris", name: "Branch Fall", x: 3720, y: 930, width: 180, height: 62, interaction: "debris", collision: true, priority: 62, text: "The debris could be pulled clear with rope." }),
    { id: "culvert_water_01", type: "hazard", hazardType: "water", name: "Flooded Crossing", x: map.culvert.water.x, y: map.culvert.water.y, width: map.culvert.water.width, height: map.culvert.water.height, groundY: map.culvert.water.y + map.culvert.water.height, interactionRadius: 0, collision: false, depth: "shallow", revealed: true },
    makeProp({ id: "hazard_marker_01", propType: "marker", name: "Hazard Marker", x: 3690, y: 840, width: 38, height: 54, collision: false, revealed: false }),
    makeProp({ id: "return_branch_01", propType: "debris", name: "Fresh Fallen Branch", x: 3100, y: 1045, width: 210, height: 58, interaction: "examine", collision: false, revealed: false, text: "Fresh break. The rain brought it down after you passed." }),
    makeProp({ id: "recovery_area_01", propType: "recovery", name: "Recovered Supplies Area", x: 350, y: 1000, width: 190, height: 90, interaction: "examine", collision: false, priority: 58, text: "A dry patch beside the return zone is reserved for recovered cargo." })
  ];

  ensureRequiredItems(entities);
  return entities;
}

export function findEntity(entities, id) {
  return entities.find(entity => entity.id === id) ?? null;
}

export function getAvailableAction(entity, game) {
  if (!entity || entity.revealed === false) return null;
  const held = game.getHeldItem();

  if (entity.type === "actor") {
    if (entity.id === "worker_ada") {
      if (!entity.assessed) return { id: "assess", label: "Assess", priority: ACTION_PRIORITY.CARE };
      if (held?.definitionId === "bandage" && !game.incident.bandageUsed) return { id: "use_bandage", label: "Bandage", priority: ACTION_PRIORITY.USE_MISSION_ITEM };
      if (held?.definitionId === "water_bottle" && !game.incident.waterUsed) return { id: "give_water", label: "Give Water", priority: ACTION_PRIORITY.USE_MISSION_ITEM };
      if (game.incident.bandageUsed && !game.incident.workerSheltered && !game.assistedActorId) return { id: "assist", label: "Assist", priority: ACTION_PRIORITY.CARE };
      if (game.assistedActorId === entity.id) return { id: "release_assist", label: "Let Go", priority: ACTION_PRIORITY.CARE };
      const encounter = game.encounters?.getActorEncounter?.(entity.id);
    return {
      id: "talk",
      label: encounter ? (encounter.state === "challenging" ? "Respond" : encounter.state === "blocking" ? "Confront" : "Talk") : "Talk",
      priority: encounter ? ACTION_PRIORITY.OBJECTIVE : ACTION_PRIORITY.TALK
    };
    }
    return { id: "talk", label: "Talk", priority: ACTION_PRIORITY.TALK };
  }

  if (entity.type === "door") {
    if (entity.state === "closed") return { id: "open", label: "Open", priority: 45 };
    if (entity.state === "open") return { id: "close", label: "Close", priority: 45 };
  }

  if (entity.type === "container") {
    if (entity.state === "closed") return { id: "open_container", label: "Open", priority: 45 };
    if (entity.state === "open" && !entity.searched) return { id: "search", label: "Search", hold: true, priority: 55 };
    if (entity.state === "open" && entity.searched) return { id: "close_container", label: "Close", priority: 35 };
  }

  // Held-item actions are resolved before any generic prop interaction.
  if (entity.id === "radio_cradle_01" && !game.incident.radioRestored && held?.definitionId === "radio_battery") {
    return { id: "install_battery", label: "Install Battery", priority: ACTION_PRIORITY.USE_MISSION_ITEM };
  }

  if (entity.id === "recovery_area_01" && held?.definitionId === "service_case") {
    return { id: "deposit_service_case", label: "Deposit Case", priority: ACTION_PRIORITY.DEPOSIT };
  }

  if (entity.id === "culvert_debris_01") {
    if (held?.definitionId === "rope_bundle" && game.excursion.obstructionState !== "cleared") {
      return { id: "clear_debris", label: game.excursion.culvertInspected ? "Rig Rope" : "Inspect & Rig Rope", priority: ACTION_PRIORITY.USE_MISSION_ITEM };
    }
    if (game.excursion.culvertInspected && game.excursion.obstructionState === "unknown") {
      return { id: "mark_hazard", label: "Mark Hazard", priority: ACTION_PRIORITY.OBJECTIVE };
    }
  }

  if (entity.id === "culvert_inspect_01" && ["outbound", "at_destination"].includes(game.excursion.state)) {
    return { id: "inspect_culvert", label: "Inspect Culvert", priority: ACTION_PRIORITY.OBJECTIVE };
  }

  if (entity.id === "trail_sign_01" && game.excursion.available) {
    return { id: "review_route", label: "Read Route Board", priority: 35 };
  }

  if (entity.type === "prop" && entity.interaction) {
    return {
      id: entity.interaction,
      label: entity.interaction === "read" ? "Read" : "Examine",
      priority: ACTION_PRIORITY.GENERIC
    };
  }

  if (entity.type === "item" && entity.locationType === "world" && entity.revealed) {
    const def = getItemDefinition(entity.definitionId);
    if (def.backpackEligible === false && !game.operator.carriedItemInstanceId) return { id: "take", label: "Lift", priority: 65 };
    const used = game.inventory?.getUsedPips?.() ?? 0;
    if (def.backpackEligible !== false && used + def.sizePips <= game.backpack.capacityPips) return { id: "pack", label: "Pack", priority: 60 };
    if (!game.operator.carriedItemInstanceId) return { id: "take", label: "Take", priority: 60 };
    return { id: "occupied", label: "Hands Occupied", disabled: true, priority: 5 };
  }

  return null;
}
