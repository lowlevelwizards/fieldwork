import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js?v=074-camera-reliability-20260730";

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = Math.max(1, window.innerWidth || 1);
    this.height = Math.max(1, window.innerHeight || 1);
    this.followStrength = 10;
  }

  resize(width, height) {
    const fallbackWidth = window.visualViewport?.width || window.innerWidth || 1;
    const fallbackHeight = window.visualViewport?.height || window.innerHeight || 1;
    this.width = Number.isFinite(width) && width >= 100 ? width : fallbackWidth;
    this.height = Number.isFinite(height) && height >= 100 ? height : fallbackHeight;
    this.#clamp();
  }

  snapTo(target) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    this.x = target.x - this.width / 2;
    this.y = target.y - this.height / 2;
    this.#clamp();
  }

  update(target, delta) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    const desiredX = target.x - this.width / 2;
    const desiredY = target.y - this.height / 2;
    const t = 1 - Math.exp(-this.followStrength * delta);
    this.x += (desiredX - this.x) * t;
    this.y += (desiredY - this.y) * t;
    this.#clamp();
  }

  contains(target, margin = 0) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
    const left = this.x - margin;
    const top = this.y - margin;
    const right = this.x + this.width + margin;
    const bottom = this.y + this.height + margin;
    return target.x >= left && target.x <= right && target.y >= top && target.y <= bottom;
  }

  #clamp() {
    const maxX = Math.max(0, MAP_WIDTH - this.width);
    const maxY = Math.max(0, MAP_HEIGHT - this.height);
    this.x = Number.isFinite(this.x) ? Math.max(0, Math.min(maxX, this.x)) : 0;
    this.y = Number.isFinite(this.y) ? Math.max(0, Math.min(maxY, this.y)) : 0;
  }
}
