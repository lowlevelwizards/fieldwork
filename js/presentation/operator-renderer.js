import { getOperatorKit } from "../../data/operator-kits.js";

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

function drawUp(ctx, palette, motion) {
  const { step, sway, packBounce } = motion;

  drawRearLegs(ctx, step, palette);

  // The rifle and gripping hands are entirely behind the body when facing north.
  drawWeapon(ctx, {
    x1: -10 + sway, y1: 1,
    x2: 1 + sway, y2: -47,
    palette,
    rearHand: { x: -7 + sway, y: -7 },
    frontHand: { x: -3 + sway, y: -21 }
  });

  roundedRect(ctx, -20, -13, 40, 29, 10, palette.torso);
  drawWaist(ctx, palette);

  // Reduced pack: shoulders, waist, pants, and boots remain readable around it.
  roundedRect(ctx, -21, -9 + packBounce, 42, 29, 9, palette.backpack);
  roundedRect(ctx, -18, -15 + packBounce, 36, 12, 6, palette.backpackFlap);
  roundedRect(ctx, -24, -1 + packBounce, 6, 16, 3, palette.rigPouch);
  roundedRect(ctx, 18, -1 + packBounce, 6, 16, 3, palette.rigPouch);
  roundedRect(ctx, -15, 17 + packBounce, 30, 8, 4, palette.bedroll);
  ctx.fillStyle = palette.webbing;
  ctx.fillRect(-2, -13 + packBounce, 4, 34);
  ctx.fillRect(-15, 4 + packBounce, 30, 3);
  drawAccentPatch(ctx, 8, -10 + packBounce, 7, 4, palette.accent);

  drawHelmet(ctx, 0, -31, palette, { facing: "up" });
}

function drawDown(ctx, palette, motion) {
  const { step, sway } = motion;

  roundedRect(ctx, -18, -10, 5, 25, 3, palette.backpack);
  roundedRect(ctx, 13, -10, 5, 25, 3, palette.backpack);
  roundedRect(ctx, -16, -14, 4, 30, 2, palette.webbing);
  roundedRect(ctx, 12, -14, 4, 30, 2, palette.webbing);

  drawFrontLegs(ctx, step, palette);
  roundedRect(ctx, -20, -14, 40, 29, 10, palette.torso);
  drawWaist(ctx, palette);
  drawFrontRig(ctx, palette);

  drawHelmet(ctx, 0, -31, palette, { facing: "down" });

  drawWeapon(ctx, {
    x1: -17 + sway, y1: -2,
    x2: 22 + sway, y2: 28,
    palette,
    rearHand: { x: -7 + sway, y: 4 },
    frontHand: { x: 8 + sway, y: 15 }
  });
}

function drawSide(ctx, palette, motion, direction) {
  const sign = direction === "right" ? 1 : -1;
  const { step, sway, packBounce } = motion;

  drawSideLegs(ctx, step, palette, sign);

  const packX = sign === 1 ? -26 : 5;
  roundedRect(ctx, packX, -10 + packBounce, 21, 30, 8, palette.backpack);
  roundedRect(ctx, packX + 1, -15 + packBounce, 19, 11, 6, palette.backpackFlap);
  roundedRect(ctx, packX + 3, 17 + packBounce, 15, 8, 4, palette.bedroll);
  roundedRect(ctx, packX + (sign === 1 ? -3 : 17), -1 + packBounce, 6, 15, 3, palette.rigPouch);

  roundedRect(ctx, -17, -14, 34, 29, 10, palette.torso);
  drawWaist(ctx, palette);
  roundedRect(ctx, -13, -5, 26, 11, 5, palette.webbing);
  roundedRect(ctx, sign > 0 ? 0 : -12, -2, 12, 7, 3, palette.rigPouch);
  drawAccentPatch(ctx, sign > 0 ? 8 : -13, -5, 5, 4, palette.accent);

  drawHelmet(ctx, sign * 4, -31, palette, { facing: direction, sideSign: sign });

  drawWeapon(ctx, {
    x1: sign * (-7 + sway), y1: 0,
    x2: sign * (47 + sway), y2: -7,
    palette,
    rearHand: { x: sign * (5 + sway), y: -1 },
    frontHand: { x: sign * (21 + sway), y: -4 }
  });
}

export function drawOperator(ctx, operator) {
  const kit = getOperatorKit(operator.kitId);
  const palette = kit.palette;
  const facing = VALID_FACINGS.has(operator.facing) ? operator.facing : "up";
  const moving = Math.hypot(operator.vx, operator.vy) > 5;
  const phase = operator.walkingPhase;
  const motion = {
    step: moving ? Math.sin(phase) * 1.7 : 0,
    sway: moving ? Math.sin(phase * 0.5) * 1.0 : 0,
    packBounce: moving ? Math.abs(Math.sin(phase)) * 0.9 : 0
  };

  ctx.save();
  ctx.translate(operator.x, operator.y);

  drawShadow(ctx, moving, phase);

  // Body bob is subtle; feet do most of the animation work.
  ctx.translate(0, moving ? Math.sin(phase) * 0.8 : 0);

  if (facing === "up") drawUp(ctx, palette, motion);
  else if (facing === "down") drawDown(ctx, palette, motion);
  else drawSide(ctx, palette, motion, facing);

  ctx.restore();
}
