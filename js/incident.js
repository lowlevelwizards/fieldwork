import { findEntity } from './world-entities.js';

export class IncidentController {
  constructor(game) {
    this.game = game;
    this.id = 'truck_accident_01';
    this.state = 'active';
    this.elapsed = 0;
    this.radioRestored = false;
    this.workerSheltered = false;
    this.bandageUsed = false;
    this.waterUsed = false;
  }

  get worker() { return this.game.actors.find((actor) => actor.id === 'worker_ada'); }

  update(delta) {
    if (this.state === 'resolved') return;
    this.elapsed += delta;
    const worker = this.worker;
    if (!worker) return;
    if (!this.bandageUsed && this.elapsed > 150 && worker.condition === 'bleeding') {
      worker.severity = 'weak';
      worker.currentTask = 'Growing weaker';
    }
    if (this.game.assistedActorId === worker.id) {
      const offset = this.game.operator.facing === 'left' ? 30 : this.game.operator.facing === 'right' ? -30 : 30;
      worker.x = this.game.operator.x + offset;
      worker.y = this.game.operator.y + 6;
      worker.facing = this.game.operator.facing;
      worker.groundY = worker.y + worker.radius;
      worker.currentTask = 'Walking with assistance';
      worker.seated = false;
      worker.vx = this.game.operator.vx * 0.75;
      worker.vy = this.game.operator.vy * 0.75;
      if (Math.hypot(worker.x - 1270, worker.y - 1170) < 115) {
        this.game.assistedActorId = null;
        worker.x = 1255; worker.y = 1150; worker.seated = true;
        worker.condition = 'recovering'; worker.mobility = 'resting';
        worker.currentTask = 'Recovering at the break table';
        this.workerSheltered = true;
        this.game.pushMessage('Ada is resting somewhere safe', 3);
      }
    }
    if (this.bandageUsed && this.workerSheltered && this.radioRestored) {
      this.state = 'resolved';
      this.game.pushMessage('Help is on the way', 3.5);
    } else if (this.bandageUsed) this.state = 'stabilized';
  }

  consumeHeld(definitionId) {
    const id = this.game.operator.carriedItemInstanceId;
    const item = findEntity(this.game.entities, id);
    if (!item || item.definitionId !== definitionId) return false;
    this.game.operator.carriedItemInstanceId = null;
    item.locationType = 'consumed'; item.locationOwnerId = null; item.revealed = false; item.state = 'consumed';
    return true;
  }

  applyBandage() {
    const worker = this.worker;
    if (!worker || !this.consumeHeld('bandage')) return false;
    this.bandageUsed = true;
    worker.condition = 'injured'; worker.severity = 'stable'; worker.needs = worker.needs.filter((need) => need !== 'bandage');
    worker.currentTask = 'Bleeding controlled';
    this.game.pushMessage('Bleeding controlled', 3);
    return true;
  }

  giveWater() {
    const worker = this.worker;
    if (!worker || !this.consumeHeld('water_bottle')) return false;
    this.waterUsed = true;
    worker.needs = worker.needs.filter((need) => need !== 'water');
    this.game.pushMessage('Ada drinks slowly', 2.5);
    return true;
  }

  installBattery() {
    if (!this.consumeHeld('radio_battery')) return false;
    this.radioRestored = true;
    const cradle = findEntity(this.game.entities, 'radio_cradle_01');
    if (cradle) { cradle.radioPowered = true; cradle.name = 'Working Field Radio'; cradle.text = 'The repeater hums with a steady green status light. A dispatcher confirms that help is on the way.'; }
    this.game.pushMessage('Communications restored', 3);
    this.game.emitEvent('radioOn', cradle);
    return true;
  }

  beginAssist() {
    const worker = this.worker;
    if (!worker || !this.bandageUsed || this.workerSheltered) return false;
    this.game.assistedActorId = worker.id;
    worker.seated = false; worker.mobility = 'assisted';
    this.game.pushMessage('Guide Ada to the break table', 3);
    return true;
  }
}
