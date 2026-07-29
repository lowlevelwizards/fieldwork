export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1600;

export const mapData = {
  spawn: { x: 330, y: 800 },
  extraction: { x: 205, y: 800, radius: 105 },
  road: [
    { x: 0, y: 650 },
    { x: 2400, y: 650 },
    { x: 2400, y: 950 },
    { x: 0, y: 950 }
  ],
  shed: {
    x: 1450,
    y: 520,
    width: 360,
    height: 280,
    wallThickness: 28,
    doorGap: { side: "bottom", start: 145, width: 74 }
  },
  obstacles: [
    { type: "tree", x: 650, y: 420, radius: 58 },
    { type: "tree", x: 820, y: 1120, radius: 62 },
    { type: "tree", x: 1020, y: 360, radius: 54 },
    { type: "tree", x: 1170, y: 1240, radius: 60 },
    { type: "tree", x: 1940, y: 390, radius: 66 },
    { type: "tree", x: 2070, y: 1110, radius: 60 },
    { type: "tree", x: 2250, y: 520, radius: 56 },
    { type: "rock", x: 520, y: 1220, radius: 44 },
    { type: "rock", x: 1240, y: 470, radius: 38 },
    { type: "rock", x: 1870, y: 1290, radius: 42 }
  ],
  brush: [
    { x: 500, y: 300, radius: 120 },
    { x: 890, y: 1300, radius: 150 },
    { x: 1320, y: 1130, radius: 135 },
    { x: 2100, y: 280, radius: 145 },
    { x: 2200, y: 1320, radius: 135 }
  ]
};
