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
  const helmetRadius = 17;

  drawCircle(ctx, x, y, 15.5, palette.skin);

  ctx.fillStyle = palette.headwear;
  ctx.beginPath();
  ctx.arc(x, y - 4, helmetRadius, Math.PI, Math.PI * 2);
  ctx.lineTo(x + helmetRadius, y - 2);
  ctx.quadraticCurveTo(x, y - 7, x - helmetRadius, y - 2);
  ctx.closePath();
  ctx.fill();

  if (facing === "down") {
    roundedRect(ctx, x - 5, y - 2, 10, 3, 2, palette.hair);
    drawAccentPatch(ctx, x - 3, y - 15, 6, 3, palette.accent);
  } else if (facing === "up") {
    roundedRect(ctx, x - 8, y - 16, 16, 4, 2, palette.helmetRear);
    drawAccentPatch(ctx, x - 3, y - 15, 6, 3, palette.accent);
  } else {
    roundedRect(ctx, x + sideSign * 10 - (sideSign < 0 ? 5 : 0), y - 8, 5, 9, 2, palette.helmetRear);
    drawAccentPatch(ctx, x + sideSign * 11 - (sideSign < 0 ? 4 : 0), y - 7, 3, 5, palette.accent);
  }
}

function drawWeapon(ctx, { x1, y1, x2, y2, palette, rearHand, frontHand, drawHands = true }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.lineCap = "round";
  ctx.strokeStyle = palette.weaponWood;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length * 0.43, 0);
  ctx.stroke();

  ctx.strokeStyle = palette.weaponMetal;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(length * 0.34, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();

  roundedRect(ctx, length * 0.29, -5, 19, 10, 3, palette.weaponMetal);
  ctx.restore();

  if (drawHands) {
    drawCircle(ctx, rearHand.x, rearHand.y, 6, palette.hand);
    drawCircle(ctx, frontHand.x, frontHand.y, 6, palette.hand);
  }
}

function drawShadow(ctx, moving, walkingPhase) {
  const stretch = moving ? Math.sin(walkingPhase) * 1.2 : 0;
  ctx.fillStyle = "rgba(18, 24, 20, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 25, 24 + stretch, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoots(ctx, bob, palette) {
  roundedRect(ctx, -16, 10 + bob, 13, 21, 6, palette.boots);
  roundedRect(ctx, 3, 10 - bob, 13, 21, 6, palette.boots);
}

function drawFrontRig(ctx, palette) {
  roundedRect(ctx, -17, -5, 34, 15, 5, palette.webbing);
  roundedRect(ctx, -14, -1, 8, 8, 2, palette.rigPouch);
  roundedRect(ctx, -4, -1, 8, 8, 2, palette.rigPouch);
  roundedRect(ctx, 6, -1, 8, 8, 2, palette.rigPouch);
  drawAccentPatch(ctx, 11, -4, 5, 3, palette.accent);
}

function drawUp(ctx, palette, motion) {
  const { bob, sway, packBounce } = motion;

  drawBoots(ctx, bob, palette);

  // Weapon and hands belong behind the body when moving north.
  drawWeapon(ctx, {
    x1: -10 + sway, y1: 0,
    x2: 0 + sway, y2: -50,
    palette,
    rearHand: { x: -8 + sway, y: -8 },
    frontHand: { x: -4 + sway, y: -24 }
  });

  roundedRect(ctx, -19, -12, 38, 39, 11, palette.torso);

  // Larger pack silhouette with clear flap, side pouches, and bedroll.
  roundedRect(ctx, -25, -10 + packBounce, 50, 35, 10, palette.backpack);
  roundedRect(ctx, -22, -16 + packBounce, 44, 15, 7, palette.backpackFlap);
  roundedRect(ctx, -29, -4 + packBounce, 8, 21, 4, palette.rigPouch);
  roundedRect(ctx, 21, -4 + packBounce, 8, 21, 4, palette.rigPouch);
  roundedRect(ctx, -19, 21 + packBounce, 38, 10, 5, palette.bedroll);
  ctx.fillStyle = palette.webbing;
  ctx.fillRect(-2, -14 + packBounce, 4, 42);
  ctx.fillRect(-18, 5 + packBounce, 36, 4);
  drawAccentPatch(ctx, 8, -10 + packBounce, 8, 4, palette.accent);

  drawHelmet(ctx, 0, -29, palette, { facing: "up" });
}

