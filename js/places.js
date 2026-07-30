export function createPlaces(map) {
  return Object.values(map.places).map((place) => ({ ...place, discovered: place.id === "pull_off", visited: place.id === "pull_off", state: "unvisited" }));
}

export function findPlace(places, id) { return places.find((place) => place.id === id) ?? null; }

export function pointInBounds(x, y, bounds) {
  return x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height;
}
