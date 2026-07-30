export const itemDefinitions = {
  radio_battery: { id: "radio_battery", name: "Radio Battery", category: "Utility", sizePips: 3, description: "A heavy rechargeable battery used by portable field-radio equipment.", color: "#56615b", accent: "#8c8b72" },
  bandage: { id: "bandage", name: "Bandage", category: "Medical", sizePips: 1, description: "A clean wrapped field dressing.", color: "#d7d1bd", accent: "#9c5f56" },
  compass: { id: "compass", name: "Compass", category: "Tool", sizePips: 1, description: "A simple lensatic compass in a folding metal case.", color: "#4b554d", accent: "#d0b36f" },
  water_bottle: { id: "water_bottle", name: "Water Bottle", category: "Supply", sizePips: 2, description: "A dented reusable bottle, mostly full.", color: "#61777a", accent: "#b8c7bd" },
  rope_bundle: { id: "rope_bundle", name: "Rope Bundle", category: "Tool", sizePips: 2, description: "A short coil of utility rope.", color: "#8a704d", accent: "#b49a6c" }
};

export function getItemDefinition(definitionId) {
  const definition = itemDefinitions[definitionId];
  if (!definition) throw new Error(`Unknown item definition: ${definitionId}`);
  return definition;
}
