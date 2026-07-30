export const MAP_WIDTH = 2600;
export const MAP_HEIGHT = 1700;

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
    trailhead: { x: 530, y: 420 }
  },
  obstacles: [
    { type: "tree", x: 420, y: 280, radius: 58 }, { type: "tree", x: 650, y: 1280, radius: 62 },
    { type: "tree", x: 940, y: 300, radius: 54 }, { type: "tree", x: 1540, y: 1270, radius: 60 },
    { type: "tree", x: 2190, y: 320, radius: 66 }, { type: "tree", x: 2280, y: 1210, radius: 60 },
    { type: "tree", x: 2460, y: 540, radius: 56 }, { type: "rock", x: 430, y: 1240, radius: 44 },
    { type: "rock", x: 1510, y: 330, radius: 38 }, { type: "rock", x: 2020, y: 1360, radius: 42 }
  ],
  brush: [
    { x: 350, y: 260, radius: 120 }, { x: 800, y: 1400, radius: 150 },
    { x: 1500, y: 1450, radius: 135 }, { x: 2260, y: 250, radius: 145 }, { x: 2360, y: 1420, radius: 135 }
  ]
};
