export const operatorKits = {
  field_operator_basic: {
    id: "field_operator_basic",
    palette: {
      skin: "#d3bea1",
      hair: "#3d443d",
      headwear: "#42493f",
      torso: "#263329",
      trousers: "#30372f",
      boots: "#202721",
      webbing: "#806e50",
      backpack: "#2a382f",
      backpackFlap: "#35463a",
      bedroll: "#77664c",
      weaponWood: "#795b3e",
      weaponMetal: "#343c38",
      hand: "#d3bea1",
      accent: "#d99a4a"
    }
  }
};

export function getOperatorKit(kitId) {
  const kit = operatorKits[kitId];
  if (!kit) throw new Error(`Unknown operator kit: ${kitId}`);
  return kit;
}
