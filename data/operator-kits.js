export const operatorKits = {
  field_operator_basic: {
    id: "field_operator_basic",
    palette: {
      skin: "#d3bea1",
      hair: "#3d443d",
      headwear: "#394238",
      helmetRear: "#2c342e",
      torso: "#26372e",
      trousers: "#30372f",
      boots: "#1f2822",
      belt: "#202b25",
      webbing: "#7b6848",
      rigPouch: "#67593f",
      backpack: "#2c3b31",
      backpackFlap: "#3a4a3d",
      bedroll: "#766248",
      weaponWood: "#78583b",
      weaponMetal: "#303936",
      weaponButt: "#4d3928",
      hand: "#d3bea1",
      accent: "#547493"
    }
  }
};

export function getOperatorKit(kitId) {
  const kit = operatorKits[kitId];
  if (!kit) throw new Error(`Unknown operator kit: ${kitId}`);
  return kit;
}
