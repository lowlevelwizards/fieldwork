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

function drawWeapon(ctx, { x1, y1, x2, y2, palette, rearHand, frontHand }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  ctx.lineCap = "round";
  ctx.strokeStyle = palette.weaponWood;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length * 0.42, 0);
  ctx.stroke();

  ctx.strokeStyle = palette.weaponMetal;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(length * 0.35, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();

  roundedRect(ctx, length * 0.30, -5, 18, 10, 3, palette.weaponMetal);
  ctx.restore();

  drawCircle(ctx, rearHand.x, rearHand.y, 5.5, palette.hand);
  drawCircle(ctx, frontHand.x, frontHand.y, 5.5, palette.hand);
}

function drawShadow(ctx, moving, walkingPhase) {
  const stretch = moving ? Math.sin(walkingPhase) * 1.5 : 0;
  ctx.fillStyle = "rgba(18, 24, 20, 0.27)";
  ctx.beginPath();
  ctx.ellipse(0, 15, 25 + stretch, 12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawUp(ctx, palette, motion) {
  const { bob, sway, packBounce } = motion;

  roundedRect(ctx, -15, 9 + bob, 11, 20, 5, palette.boots);
  roundedRect(ctx, 4, 9 - bob, 11, 20, 5, palette.boots);
  roundedRect(ctx, -18, -12, 36, 37, 10, palette.torso);

  roundedRect(ctx, -22, -8 + packBounce, 44, 31, 9, palette.backpack);
  roundedRect(ctx, -20, -13 + packBounce, 40, 13, 7, palette.backpackFlap);
  roundedRect(ctx, -17, 18 + packBounce, 34, 9, 5, palette.bedroll);
  ctx.fillStyle = palette.webbing;
  ctx.fillRect(-2, -11 + packBounce, 4, 38);

  drawCircle(ctx, 0, -26, 14, palette.skin);
  ctx.fillStyle = palette.headwear;
  ctx.beginPath();
  ctx.arc(0, -29, 15, Math.PI, Math.PI * 2);
  ctx.fill();

  drawWeapon(ctx, {
    x1: -10 + sway, y1: -4,
    x2: 0 + sway, y2: -49,
    palette,
    rearHand: { x: -8 + sway, y: -11 },
    frontHand: { x: -3 + sway, y: -28 }
  });
}

function drawDown(ctx, palette, motion) {
  const { bob, sway } = motion;

  roundedRect(ctx, -18, -14, 5, 34, 2, palette.webbing);
  roundedRect(ctx, 13, -14, 5, 34, 2, palette.webbing);
  roundedRect(ctx, -20, -8, 6, 26, 3, palette.backpack);
  roundedRect(ctx, 14, -8, 6, 26, 3, palette.backpack);

  roundedRect(ctx, -15, 8 + bob, 11, 21, 5, palette.boots);
  roundedRect(ctx, 4, 8 - bob, 11, 21, 5, palette.boots);
  roundedRect(ctx, -18, -14, 36, 39, 10, palette.torso);
  roundedRect(ctx, -16, -4, 32, 13, 5, palette.webbing);

  drawCircle(ctx, 0, -27, 14, palette.skin);
  ctx.fillStyle = palette.headwear;
  ctx.beginPath();
  ctx.arc(0, -31, 15, Math.PI, Math.PI * 2);
  ctx.fill();
  roundedRect(ctx, -4, -27, 8, 3, 2, palette.hair);

  drawWeapon(ctx, {
    x1: -16 + sway, y1: -3,
    x2: 18 + sway, y2: 28,
    palette,
    rearHand: { x: -7 + sway, y: 3 },
    frontHand: { x: 7 + sway, y: 16 }
  });
}

function drawSide(ctx, palette, motion, direction) {
  const sign = direction === "right" ? 1 : -1;
  const { bob, sway, packBounce } = motion;

  roundedRect(ctx, -9, 9 + bob, 10, 21, 5, palette.boots);
  roundedRect(ctx, 4, 8 - bob, 10, 21, 5, palette.boots);

  const packX = sign === 1 ? -25 : 5;
  roundedRect(ctx, packX, -11 + packBounce, 22, 34, 8, palette.backpack);
  roundedRect(ctx, packX + 1, -14 + packBounce, 20, 11, 6, palette.backpackFlap);
  roundedRect(ctx, packX + 3, 18 + packBounce, 16, 8, 4, palette.bedroll);

  roundedRect(ctx, -15, -13, 30, 39, 9, palette.torso);
  roundedRect(ctx, -12, -2, 24, 10, 5, palette.webbing);

  drawCircle(ctx, sign * 4, -27, 14, palette.skin);
  ctx.fillStyle = palette.headwear;
  ctx.beginPath();
  ctx.arc(sign * 4, -31, 15, Math.PI, Math.PI * 2);
  ctx.fill();

  drawWeapon(ctx, {
    x1: sign * (-6 + sway), y1: -1,
    x2: sign * (43 + sway), y2: -7,
    palette,
    rearHand: { x: sign * (4 + sway), y: -2 },
    frontHand: { x: sign * (20 + sway), y: -5 }
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
    sway: moving ? Math.sin(phase * 0.5) * 1.4 : 0,
    packBounce: moving ? Math.abs(Math.sin(phase)) * 1.4 : 0
  };

  ctx.save();
  ctx.translate(operator.x, operator.y);
  drawShadow(ctx, moving, phase);
  ctx.translate(0, moving ? Math.sin(phase) * 1.3 : 0);

  if (facing === "up") drawUp(ctx, palette, motion);
  else if (facing === "down") drawDown(ctx, palette, motion);
  else drawSide(ctx, palette, motion, facing);

  ctx.restore();
}
