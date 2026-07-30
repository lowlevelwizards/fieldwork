export const MAP_WIDTH = 4400;
export const MAP_HEIGHT = 2000;

export const mapData = {
  spawn: { x: 300, y: 850 },
  extraction: { x: 185, y: 850, radius: 100 },
  road: [{ x: 0, y: 700 }, { x: 2600, y: 700 }, { x: 2600, y: 1000 }, { x: 0, y: 1000 }],
  shed: { x: 1660, y: 430, width: 370, height: 300, wallThickness: 28, doorGap: { side: "bottom", start: 148, width: 76 } },
  site: {
    name: "Old Maintenance Pull-Off",
    workArea: { x: 1180, y: 390, width: 360, height: 250 },
    truck: { x: 720, y: 660, width: 340, height: 150 },
    breakArea: { x: 1110, y: 1120, width: 330, height: 190 },
    trailhead: { x: 2260, y: 1060 }
  },
  places: {
    pull_off: { id: "pull_off", name: "Old Maintenance Pull-Off", bounds: { x: 0, y: 250, width: 2500, height: 1350 } },
    north_culvert: { id: "north_culvert", name: "North Culvert", bounds: { x: 3540, y: 500, width: 760, height: 1000 }, arrival: { x: 3810, y: 990, radius: 230 } }
  },
  trail: [
    { x: 2260, y: 1060 }, { x: 2580, y: 1160 }, { x: 2880, y: 1040 },
    { x: 3180, y: 1160 }, { x: 3480, y: 990 }, { x: 3780, y: 990 }
  ],
  culvert: {
    x: 3730, y: 720, width: 430, height: 520,
    water: { x: 3600, y: 885, width: 610, height: 245 },
    crossing: { x: 3670, y: 900, width: 430, height: 180 }
  },
  obstacles: [
    { type: "tree", x: 420, y: 280, radius: 58 }, { type: "tree", x: 650, y: 1280, radius: 62 },
    { type: "tree", x: 940, y: 300, radius: 54 }, { type: "tree", x: 1540, y: 1270, radius: 60 },
    { type: "tree", x: 2190, y: 320, radius: 66 }, { type: "tree", x: 2280, y: 1450, radius: 60 },
    { type: "tree", x: 2460, y: 540, radius: 56 }, { type: "rock", x: 430, y: 1240, radius: 44 },
    { type: "rock", x: 1510, y: 330, radius: 38 }, { type: "rock", x: 2020, y: 1360, radius: 42 },
    { type: "tree", x: 2670, y: 790, radius: 58 }, { type: "tree", x: 2820, y: 1390, radius: 64 },
    { type: "tree", x: 3070, y: 720, radius: 62 }, { type: "tree", x: 3260, y: 1430, radius: 60 },
    { type: "tree", x: 3490, y: 620, radius: 58 }, { type: "tree", x: 4250, y: 680, radius: 62 },
    { type: "rock", x: 2980, y: 910, radius: 38 }, { type: "rock", x: 3380, y: 1260, radius: 44 }
  ],
  brush: [
    { x: 350, y: 260, radius: 120 }, { x: 800, y: 1400, radius: 150 },
    { x: 1500, y: 1450, radius: 135 }, { x: 2260, y: 250, radius: 145 }, { x: 2360, y: 1580, radius: 135 },
    { x: 2650, y: 1480, radius: 130 }, { x: 3030, y: 1510, radius: 145 }, { x: 3320, y: 520, radius: 130 },
    { x: 4050, y: 1450, radius: 150 }
  ]
};
