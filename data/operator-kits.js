export const operatorKits = {
  maintenance_worker_orange: {
    id: "maintenance_worker_orange",
    palette: { skin: "#d0b79b", hair: "#3d443d", headwear: "#544b39", helmetRear: "#403a2f", torso: "#6f7756", trousers: "#494c42", boots: "#282d29", belt: "#30362f", webbing: "#d28b42", rigPouch: "#84613e", backpack: "#4b5548", backpackFlap: "#5c6656", bedroll: "#75654c", weaponWood: "#73563d", weaponMetal: "#323b38", weaponButt: "#4c392b", hand: "#d0b79b", accent: "#e09a45" }
  },
  maintenance_worker_yellow: {
    id: "maintenance_worker_yellow",
    palette: { skin: "#c8aa8d", hair: "#363a35", headwear: "#394344", helmetRear: "#2c3435", torso: "#67725d", trousers: "#45483f", boots: "#242a26", belt: "#30362f", webbing: "#c7a449", rigPouch: "#796a45", backpack: "#445046", backpackFlap: "#566258", bedroll: "#71634d", weaponWood: "#73563d", weaponMetal: "#323b38", weaponButt: "#4c392b", hand: "#c8aa8d", accent: "#d5b45b" }
  },
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
