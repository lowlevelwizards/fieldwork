import { MAP_WIDTH, MAP_HEIGHT } from "../data/map.js";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const lerp=(a,b,t)=>a+(b-a)*t;

export class Camera {
  constructor() {
    this.x=0;
    this.y=0;
    this.screenWidth=Math.max(1,window.visualViewport?.width||window.innerWidth||1);
    this.screenHeight=Math.max(1,window.visualViewport?.height||window.innerHeight||1);
    this.zoom=1;
    this.targetZoom=1;
    this.width=this.screenWidth;
    this.height=this.screenHeight;
    this.spectatorMode=false;
    this.spectatorTarget=null;
  }

  resize(width,height) {
    const fallbackWidth=window.visualViewport?.width||window.innerWidth||1;
    const fallbackHeight=window.visualViewport?.height||window.innerHeight||1;
    this.screenWidth=Number.isFinite(width)&&width>=100?width:fallbackWidth;
    this.screenHeight=Number.isFinite(height)&&height>=100?height:fallbackHeight;
    this.#refreshWorldSize();
    this.#clamp();
  }

  #refreshWorldSize() {
    this.width=this.screenWidth/Math.max(.01,this.zoom);
    this.height=this.screenHeight/Math.max(.01,this.zoom);
  }

  snapTo(target) {
    if(!target)return;
    this.zoom=this.targetZoom=1;
    this.#refreshWorldSize();
    this.x=target.x-this.width/2;
    this.y=target.y-this.height/2;
    this.#clamp();
  }

  lockTo(target) {
    if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return;
    this.x=target.x-this.width/2;
    this.y=target.y-this.height/2;
    this.#clamp();
  }

  findEngagementFocus(game) {
    const operator=game.operator;
    const candidates=game.actors.filter(actor=>
      actor.factionId &&
      actor.operationId &&
      actor.condition!=="incapacitated" &&
      actor.factionId!=="commune"
    );
    let best=null;
    for(const actor of candidates) {
      const d=Math.hypot(actor.x-operator.x,actor.y-operator.y);
      const detection=game.perception?.getDetection?.(operator.id,actor.id);
      const active=(actor.threatenedByPlayerUntil??0)>performance.now()/1000 ||
        actor.aimReadiness>.55 ||
        actor.encounterState==="threatening" ||
        actor.encounterState==="blocking";
      if(!active && (detection?.progress??0)<18)continue;
      const score=(active?1000:0)+(detection?.progress??0)-d*.04;
      if(!best||score>best.score)best={actor,d,score};
    }
    return best;
  }

  setSpectatorMode(enabled=true){this.spectatorMode=Boolean(enabled);if(!enabled)this.spectatorTarget=null;}

  fitBounds(bounds,{padding=.05}={}){
    const width=Math.max(1,Number(bounds?.width)||MAP_WIDTH),height=Math.max(1,Number(bounds?.height)||MAP_HEIGHT);
    const fit=Math.min(this.screenWidth/(width*(1+padding*2)),this.screenHeight/(height*(1+padding*2)));
    this.zoom=this.targetZoom=clamp(fit,.08,1);this.#refreshWorldSize();
    this.x=(width-this.width)/2;this.y=(height-this.height)/2;this.spectatorTarget=null;this.#clamp();
  }

  focusOn(target,{zoom=.72}={}){
    if(!target)return;this.spectatorMode=true;this.spectatorTarget=target;this.targetZoom=clamp(zoom,.12,1);
  }

  panByScreen(dx,dy){this.spectatorTarget=null;this.x-=dx/Math.max(.01,this.zoom);this.y-=dy/Math.max(.01,this.zoom);this.#clamp();}

  zoomAt(factor,screenX=this.screenWidth/2,screenY=this.screenHeight/2){
    const before=this.screenToWorld(screenX,screenY);this.spectatorTarget=null;this.zoom=this.targetZoom=clamp(this.zoom*factor,.08,1);this.#refreshWorldSize();
    this.x=before.x-screenX/this.zoom;this.y=before.y-screenY/this.zoom;this.#clamp();
  }

  update(game,delta) {
    if(this.spectatorMode){
      if(this.spectatorTarget&&Number.isFinite(this.spectatorTarget.x)&&Number.isFinite(this.spectatorTarget.y)){
        const ease=1-Math.exp(-delta*5);this.zoom=lerp(this.zoom,this.targetZoom,ease);this.#refreshWorldSize();
        this.x=lerp(this.x,this.spectatorTarget.x-this.width/2,ease);this.y=lerp(this.y,this.spectatorTarget.y-this.height/2,ease);this.#clamp();
      }
      return;
    }
    const operator=game?.operator;
    if(!operator||!Number.isFinite(operator.x)||!Number.isFinite(operator.y))return;

    const engagement=this.findEngagementFocus(game);
    const speedRatio=clamp(operator.motionSpeedRatio??0,0,1);
    const aiming=Boolean(game.combat?.aiming);
    const suppressed=(game.combat?.suppression??0)>14;

    let desiredZoom=1;
    if(speedRatio>.68)desiredZoom=.9;
    if(aiming)desiredZoom=.70;
    if(engagement) {
      const distanceFactor=clamp((engagement.d-220)/620,0,1);
      desiredZoom=Math.min(desiredZoom,lerp(.78,.60,distanceFactor));
    }
    if(suppressed)desiredZoom=Math.min(desiredZoom,.76);
    desiredZoom=clamp(desiredZoom,.58,1);

    const zoomEase=1-Math.exp(-delta*4.2);
    this.targetZoom=desiredZoom;
    this.zoom=lerp(this.zoom,this.targetZoom,zoomEase);
    this.#refreshWorldSize();

    let focusX=operator.x;
    let focusY=operator.y;
    const leadStrength=aiming?.31:speedRatio>.15?.12:0;
    const leadAngle=aiming
      ?(game.combat?.aimAngle??operator.lookAngle??0)
      :Math.atan2(operator.vy??0,operator.vx??0);
    if(leadStrength>0){
      focusX+=Math.cos(leadAngle)*this.width*leadStrength;
      focusY+=Math.sin(leadAngle)*this.height*leadStrength;
    }

    if(engagement){
      const blend=aiming?.56:.34;
      focusX=lerp(focusX,(operator.x+engagement.actor.x)/2,blend);
      focusY=lerp(focusY,(operator.y+engagement.actor.y)/2,blend);
    }

    const desiredX=focusX-this.width/2;
    const desiredY=focusY-this.height/2;
    const positionEase=1-Math.exp(-delta*(engagement?5.2:7.5));
    this.x=lerp(this.x,desiredX,positionEase);
    this.y=lerp(this.y,desiredY,positionEase);
    this.#clamp();
  }

  worldToScreen(x,y) {
    return {x:(x-this.x)*this.zoom,y:(y-this.y)*this.zoom};
  }

  screenToWorld(x,y) {
    return {x:this.x+x/this.zoom,y:this.y+y/this.zoom};
  }

  contains(target,margin=0) {
    if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
    return target.x>=this.x-margin &&
      target.x<=this.x+this.width+margin &&
      target.y>=this.y-margin &&
      target.y<=this.y+this.height+margin;
  }

  #clamp() {
    const maxX=Math.max(0,MAP_WIDTH-this.width);
    const maxY=Math.max(0,MAP_HEIGHT-this.height);
    this.x=Number.isFinite(this.x)?clamp(this.x,0,maxX):0;
    this.y=Number.isFinite(this.y)?clamp(this.y,0,maxY):0;
  }
}
