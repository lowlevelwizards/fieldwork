import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;
    this.followStrength = 8;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  snapTo(target) {
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;
    this.#clamp();
  }

  update(target, delta) {
    const desiredX = target.x - this.width / 2;
    const desiredY = target.y - this.height / 2;
    const t = 1 - Math.exp(-this.followStrength * delta);
    this.x += (desiredX - this.x) * t;
    this.y += (desiredY - this.y) * t;
    this.#clamp();
  }

  #clamp() {
    this.x = Math.max(0, Math.min(MAP_WIDTH - this.width, this.x));
    this.y = Math.max(0, Math.min(MAP_HEIGHT - this.height, this.y));
  }
}
