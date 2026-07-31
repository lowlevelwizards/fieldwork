export class InputController {
  constructor({ joystickBase, joystickKnob }) {
    this.joystickBase = joystickBase;
    this.joystickKnob = joystickKnob;
    this.keys = new Set();
    this.vector = { x: 0, y: 0 };
    this.pointerId = null;
    this.maxRadius = 42;
    this.baseCenter = { x: 0, y: 0 };
    this.#bindKeyboard();
  }

  #bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        this.keys.add(key);
      }
    }, { passive: false });
    window.addEventListener("keyup", (event) => this.keys.delete(event.key.toLowerCase()));
  }

  beginPointer(event) {
    if (this.pointerId !== null) return false;
    this.pointerId = event.pointerId;
    this.baseCenter = { x: event.clientX, y: event.clientY };
    this.joystickBase.style.left = `${event.clientX - 58}px`;
    this.joystickBase.style.top = `${event.clientY - 58}px`;
    this.joystickBase.style.bottom = "auto";
    this.joystickBase.style.opacity = "1";
    this.updatePointer(event);
    return true;
  }

  updatePointer(event) {
    if (event.pointerId !== this.pointerId) return false;
    let dx = event.clientX - this.baseCenter.x;
    let dy = event.clientY - this.baseCenter.y;
    const distance = Math.hypot(dx, dy);
    if (distance > this.maxRadius) {
      const scale = this.maxRadius / distance;
      dx *= scale;
      dy *= scale;
    }
    this.vector.x = dx / this.maxRadius;
    this.vector.y = dy / this.maxRadius;
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    return true;
  }

  endPointer(event) {
    if (event.pointerId !== this.pointerId) return false;
    this.pointerId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.joystickKnob.style.transform = "translate(0px, 0px)";
    this.joystickBase.style.opacity = "0";
    return true;
  }

  getMoveVector() {
    let x = this.vector.x;
    let y = this.vector.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }
}

export class CombatInputController {
  constructor({ touchSurface, aimButton, fireButton, canvas, combat, movementInput, getAimAngle, isBlocked = () => false, isStarted = () => true }) {
    this.touchSurface = touchSurface;
    this.aimButton = aimButton;
    this.fireButton = fireButton;
    this.canvas = canvas;
    this.combat = combat;
    this.movementInput = movementInput;
    this.getAimAngle = getAimAngle;
    this.isBlocked = isBlocked;
    this.isStarted = isStarted;
    this.pointerRoles = new Map();
    this.aimPointerStart = null;
    this.dragThreshold = 7;
    this.#bind();
  }

  #available() { return this.isStarted() && !this.isBlocked(); }
  #isGameTouch(event) {
    return event.pointerType === "touch" && !event.target.closest("button, .inventory-overlay, .inspect-overlay, .dialogue-overlay, .debug-panel");
  }
  #setAngle(event) {
    const angle = this.getAimAngle(event.clientX, event.clientY);
    this.combat.setAimAngle(angle);
  }
  #toggleAim(force = null) {
    if (this.#available()) this.combat.toggleAim(force);
  }

  #assignTouchRole(event) {
    const hasMove = [...this.pointerRoles.values()].includes("move");
    const hasAim = [...this.pointerRoles.values()].includes("aim");
    // Once aim is toggled on, a lone touch anywhere adjusts aim. Otherwise the
    // first touch moves and the second touch aims, regardless of screen side.
    if (this.combat.aiming && !hasAim && !hasMove) return "aim";
    if (!hasMove) return "move";
    if (!hasAim) return "aim";
    return null;
  }

  #bind() {
    this.touchSurface.addEventListener("pointerdown", event => {
      if (!this.#available() || !this.#isGameTouch(event)) return;
      const role = this.#assignTouchRole(event);
      if (!role) return;
      event.preventDefault();
      this.pointerRoles.set(event.pointerId, role);
      try { this.touchSurface.setPointerCapture(event.pointerId); } catch {}
      if (role === "move") {
        this.movementInput.beginPointer(event);
      } else {
        this.aimPointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: false };
        this.#setAngle(event);
      }
    }, { passive: false, capture: true });

    this.touchSurface.addEventListener("pointermove", event => {
      const role = this.pointerRoles.get(event.pointerId);
      if (!role) return;
      event.preventDefault();
      if (role === "move") {
        this.movementInput.updatePointer(event);
      } else {
        const start = this.aimPointerStart;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > this.dragThreshold) {
          start.moved = true;
          if (!this.combat.aiming) this.#toggleAim(true);
        }
        this.#setAngle(event);
      }
    }, { passive: false, capture: true });

    const finishTouch = event => {
      const role = this.pointerRoles.get(event.pointerId);
      if (!role) return;
      event.preventDefault();
      if (role === "move") {
        this.movementInput.endPointer(event);
      } else {
        const start = this.aimPointerStart;
        if (start?.id === event.pointerId) {
          this.#setAngle(event);
          const shortTap = performance.now() - start.time < 360 && !start.moved;
          if (shortTap) this.#toggleAim();
          else if (!this.combat.aiming) this.#toggleAim(true);
          this.aimPointerStart = null;
        }
      }
      this.pointerRoles.delete(event.pointerId);
      try { this.touchSurface.releasePointerCapture(event.pointerId); } catch {}
    };
    this.touchSurface.addEventListener("pointerup", finishTouch, { passive: false, capture: true });
    this.touchSurface.addEventListener("pointercancel", finishTouch, { passive: false, capture: true });

    this.aimButton.addEventListener("pointerdown", event => {
      if (!this.#available()) return;
      event.preventDefault(); event.stopPropagation();
      this.#toggleAim();
    }, { passive: false });

    const startFiring = event => {
      if (!this.#available() || !this.combat.aiming) return;
      event.preventDefault(); event.stopPropagation();
      this.combat.setFireHeld(true);
      this.combat.tryFire();
      try { this.fireButton.setPointerCapture(event.pointerId); } catch {}
    };
    const stopFiring = event => {
      this.combat.setFireHeld(false);
      try { this.fireButton.releasePointerCapture(event.pointerId); } catch {}
    };
    this.fireButton.addEventListener("pointerdown", startFiring, { passive: false });
    this.fireButton.addEventListener("pointerup", stopFiring);
    this.fireButton.addEventListener("pointercancel", stopFiring);

    this.canvas.addEventListener("pointermove", event => {
      if (!this.#available() || event.pointerType === "touch") return;
      this.#setAngle(event);
    });
    this.canvas.addEventListener("contextmenu", event => event.preventDefault());
    this.canvas.addEventListener("pointerdown", event => {
      if (!this.#available() || event.pointerType === "touch") return;
      if (event.button === 2) { event.preventDefault(); this.#toggleAim(); }
      else if (event.button === 0 && this.combat.aiming) {
        event.preventDefault(); this.combat.setFireHeld(true); this.combat.tryFire();
      }
    });
    window.addEventListener("pointerup", event => { if (event.pointerType !== "touch") this.combat.setFireHeld(false); });

    window.addEventListener("keydown", event => {
      if (!this.#available()) return;
      const key = event.key.toLowerCase();
      if (key === "f") { event.preventDefault(); this.#toggleAim(); }
      else if (key === " " && !event.repeat) { event.preventDefault(); this.combat.setFireHeld(true); this.combat.tryFire(); }
    });
    window.addEventListener("keyup", event => { if (event.key === " ") this.combat.setFireHeld(false); });
  }
}
