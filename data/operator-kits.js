const REQUIRED_PALETTE_FIELDS = [
  "skin","hair","headwear","helmetRear","torso","trousers","boots","belt",
  "webbing","rigPouch","backpack","backpackFlap","bedroll",
  "weaponWood","weaponMetal","weaponButt","hand","accent"
];

const weapon = {
  weaponWood:"#73563d", weaponMetal:"#323b38", weaponButt:"#4c392b"
};

function kit(id, palette) {
  return { id, palette: { ...weapon, ...palette } };
}

export const operatorKits = {
  maintenance_worker_orange: kit("maintenance_worker_orange", {
    skin:"#d0b79b",hair:"#3d443d",headwear:"#544b39",helmetRear:"#403a2f",
    torso:"#6f7756",trousers:"#494c42",boots:"#282d29",belt:"#30362f",
    webbing:"#d28b42",rigPouch:"#84613e",backpack:"#4b5548",
    backpackFlap:"#5c6656",bedroll:"#75654c",hand:"#d0b79b",accent:"#e09a45"
  }),
  maintenance_worker_yellow: kit("maintenance_worker_yellow", {
    skin:"#c8aa8d",hair:"#363a35",headwear:"#394344",helmetRear:"#2c3435",
    torso:"#67725d",trousers:"#45483f",boots:"#242a26",belt:"#30362f",
    webbing:"#c7a449",rigPouch:"#796a45",backpack:"#445046",
    backpackFlap:"#566258",bedroll:"#71634d",hand:"#c8aa8d",accent:"#d5b45b"
  }),

  commune_rust_green: kit("commune_rust_green", {
    skin:"#d4b89d",hair:"#4a3e39",headwear:"#4f6048",helmetRear:"#39483a",
    torso:"#8a4f3e",trousers:"#4d5745",boots:"#2d2925",belt:"#312d29",
    webbing:"#5e6348",rigPouch:"#433f36",backpack:"#536047",
    backpackFlap:"#657158",bedroll:"#78644d",hand:"#d4b89d",accent:"#d9874c"
  }),
  commune_brown_denim: kit("commune_brown_denim", {
    skin:"#cfae91",hair:"#403936",headwear:"#5c4a3d",helmetRear:"#46382f",
    torso:"#6f5542",trousers:"#4d6372",boots:"#2c2926",belt:"#352f2a",
    webbing:"#3d4038",rigPouch:"#242824",backpack:"#675445",
    backpackFlap:"#786352",bedroll:"#887259",hand:"#cfae91",accent:"#d16f55"
  }),
  commune_green_brown: kit("commune_green_brown", {
    skin:"#c7ab90",hair:"#363b35",headwear:"#45543f",helmetRear:"#334034",
    torso:"#5c674e",trousers:"#66513f",boots:"#282823",belt:"#302e29",
    webbing:"#6b5f45",rigPouch:"#4f4738",backpack:"#4b5945",
    backpackFlap:"#5c6955",bedroll:"#75624c",hand:"#c7ab90",accent:"#c9854b"
  }),
  commune_rust_black: kit("commune_rust_black", {
    skin:"#d2b397",hair:"#423834",headwear:"#5a493d",helmetRear:"#41362f",
    torso:"#92523e",trousers:"#5a4c3d",boots:"#252523",belt:"#292724",
    webbing:"#30332f",rigPouch:"#202320",backpack:"#4c5845",
    backpackFlap:"#5c6955",bedroll:"#77614b",hand:"#d2b397",accent:"#e18a4d"
  }),

  northline_standard_light: kit("northline_standard_light", {
    skin:"#c9ad91",hair:"#343a35",headwear:"#c4a66f",helmetRear:"#aa8c5f",
    torso:"#b89c6c",trousers:"#a88d62",boots:"#443a2e",belt:"#6f5d42",
    webbing:"#957a52",rigPouch:"#806744",backpack:"#9d835b",
    backpackFlap:"#ad9165",bedroll:"#76654d",hand:"#c9ad91",accent:"#d6b260"
  }),
  northline_standard_mid: kit("northline_standard_mid", {
    skin:"#d1b79a",hair:"#3b403a",headwear:"#b69663",helmetRear:"#96784e",
    torso:"#aa8b5d",trousers:"#96784f",boots:"#40372c",belt:"#66533b",
    webbing:"#846a48",rigPouch:"#725b3d",backpack:"#8f754e",
    backpackFlap:"#9e8258",bedroll:"#705f49",hand:"#d1b79a",accent:"#cfa94f"
  }),
  northline_standard_dark: kit("northline_standard_dark", {
    skin:"#c4a98d",hair:"#303732",headwear:"#a88658",helmetRear:"#886a43",
    torso:"#98794f",trousers:"#876b48",boots:"#393127",belt:"#5d4b36",
    webbing:"#765e40",rigPouch:"#654f36",backpack:"#7f6747",
    backpackFlap:"#8e7350",bedroll:"#685844",hand:"#c4a98d",accent:"#c99d45"
  }),

  freelancer_black_gray: kit("freelancer_black_gray", {
    skin:"#c8a98c",hair:"#2f3230",headwear:"#272a29",helmetRear:"#1d201f",
    torso:"#4b4e4d",trousers:"#353938",boots:"#1e201f",belt:"#252726",
    webbing:"#2c2f2e",rigPouch:"#202322",backpack:"#373b3a",
    backpackFlap:"#454948",bedroll:"#5a5147",hand:"#c8a98c",accent:"#f28b3c"
  }),
  freelancer_brown_black: kit("freelancer_brown_black", {
    skin:"#d0b194",hair:"#383633",headwear:"#4b4038",helmetRear:"#352e29",
    torso:"#5a493d",trousers:"#2f302f",boots:"#202120",belt:"#292725",
    webbing:"#33312e",rigPouch:"#242321",backpack:"#3a3835",
    backpackFlap:"#47433f",bedroll:"#625648",hand:"#d0b194",accent:"#ef8d3f"
  }),
  freelancer_gray_brown: kit("freelancer_gray_brown", {
    skin:"#c5a88e",hair:"#343331",headwear:"#565856",helmetRear:"#414342",
    torso:"#656462",trousers:"#55463c",boots:"#252524",belt:"#312f2d",
    webbing:"#4a443f",rigPouch:"#3b3733",backpack:"#554a42",
    backpackFlap:"#63574e",bedroll:"#706052",hand:"#c5a88e",accent:"#e8873c"
  }),
  freelancer_black_brown: kit("freelancer_black_brown", {
    skin:"#d2b599",hair:"#302f2d",headwear:"#303130",helmetRear:"#202221",
    torso:"#3b3c3b",trousers:"#59493e",boots:"#1f201f",belt:"#272624",
    webbing:"#4a4038",rigPouch:"#362f2b",backpack:"#4b4038",
    backpackFlap:"#594b42",bedroll:"#69584a",hand:"#d2b599",accent:"#f09142"
  }),

  field_operator_basic: kit("field_operator_basic", {
    skin:"#d3bea1",hair:"#3d443d",headwear:"#394238",helmetRear:"#2c342e",
    torso:"#26372e",trousers:"#30372f",boots:"#1f2822",belt:"#202b25",
    webbing:"#7b6848",rigPouch:"#67593f",backpack:"#2c3b31",
    backpackFlap:"#3a4a3d",bedroll:"#766248",hand:"#d3bea1",accent:"#547493"
  })
};

export function validateOperatorKits() {
  const errors = [];
  for (const [id, definition] of Object.entries(operatorKits)) {
    for (const field of REQUIRED_PALETTE_FIELDS) {
      if (!definition.palette?.[field]) errors.push(`${id}.${field}`);
    }
  }
  return errors;
}

const paletteErrors = validateOperatorKits();
if (paletteErrors.length) {
  console.error("Incomplete operator kit palettes", paletteErrors);
}

export function getOperatorKit(kitId) {
  const found = operatorKits[kitId];
  if (found) return found;
  console.warn(`Unknown operator kit "${kitId}", using field_operator_basic`);
  return operatorKits.field_operator_basic;
}
