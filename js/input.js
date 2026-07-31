export class InputController {
  constructor({ joystickBase, joystickKnob }) {
    this.joystickBase = joystickBase;
    this.joystickKnob = joystickKnob;
    this.keys = new Set();
    this.vector = { x: 0, y: 0 };
    this.pointerId = null;
    this.maxRadius = 58;
    this.walkRadius = 0.56;
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
    this.joystickBase.style.left = `${event.clientX - 70}px`;
    this.joystickBase.style.top = `${event.clientY - 70}px`;
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
  constructor({
    touchSurface, aimButton, fireButton, canvas, combat, getCombat = null, movementInput,
    getAimAngle, tryWorldInteraction = null, isBlocked = () => false,
    isStarted = () => true, canUseCombat = () => true
  }) {
    this.touchSurface=touchSurface;
    this.aimButton=aimButton;
    this.fireButton=fireButton;
    this.canvas=canvas;
    this.combat=combat;
    this.getCombat=getCombat??(()=>this.combat);
    this.movementInput=movementInput;
    this.getAimAngle=getAimAngle;
    this.tryWorldInteraction=tryWorldInteraction;
    this.isBlocked=isBlocked;
    this.isStarted=isStarted;
    this.canUseCombat=canUseCombat;
    this.lookPointerId=null;
    this.lastFireTouchAt=0;
    this.#bind();
  }

  #available(){return this.isStarted()&&!this.isBlocked();}
  #currentCombat(){return this.getCombat?.()??this.combat;}
  #combatAvailable(){return this.#available()&&Boolean(this.#currentCombat())&&this.canUseCombat();}
  #isUi(event){return Boolean(event.target.closest('button,.inventory-overlay,.inspect-overlay,.dialogue-overlay,.debug-panel'));}
  #setAngle(event){if(this.#combatAvailable())this.#currentCombat().setAimAngle(this.getAimAngle(event.clientX,event.clientY));}

  #bind(){
    this.touchSurface.addEventListener('pointerdown',event=>{
      if(!this.#available()||event.pointerType!=='touch'||this.#isUi(event))return;

      if(this.tryWorldInteraction?.(event.clientX,event.clientY)){
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const leftSide=event.clientX<window.innerWidth*.5;
      if(leftSide&&this.movementInput.pointerId===null){
        event.preventDefault();
        this.movementInput.beginPointer(event);
        try{this.touchSurface.setPointerCapture(event.pointerId)}catch{}
        return;
      }

      if(!leftSide&&this.lookPointerId===null&&this.#combatAvailable()){
        event.preventDefault();
        this.lookPointerId=event.pointerId;
        this.#currentCombat().lookInputActive=true;
        this.#setAngle(event);
        try{this.touchSurface.setPointerCapture(event.pointerId)}catch{}
      }
    },{passive:false,capture:true});

    this.touchSurface.addEventListener('pointermove',event=>{
      if(event.pointerId===this.movementInput.pointerId){
        event.preventDefault();
        this.movementInput.updatePointer(event);
        return;
      }
      if(event.pointerId===this.lookPointerId){
        event.preventDefault();
        this.#setAngle(event);
      }
    },{passive:false,capture:true});

    const finish=event=>{
      if(event.pointerId===this.movementInput.pointerId){
        event.preventDefault();
        this.movementInput.endPointer(event);
      }
      if(event.pointerId===this.lookPointerId){
        event.preventDefault();
        this.#setAngle(event);
        this.lookPointerId=null;
        this.#currentCombat().lookInputActive=false;
      }
      try{this.touchSurface.releasePointerCapture(event.pointerId)}catch{}
    };
    this.touchSurface.addEventListener('pointerup',finish,{passive:false,capture:true});
    this.touchSurface.addEventListener('pointercancel',finish,{passive:false,capture:true});

    this.aimButton.addEventListener('pointerdown',event=>{
      if(!this.#combatAvailable())return;
      event.preventDefault();
      event.stopPropagation();
      this.#currentCombat().toggleAim();
    },{passive:false});

    const fireStart=event=>{
      if(!this.#combatAvailable())return;
      event.preventDefault();
      // Consume rapid taps before Safari can reinterpret them as page zoom.
      if(event.pointerType==="touch")this.lastFireTouchAt=performance.now();
      event.stopPropagation();
      this.#currentCombat().setFireHeld(true);
      this.#currentCombat().tryFire();
      try{this.fireButton.setPointerCapture(event.pointerId)}catch{}
    };
    const fireStop=event=>{
      this.#currentCombat().setFireHeld(false);
      try{this.fireButton.releasePointerCapture(event.pointerId)}catch{}
    };
    this.fireButton.addEventListener('pointerdown',fireStart,{passive:false});
    this.fireButton.addEventListener('pointerup',fireStop);
    this.fireButton.addEventListener('pointercancel',fireStop);
    this.fireButton.addEventListener('click',event=>event.preventDefault(),{passive:false});
    this.fireButton.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();},{passive:false});
    this.fireButton.addEventListener('touchend',event=>event.preventDefault(),{passive:false});

    this.canvas.addEventListener('pointermove',event=>{
      if(this.#combatAvailable()&&event.pointerType!=='touch')this.#setAngle(event);
    });
    this.canvas.addEventListener('contextmenu',event=>event.preventDefault());
    this.canvas.addEventListener('pointerdown',event=>{
      if(!this.#combatAvailable()||event.pointerType==='touch')return;
      if(event.button===2){
        event.preventDefault();
        this.#currentCombat().toggleAim();
      }else if(event.button===0){
        event.preventDefault();
        this.#currentCombat().setFireHeld(true);
        this.#currentCombat().tryFire();
      }
    });
    window.addEventListener('pointerup',event=>{
      if(event.pointerType!=='touch')this.#currentCombat().setFireHeld(false);
    });
    window.addEventListener('keydown',event=>{
      if(!this.#combatAvailable())return;
      const key=event.key.toLowerCase();
      if(key==='f'){
        event.preventDefault();
        this.#currentCombat().toggleAim();
      }else if(key===' '&&!event.repeat){
        event.preventDefault();
        this.#currentCombat().setFireHeld(true);
        this.#currentCombat().tryFire();
      }
    });
    window.addEventListener('keyup',event=>{
      if(event.key===' ')this.#currentCombat().setFireHeld(false);
    });
  }
}
