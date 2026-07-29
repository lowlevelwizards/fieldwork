export class InputController {
  constructor({ joystickZone, joystickBase, joystickKnob }) {
    this.joystickZone = joystickZone;
    this.joystickBase = joystickBase;
    this.joystickKnob = joystickKnob;
    this.keys = new Set();
    this.vector = { x: 0, y: 0 };
    this.pointerId = null;
    this.maxRadius = 42;
    this.baseCenter = { x: 0, y: 0 };

    this.#bind();
  }

  #bind() {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        this.keys.add(key);
      }
    }, { passive: false });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });

    this.joystickZone.addEventListener("pointerdown", (event) => {
      if (this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.joystickZone.setPointerCapture(event.pointerId);
      const zoneRect = this.joystickZone.getBoundingClientRect();
      const x = event.clientX - zoneRect.left;
      const y = event.clientY - zoneRect.top;
      this.baseCenter = { x, y };
      this.joystickBase.style.left = `${x - 58}px`;
      this.joystickBase.style.top = `${y - 58}px`;
      this.joystickBase.style.bottom = "auto";
      this.#updatePointer(event.clientX, event.clientY);
    });

    this.joystickZone.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.#updatePointer(event.clientX, event.clientY);
    });

    const release = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.vector.x = 0;
      this.vector.y = 0;
      this.joystickKnob.style.transform = "translate(0px, 0px)";
      this.joystickBase.style.opacity = "0";
    };

    this.joystickZone.addEventListener("pointerup", release);
    this.joystickZone.addEventListener("pointercancel", release);
  }

  #updatePointer(clientX, clientY) {
    const zoneRect = this.joystickZone.getBoundingClientRect();
    let dx = (clientX - zoneRect.left) - this.baseCenter.x;
    let dy = (clientY - zoneRect.top) - this.baseCenter.y;
    const distance = Math.hypot(dx, dy);
    if (distance > this.maxRadius) {
      const scale = this.maxRadius / distance;
      dx *= scale;
      dy *= scale;
    }
    this.vector.x = dx / this.maxRadius;
    this.vector.y = dy / this.maxRadius;
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joystickBase.style.opacity = "1";
  }

  getMoveVector() {
    let x = this.vector.x;
    let y = this.vector.y;

    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }
}
