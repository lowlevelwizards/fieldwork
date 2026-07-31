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


export class CombatInputController {
  constructor({ aimZone, aimButton, fireButton, canvas, combat, getAimAngle, isBlocked = () => false, isStarted = () => true }) {
    this.aimZone = aimZone;
    this.aimButton = aimButton;
    this.fireButton = fireButton;
    this.canvas = canvas;
    this.combat = combat;
    this.getAimAngle = getAimAngle;
    this.isBlocked = isBlocked;
    this.isStarted = isStarted;
    this.aimPointerId = null;
    this.aimPointerStart = null;
    this.aimPointerMoved = false;
    this.dragThreshold = 8;
    this.#bind();
  }

  #available() { return this.isStarted() && !this.isBlocked(); }
  #setAngle(event) {
    const angle = this.getAimAngle(event.clientX, event.clientY);
    this.combat.setAimAngle(angle);
    if (this.combat.aiming) this.combat.game.operator.targetLookAngle = angle;
  }
  #toggleAim(force = null) {
    if (!this.#available()) return;
    this.combat.toggleAim(force);
  }

  #bind() {
    this.aimZone.addEventListener('pointerdown', event => {
      if (!this.#available() || this.aimPointerId !== null) return;
      event.preventDefault();
      this.aimPointerId = event.pointerId;
      this.aimPointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
      this.aimPointerMoved = false;
      this.aimZone.setPointerCapture(event.pointerId);
      this.#setAngle(event);
    }, { passive: false });

    this.aimZone.addEventListener('pointermove', event => {
      if (event.pointerId !== this.aimPointerId) return;
      event.preventDefault();
      const distance = Math.hypot(event.clientX - this.aimPointerStart.x, event.clientY - this.aimPointerStart.y);
      if (distance > this.dragThreshold) {
        this.aimPointerMoved = true;
        if (!this.combat.aiming) this.#toggleAim(true);
      }
      this.#setAngle(event);
    }, { passive: false });

    const finishAim = event => {
      if (event.pointerId !== this.aimPointerId) return;
      event.preventDefault();
      const shortTap = performance.now() - this.aimPointerStart.time < 380 && !this.aimPointerMoved;
      this.#setAngle(event);
      if (shortTap) this.#toggleAim();
      else if (!this.combat.aiming) this.#toggleAim(true);
      try { this.aimZone.releasePointerCapture(event.pointerId); } catch {}
      this.aimPointerId = null;
      this.aimPointerStart = null;
      this.aimPointerMoved = false;
    };
    this.aimZone.addEventListener('pointerup', finishAim, { passive: false });
    this.aimZone.addEventListener('pointercancel', event => {
      if (event.pointerId !== this.aimPointerId) return;
      this.aimPointerId = null;
      this.aimPointerStart = null;
      this.aimPointerMoved = false;
    });

    this.aimButton.addEventListener('pointerdown', event => {
      if (!this.#available()) return;
      event.preventDefault();
      event.stopPropagation();
      this.#toggleAim();
    }, { passive: false });

    const startFiring = event => {
      if (!this.#available() || !this.combat.aiming) return;
      event.preventDefault();
      event.stopPropagation();
      this.combat.setFireHeld(true);
      this.combat.tryFire();
      try { this.fireButton.setPointerCapture(event.pointerId); } catch {}
    };
    const stopFiring = event => {
      this.combat.setFireHeld(false);
      try { this.fireButton.releasePointerCapture(event.pointerId); } catch {}
    };
    this.fireButton.addEventListener('pointerdown', startFiring, { passive: false });
    this.fireButton.addEventListener('pointerup', stopFiring);
    this.fireButton.addEventListener('pointercancel', stopFiring);
    this.fireButton.addEventListener('pointerleave', event => { if (event.buttons === 0) stopFiring(event); });

    this.canvas.addEventListener('pointermove', event => {
      if (!this.#available() || event.pointerType === 'touch') return;
      this.#setAngle(event);
    });
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerdown', event => {
      if (!this.#available() || event.pointerType === 'touch') return;
      if (event.button === 2) {
        event.preventDefault();
        this.#toggleAim();
      } else if (event.button === 0 && this.combat.aiming) {
        event.preventDefault();
        this.combat.setFireHeld(true);
        this.combat.tryFire();
      }
    });
    window.addEventListener('pointerup', event => {
      if (event.pointerType !== 'touch') this.combat.setFireHeld(false);
    });

    window.addEventListener('keydown', event => {
      if (!this.#available()) return;
      const key = event.key.toLowerCase();
      if (key === 'f') {
        event.preventDefault();
        this.#toggleAim();
      } else if (key === ' ' && !event.repeat) {
        event.preventDefault();
        this.combat.setFireHeld(true);
        this.combat.tryFire();
      }
    });
    window.addEventListener('keyup', event => {
      if (event.key === ' ') this.combat.setFireHeld(false);
    });
  }
}
