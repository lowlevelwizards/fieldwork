import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js?v=077-presentation-isolation-20260730";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = Math.max(1, window.visualViewport?.width || window.innerWidth || 1);
    this.height = Math.max(1, window.visualViewport?.height || window.innerHeight || 1);
  }

  resize(width, height) {
    const fallbackWidth = window.visualViewport?.width || window.innerWidth || 1;
    const fallbackHeight = window.visualViewport?.height || window.innerHeight || 1;
    this.width = Number.isFinite(width) && width >= 100 ? width : fallbackWidth;
    this.height = Number.isFinite(height) && height >= 100 ? height : fallbackHeight;
    this.#clamp();
  }

  snapTo(target) { this.lockTo(target); }

  lockTo(target) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;
    this.#clamp();
  }

  update(target) { this.lockTo(target); }

  contains(target, margin = 0) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
    return target.x >= this.x - margin &&
      target.x <= this.x + this.width + margin &&
      target.y >= this.y - margin &&
      target.y <= this.y + this.height + margin;
  }

  #clamp() {
    const maxX = Math.max(0, MAP_WIDTH - this.width);
    const maxY = Math.max(0, MAP_HEIGHT - this.height);
    this.x = Number.isFinite(this.x) ? Math.max(0, Math.min(maxX, this.x)) : 0;
    this.y = Number.isFinite(this.y) ? Math.max(0, Math.min(maxY, this.y)) : 0;
  }
}