function drawDown(ctx, palette, motion) {
  const { bob, sway } = motion;

  roundedRect(ctx, -20, -10, 7, 28, 3, palette.backpack);
  roundedRect(ctx, 13, -10, 7, 28, 3, palette.backpack);
  roundedRect(ctx, -18, -16, 5, 38, 2, palette.webbing);
  roundedRect(ctx, 13, -16, 5, 38, 2, palette.webbing);

  drawBoots(ctx, bob, palette);
  roundedRect(ctx, -19, -14, 38, 41, 11, palette.torso);
  drawFrontRig(ctx, palette);

  drawHelmet(ctx, 0, -29, palette, { facing: "down" });

  drawWeapon(ctx, {
    x1: -17 + sway, y1: -2,
    x2: 20 + sway, y2: 29,
    palette,
    rearHand: { x: -7 + sway, y: 4 },
    frontHand: { x: 8 + sway, y: 16 }
  });
}

function drawSide(ctx, palette, motion, direction) {
  const sign = direction === "right" ? 1 : -1;
  const { bob, sway, packBounce } = motion;

  drawBoots(ctx, bob, palette);

  const packX = sign === 1 ? -29 : 7;
  roundedRect(ctx, packX, -12 + packBounce, 24, 37, 9, palette.backpack);
  roundedRect(ctx, packX + 1, -17 + packBounce, 22, 13, 6, palette.backpackFlap);
  roundedRect(ctx, packX + 3, 20 + packBounce, 18, 9, 4, palette.bedroll);
  roundedRect(ctx, packX + (sign === 1 ? -4 : 20), -2 + packBounce, 7, 18, 4, palette.rigPouch);

  roundedRect(ctx, -16, -14, 32, 41, 10, palette.torso);
  roundedRect(ctx, -13, -3, 26, 12, 5, palette.webbing);
  drawAccentPatch(ctx, sign > 0 ? 7 : -12, -1, 5, 4, palette.accent);

  drawHelmet(ctx, sign * 5, -29, palette, { facing: direction, sideSign: sign });

  drawWeapon(ctx, {
    x1: sign * (-7 + sway), y1: 0,
    x2: sign * (46 + sway), y2: -7,
    palette,
    rearHand: { x: sign * (4 + sway), y: -1 },
    frontHand: { x: sign * (21 + sway), y: -5 }
  });
}

export function drawOperator(ctx, operator) {
  const kit = getOperatorKit(operator.kitId);
  const palette = kit.palette;
  const facing = VALID_FACINGS.has(operator.facing) ? operator.facing : "up";
  const moving = Math.hypot(operator.vx, operator.vy) > 5;
  const phase = operator.walkingPhase;
  const motion = {
    bob: moving ? Math.sin(phase) * 1.8 : 0,
    sway: moving ? Math.sin(phase * 0.5) * 1.2 : 0,
    packBounce: moving ? Math.abs(Math.sin(phase)) * 1.25 : 0
  };

  ctx.save();
  ctx.translate(operator.x, operator.y);

  // Shadow stays locked to the operator's ground contact, independent of body bob.
  drawShadow(ctx, moving, phase);

  ctx.translate(0, moving ? Math.sin(phase) * 1.3 : 0);

  if (facing === "up") drawUp(ctx, palette, motion);
  else if (facing === "down") drawDown(ctx, palette, motion);
  else drawSide(ctx, palette, motion, facing);

  ctx.restore();
}
