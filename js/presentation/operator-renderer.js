import { getOperatorKit } from "../../data/operator-kits.js";
import { drawItemVisual, itemGrip } from "./item-renderer.js";

const VALID_FACINGS = new Set(["up", "down", "left", "right"]);

function roundedRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawCircle(ctx, x, y, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawAccentPatch(ctx, x, y, width, height, palette) {
  roundedRect(ctx, x, y, width, height, 2, palette.accent);
}

function drawHelmet(ctx, x, y, palette, { facing = "down", sideSign = 1 } = {}) {
  const headRadius = 15.5;
  const helmetRadius = 19;

  drawCircle(ctx, x, y, headRadius, palette.skin);

  // The helmet deliberately overhangs the face so it reads as carried gear,
  // rather than replacing the upper half of the head.
  ctx.fillStyle = palette.headwear;
  ctx.beginPath();
  ctx.arc(x, y - 4, helmetRadius, Math.PI, Math.PI * 2);
  ctx.lineTo(x + helmetRadius, y - 1);
  ctx.quadraticCurveTo(x, y - 7, x - helmetRadius, y - 1);
  ctx.closePath();
  ctx.fill();

  if (facing === "down") {
    roundedRect(ctx, x - helmetRadius, y - 3, helmetRadius * 2, 4, 2, palette.headwear);
    roundedRect(ctx, x - 5, y - 2, 10, 3, 2, palette.hair);
    drawAccentPatch(ctx, x - 3, y - 16, 6, 3, palette.accent);
  } else if (facing === "up") {
    roundedRect(ctx, x - helmetRadius, y - 3, helmetRadius * 2, 4, 2, palette.headwear);
    roundedRect(ctx, x - 9, y - 17, 18, 4, 2, palette.helmetRear);
    drawAccentPatch(ctx, x - 3, y - 16, 6, 3, palette.accent);
  } else {
    const earX = x + sideSign * 12 - (sideSign < 0 ? 6 : 0);
    roundedRect(ctx, x - helmetRadius, y - 3, helmetRadius * 2, 4, 2, palette.headwear);
    roundedRect(ctx, earX, y - 9, 6, 10, 2, palette.helmetRear);
    drawAccentPatch(ctx, earX + 1, y - 7, 3, 5, palette.accent);
  }
}

function drawHandCapsule(ctx, x, y, angle, palette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  roundedRect(ctx, -5, -3.5, 10, 7, 3.5, palette.hand);
  ctx.restore();
}

function drawWeapon(ctx, { x1, y1, x2, y2, palette, rearHand, frontHand, drawHands = true }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(24, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  // Three strong masses: stock, receiver, and barrel.
  roundedRect(ctx, -2, -5, length * 0.31, 10, 4, palette.weaponWood);
  roundedRect(ctx, length * 0.24, -5, length * 0.31, 10, 3, palette.weaponMetal);
  roundedRect(ctx, length * 0.51, -2.5, length * 0.49, 5, 2.5, palette.weaponMetal);
  roundedRect(ctx, length * 0.36, 3, 7, 8, 2, palette.weaponMetal);
  roundedRect(ctx, -4, -6, 5, 12, 2, palette.weaponButt);

  ctx.restore();

  if (drawHands) {
    drawHandCapsule(ctx, rearHand.x, rearHand.y, angle, palette);
    drawHandCapsule(ctx, frontHand.x, frontHand.y, angle, palette);
  }
}

function drawShadow(ctx, moving, walkingPhase) {
  const stretch = moving ? Math.sin(walkingPhase) * 0.8 : 0;
  ctx.fillStyle = "rgba(18, 24, 20, 0.25)";
  ctx.beginPath();
  // Fixed to the foot contact point, slightly below the body and independent of bob.
  ctx.ellipse(0, 33, 23 + stretch, 6.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrontLegs(ctx, step, palette) {
  roundedRect(ctx, -15, 10 + step, 12, 16, 4, palette.trousers);
  roundedRect(ctx, 3, 10 - step, 12, 16, 4, palette.trousers);
  roundedRect(ctx, -17, 23 + step, 14, 10, 5, palette.boots);
  roundedRect(ctx, 3, 23 - step, 14, 10, 5, palette.boots);
}

function drawRearLegs(ctx, step, palette) {
  roundedRect(ctx, -15, 10 + step, 12, 16, 4, palette.trousers);
  roundedRect(ctx, 3, 10 - step, 12, 16, 4, palette.trousers);
  roundedRect(ctx, -16, 23 + step, 13, 10, 5, palette.boots);
  roundedRect(ctx, 3, 23 - step, 13, 10, 5, palette.boots);
}

function drawSideLegs(ctx, step, palette, sign) {
  // Rear leg first, then the near leg, so both remain visible in profile.
  roundedRect(ctx, -6 - sign * 4, 11 - step, 11, 15, 4, palette.trousers);
  roundedRect(ctx, -7 - sign * 5, 23 - step, 14, 10, 5, palette.boots);
  roundedRect(ctx, -5 + sign * 4, 10 + step, 12, 16, 4, palette.trousers);
  roundedRect(ctx, -6 + sign * 5, 23 + step, 15, 10, 5, palette.boots);
}

function drawWaist(ctx, palette) {
  roundedRect(ctx, -18, 8, 36, 7, 3, palette.belt);
}

function drawFrontRig(ctx, palette) {
  roundedRect(ctx, -16, -7, 32, 14, 5, palette.webbing);
  roundedRect(ctx, -12, -3, 14, 8, 3, palette.rigPouch);
  roundedRect(ctx, 4, -3, 9, 8, 3, palette.rigPouch);
  drawAccentPatch(ctx, 10, -6, 5, 3, palette.accent);
}

function drawHeldItem(ctx, definitionId, facing, palette) {
  if (!definitionId) return;
  const grip = itemGrip(definitionId, facing);
  const angle = facing === "left" || facing === "right" ? 0 : 0;
  ctx.save();
  ctx.translate(grip.item.x, grip.item.y);
  drawItemVisual(ctx, definitionId, { scale: grip.item.scale, facing });
  ctx.restore();
  for (const hand of grip.hands) drawHandCapsule(ctx, hand.x, hand.y, angle, palette);
}

function drawUp(ctx, palette, motion) {
  const { step, sway, packBounce, packScale } = motion;

  drawRearLegs(ctx, step, palette);

  ctx.save();
  ctx.translate(0,10);
  ctx.rotate(motion.torsoLean);
  ctx.translate(0,-10);

  // Carried objects and their hands sit behind the operator when facing north.
  if (motion.carrying) drawHeldItem(ctx, motion.carriedDefinitionId, "up", palette);
  if (!motion.carrying && !motion.hideWeapon) drawWeapon(ctx, {
    x1: -10 + sway, y1: 1,
    x2: 1 + sway, y2: -47,
    palette,
    rearHand: { x: -7 + sway, y: -7 },
    frontHand: { x: -3 + sway, y: -21 }
  });

  roundedRect(ctx, -20, -13, 40, 29, 10, palette.torso);
  drawWaist(ctx, palette);

  // Reduced pack: shoulders, waist, pants, and boots remain readable around it.
  roundedRect(ctx, -21 - packScale, -9 + packBounce, 42 + packScale * 2, 29 + packScale, 9, palette.backpack);
  roundedRect(ctx, -18, -15 + packBounce, 36, 12, 6, palette.backpackFlap);
  roundedRect(ctx, -24, -1 + packBounce, 6, 16, 3, palette.rigPouch);
  roundedRect(ctx, 18, -1 + packBounce, 6, 16, 3, palette.rigPouch);
  roundedRect(ctx, -15, 17 + packBounce, 30, 8, 4, palette.bedroll);
  ctx.fillStyle = palette.webbing;
  ctx.fillRect(-2, -13 + packBounce, 4, 34);
  ctx.fillRect(-15, 4 + packBounce, 30, 3);
  drawAccentPatch(ctx, 8, -10 + packBounce, 7, 4, palette.accent);

  drawHelmet(ctx, 0, -31, palette, { facing: "up" });
  ctx.restore();
}

function drawDown(ctx, palette, motion) {
  const { step, sway } = motion;

  // Front view: the pack is behind the torso, but its outer volume, flap,
  // straps, and lower roll remain visible beyond the silhouette.
  roundedRect(ctx, -19, -12, 38, 29, 9, palette.backpack);
  roundedRect(ctx, -16, -16, 32, 10, 5, palette.backpackFlap);
  roundedRect(ctx, -15, 14, 30, 7, 4, palette.bedroll);
  roundedRect(ctx, -18, -4, 5, 19, 3, palette.rigPouch);
  roundedRect(ctx, 13, -4, 5, 19, 3, palette.rigPouch);
  roundedRect(ctx, -15, -14, 4, 30, 2, palette.webbing);
  roundedRect(ctx, 11, -14, 4, 30, 2, palette.webbing);

  drawFrontLegs(ctx, step, palette);
  ctx.save();
  ctx.translate(0,10);
  ctx.rotate(motion.torsoLean);
  ctx.translate(0,-10);
  roundedRect(ctx, -20, -14, 40, 29, 10, palette.torso);
  drawWaist(ctx, palette);
  drawFrontRig(ctx, palette);

  drawHelmet(ctx, 0, -31, palette, { facing: "down" });

  if (!motion.carrying && !motion.hideWeapon) drawWeapon(ctx, {
    x1: -17 + sway, y1: -2,
    x2: 22 + sway, y2: 28,
    palette,
    rearHand: { x: -7 + sway, y: 4 },
    frontHand: { x: 8 + sway, y: 15 }
  });
  else drawHeldItem(ctx, motion.carriedDefinitionId, "down", palette);
  ctx.restore();
}

function drawSide(ctx, palette, motion, direction) {
  const sign = direction === "right" ? 1 : -1;
  const { step, sway, packBounce, packScale } = motion;

  drawSideLegs(ctx, step, palette, sign);

  ctx.save();
  ctx.translate(0,10);
  ctx.rotate(motion.torsoLean*sign);
  ctx.translate(0,-10);

  const packX = sign === 1 ? -26 : 5;
  roundedRect(ctx, packX - (sign === 1 ? packScale : 0), -10 + packBounce, 21 + packScale, 30 + packScale * 0.5, 8, palette.backpack);
  roundedRect(ctx, packX + 1, -15 + packBounce, 19, 11, 6, palette.backpackFlap);
  roundedRect(ctx, packX + 3, 17 + packBounce, 15, 8, 4, palette.bedroll);
  roundedRect(ctx, packX + (sign === 1 ? -3 : 17), -1 + packBounce, 6, 15, 3, palette.rigPouch);

  roundedRect(ctx, -17, -14, 34, 29, 10, palette.torso);
  drawWaist(ctx, palette);
  roundedRect(ctx, -13, -5, 26, 11, 5, palette.webbing);
  roundedRect(ctx, sign > 0 ? 0 : -12, -2, 12, 7, 3, palette.rigPouch);
  drawAccentPatch(ctx, sign > 0 ? 8 : -13, -5, 5, 4, palette.accent);

  drawHelmet(ctx, sign * 4, -31, palette, { facing: direction, sideSign: sign });

  if (!motion.carrying && !motion.hideWeapon) drawWeapon(ctx, {
    x1: sign * (-7 + sway), y1: 0,
    x2: sign * (47 + sway), y2: -7,
    palette,
    rearHand: { x: sign * (5 + sway), y: -1 },
    frontHand: { x: sign * (21 + sway), y: -4 }
  });
  else drawHeldItem(ctx, motion.carriedDefinitionId, direction, palette);
  ctx.restore();
}


function desaturateHex(hex, amount=.55, darken=.18) {
  const value=hex?.replace("#","")??"777777";
  const full=value.length===3?value.split("").map(c=>c+c).join(""):value;
  const r=parseInt(full.slice(0,2),16),g=parseInt(full.slice(2,4),16),b=parseInt(full.slice(4,6),16);
  const gray=(r+g+b)/3;
  const mix=channel=>Math.max(0,Math.min(255,Math.round((channel*(1-amount)+gray*amount)*(1-darken))));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function casualtyPalette(palette, dead=false) {
  if(!dead)return palette;
  return Object.fromEntries(Object.entries(palette).map(([key,value])=>[
    key,typeof value==="string"&&value.startsWith("#")?desaturateHex(value):value
  ]));
}

function drawFlatCasualty(ctx,palette,{dead=false,dragged=false,phase=0,angle=0}={}) {
  const p=casualtyPalette(palette,dead);
  ctx.save();
  ctx.rotate(angle);
  const breath=dead?0:Math.sin(phase*.9)*.5;
  ctx.translate(0,breath);

  ctx.fillStyle="rgba(20,27,23,.22)";
  ctx.beginPath();ctx.ellipse(0,9,37,14,0,0,Math.PI*2);ctx.fill();

  // Compact curled silhouette matching the squat standing proportions.
  roundedRect(ctx,-15,-10,32,21,8,p.backpack);
  roundedRect(ctx,-14,-14,29,8,4,p.backpackFlap);
  roundedRect(ctx,-20,-10,38,22,9,p.torso);
  roundedRect(ctx,-10,-4,25,9,4,p.webbing);

  drawCircle(ctx,-24,-1,13.5,p.skin);
  ctx.fillStyle=p.headwear;
  ctx.beginPath();ctx.arc(-24,-5,16.5,Math.PI,Math.PI*2);
  ctx.lineTo(-7,-2);ctx.lineTo(-41,-2);ctx.closePath();ctx.fill();

  // One arm folded near chest, one resting forward.
  roundedRect(ctx,-13,-15,23,7,3.5,p.skin);
  roundedRect(ctx,-9,8,21,7,3.5,p.skin);

  // Bent legs overlap the torso so the body remains connected and toy-like.
  roundedRect(ctx,9,-10,23,9,4.5,p.trousers);
  roundedRect(ctx,25,-7,14,10,5,p.boots);
  roundedRect(ctx,7,5,21,10,5,p.trousers);
  roundedRect(ctx,20,10,15,10,5,p.boots);

  if(dragged){
    ctx.strokeStyle="rgba(229,154,71,.7)";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(34,4);ctx.lineTo(47,4);ctx.stroke();
  }
  ctx.restore();
}

function drawCriticalCrawl(ctx,palette,{phase=0,moving=false,facing="down"}={}) {
  const sign=facing==="left"?-1:1;
  const crawl=moving?Math.sin(phase)*4:0;
  ctx.save();
  if(facing==="left"||facing==="right")ctx.scale(sign,1);

  ctx.fillStyle="rgba(20,27,23,.22)";
  ctx.beginPath();ctx.ellipse(0,20,39,14,0,0,Math.PI*2);ctx.fill();

  // Pack and torso are nearly horizontal.
  roundedRect(ctx,-19,-5,38,22,9,palette.backpack);
  roundedRect(ctx,-17,-11,34,10,5,palette.backpackFlap);
  roundedRect(ctx,-23,-8,43,22,10,palette.torso);
  roundedRect(ctx,-13,-4,28,9,4,palette.webbing);

  // Head low and forward.
  drawHelmet(ctx,24,-9,palette,{facing:"right",sideSign:1});

  // Alternating hands and knees — a real all-fours crawl pose.
  roundedRect(ctx,15+crawl,-1,25,8,4,palette.skin);
  roundedRect(ctx,32+crawl,0,12,9,4,palette.gloves??palette.skin);
  roundedRect(ctx,8-crawl,10,27,8,4,palette.skin);
  roundedRect(ctx,27-crawl,11,12,9,4,palette.gloves??palette.skin);
  roundedRect(ctx,-13+crawl,10,24,10,5,palette.trousers);
  roundedRect(ctx,-23+crawl,17,20,10,5,palette.boots);
  roundedRect(ctx,-16-crawl,-1,24,10,5,palette.trousers);
  roundedRect(ctx,-29-crawl,3,20,10,5,palette.boots);
  ctx.restore();
}

function woundPoseData(operator) {
  const wounds=operator.medical?.wounds??[];
  const active=wounds.filter(w=>!w.controlled);
  const all=active.length?active:wounds;
  const rank={minor:1,moderate:2,severe:3,catastrophic:4};
  const dominant=[...all].sort((a,b)=>(rank[b.severity]??0)-(rank[a.severity]??0))[0];
  return {
    region:operator.woundPoseRegion??dominant?.region??null,
    severity:operator.woundPoseSeverity??dominant?.severity??null,
    wounded:Boolean(dominant)&&!operator.medical?.unconscious&&!operator.medical?.dead
  };
}



export function drawOperator(ctx, operator, carriedItem = null) {
  const kit = getOperatorKit(operator.kitId);
  const palette = kit.palette;
  const facing = VALID_FACINGS.has(operator.facing) ? operator.facing : "up";
  const speed = Math.hypot(operator.vx??0, operator.vy??0);
  const moving = speed > 5;
  const phase = operator.walkingPhase;
  const carrying = Boolean(operator.carriedItemInstanceId);
  const mode=operator.locomotionMode??"idle";
  const pace=Math.min(1,operator.motionPace??speed/260);
  const amplitude=mode==="run"?3.5:mode==="strafe"?2.35:mode==="backpedal"?1.65:2.15;
  const sideStep=mode==="strafe"?Math.sin(phase)*1.7:0;
  const motion = {
    step: moving ? Math.sin(phase) * amplitude : 0,
    sideStep,
    sway: moving ? Math.sin(phase * 0.5) * (mode==="run"?1.8:1.05) : 0,
    packBounce: (moving ? Math.abs(Math.sin(phase)) * (mode==="run"?1.8:.9) : 0) - (operator.packPulse || 0) * 1.5,
    packScale: (operator.backpackLoadRatio || 0) * 2,
    carrying,
    carriedDefinitionId: carriedItem?.definitionId || null,
    searching: Boolean(operator.searchTargetId),
    searchPose: operator.searchPose || 0,
    torsoLean: operator.torsoLean || 0,
    hideWeapon:false,
    woundRegion:null
  };

  const wound=woundPoseData(operator);
  motion.woundRegion=wound.region;
  if(wound.wounded){
    if(wound.region==="torso")motion.torsoLean+=(facing==="left"?-.16:.16);
    if(wound.region==="legs"){
      motion.step=moving
        ?(Math.sin(phase)>0?Math.sin(phase)*1.8:Math.sin(phase)*.35)
        :0;
      motion.sideStep*=.45;
    }
    if(wound.region==="arms"){
      motion.hideWeapon=true;
      motion.sway*=.35;
    }
  }

  ctx.save();
  ctx.translate(operator.x, operator.y);

  const casualtyPhase=performance.now()/1000;
  if(operator.medical?.dead){
    drawFlatCasualty(ctx,palette,{dead:true,phase:casualtyPhase,angle:operator.collapseAngle??0});
    ctx.restore();return;
  }
  if(operator.medical?.unconscious||operator.workPose==="downed"){
    drawFlatCasualty(ctx,palette,{dead:false,phase:casualtyPhase,angle:operator.collapseAngle??0});
    ctx.restore();return;
  }
  if(operator.beingDragged||operator.workPose==="dragged"){
    drawFlatCasualty(ctx,palette,{dead:Boolean(operator.medical?.dead),dragged:true,phase:casualtyPhase,angle:operator.collapseAngle??0});
    ctx.restore();return;
  }
  if(operator.medical?.condition==="critical"||operator.workPose==="crawl"){
    drawCriticalCrawl(ctx,palette,{phase,moving,facing});
    ctx.restore();return;
  }
  if(speed>5){
    const nx=(operator.vx??0)/speed,ny=(operator.vy??0)/speed;
    const forwardX=Math.cos(operator.lookAngle??0),forwardY=Math.sin(operator.lookAngle??0);
    const forwardDot=nx*forwardX+ny*forwardY;
    const sideDot=nx*(-forwardY)+ny*forwardX;
    const runLean=mode==="run"?7.2:mode==="forward"?3.7:mode==="backpedal"?-2.2:2.4;
    const braking=-(operator.motionAcceleration??0)*2.2;
    ctx.translate(nx*(pace*runLean+braking),ny*(pace*runLean+braking));
    ctx.translate(-forwardY*sideDot*1.2*pace,forwardX*sideDot*1.2*pace);
  }
  if (motion.searching) {
    const leanX = facing === "left" ? -4 : facing === "right" ? 4 : 0;
    ctx.translate(leanX, 3 + motion.searchPose * 1.5);
    ctx.rotate((facing === "left" ? -1 : facing === "right" ? 1 : 0) * 0.055);
  }

  if(wound.wounded){
    if(wound.region==="torso"){
      ctx.translate(0,3);
      ctx.rotate((facing==="left"?-1:facing==="right"?1:.4)*.10);
    }else if(wound.region==="head"){
      const headRock=Math.sin(casualtyPhase*2.1)*.055;
      ctx.rotate(headRock);
    }else if(wound.region==="legs"&&moving){
      ctx.translate(Math.sin(phase)<0?0:1.5,Math.sin(phase)<0?1.8:0);
    }
  }

  drawShadow(ctx, moving, phase);

  const bobAmount=mode==="run"?1.8:mode==="strafe"?.7:mode==="backpedal"?.45:.9;
  ctx.translate(motion.sideStep*.32, moving ? Math.abs(Math.sin(phase))*-bobAmount : 0);

  if (facing === "up") drawUp(ctx, palette, motion);
  else if (facing === "down") drawDown(ctx, palette, motion);
  else drawSide(ctx, palette, motion, facing);

  ctx.restore();
}
