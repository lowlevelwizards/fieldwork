export const itemDefinitions = {
  radio_battery: {
    id: "radio_battery",
    name: "Radio Battery",
    category: "utility",
    description: "A heavy rechargeable battery used by field radio equipment."
  }
};

export function getItemDefinition(definitionId) {
  const definition = itemDefinitions[definitionId];
  if (!definition) throw new Error(`Unknown item definition: ${definitionId}`);
  return definition;
}
