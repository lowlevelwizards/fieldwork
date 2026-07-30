export const itemDefinitions = {
  radio_battery: { id: "radio_battery", name: "Radio Battery", category: "Utility", sizePips: 3, description: "A heavy rechargeable battery used by portable field-radio equipment.", color: "#56615b", accent: "#8c8b72", waterResistance: "sealed" },
  bandage: { id: "bandage", name: "Bandage", category: "Medical", sizePips: 1, description: "A clean wrapped field dressing.", color: "#d7d1bd", accent: "#9c5f56", wettable: true },
  compass: { id: "compass", name: "Compass", category: "Tool", sizePips: 1, description: "A simple lensatic compass in a folding metal case.", color: "#4b554d", accent: "#d0b36f", waterResistance: "sealed" },
  water_bottle: { id: "water_bottle", name: "Water Bottle", category: "Supply", sizePips: 2, description: "A dented reusable bottle, mostly full.", color: "#61777a", accent: "#b8c7bd", waterResistance: "sealed" },
  rope_bundle: { id: "rope_bundle", name: "Rope Bundle", category: "Tool", sizePips: 2, description: "A short coil of utility rope.", color: "#8a704d", accent: "#b49a6c", wettable: true },
  service_case: { id: "service_case", name: "Sealed Service Cable Case", category: "Recovered Cargo", sizePips: 99, description: "A sealed case of replacement service cable. Too bulky for the field pack.", color: "#4b5548", accent: "#d28b42", backpackEligible: false, carryType: "two_handed", movementMultiplier: 0.62, waterResistance: "sealed" }
};

export function getItemDefinition(definitionId) {
  const definition = itemDefinitions[definitionId];
  if (!definition) throw new Error(`Unknown item definition: ${definitionId}`);
  return definition;
}
