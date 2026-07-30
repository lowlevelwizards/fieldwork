import { getItemDefinition } from "../../data/items.js";

function roundedRect(ctx, x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function strokeEllipse(ctx, x, y, rx, ry, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Draws an item centered on the current origin. Shared by world, hands, and UI. */
export function drawItemVisual(ctx, definitionId, { scale = 1, facing = "down" } = {}) {
  const def = getItemDefinition(definitionId);
  const side = facing === "left" || facing === "right";
  ctx.save();
  ctx.scale(scale, scale);

  if (definitionId === "radio_battery") {
    const w = side ? 27 : 31;
    const h = side ? 17 : 19;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 4, def.color);
    roundedRect(ctx, -w / 2 + 5, -h / 2 + 4, w - 10, h - 8, 3, def.accent);
    roundedRect(ctx, -w / 2 + 6, -h / 2 - 4, 6, 5, 2, "#303936");
    roundedRect(ctx, w / 2 - 12, -h / 2 - 4, 6, 5, 2, "#303936");
  } else if (definitionId === "water_bottle") {
    roundedRect(ctx, -8, -12, 16, 25, 6, def.color);
    roundedRect(ctx, -5, -16, 10, 6, 2, def.accent);
    roundedRect(ctx, -6, -5, 12, 8, 3, "rgba(220,232,224,.22)");
  } else if (definitionId === "rope_bundle") {
    strokeEllipse(ctx, 0, 0, 13, 8, 5, def.color);
    strokeEllipse(ctx, 0, 0, 8, 4, 2, def.accent);
    roundedRect(ctx, -3, -10, 6, 20, 2, def.accent);
  } else if (definitionId === "compass") {
    roundedRect(ctx, -10, -10, 20, 20, 4, def.color);
    ctx.fillStyle = def.accent;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#263029";
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(3, 3); ctx.lineTo(0, 1); ctx.lineTo(-3, 3); ctx.closePath();
    ctx.fill();
  } else if (definitionId === "bandage") {
    roundedRect(ctx, -12, -8, 24, 16, 4, def.color);
    roundedRect(ctx, -3, -8, 6, 16, 1, def.accent);
    roundedRect(ctx, -12, -2, 24, 4, 1, "rgba(255,255,255,.18)");
  }

  ctx.restore();
}

export function itemGrip(definitionId, facing) {
  const sideSign = facing === "right" ? 1 : facing === "left" ? -1 : 0;
  const profiles = {
    radio_battery: {
      down: { item: { x: 0, y: 5, scale: 1 }, hands: [{ x: -15, y: 5 }, { x: 15, y: 5 }] },
      up: { item: { x: 0, y: -3, scale: .9 }, hands: [{ x: -11, y: -1 }, { x: 11, y: -1 }] },
      side: { item: { x: sideSign * 18, y: 3, scale: .92 }, hands: [{ x: sideSign * 7, y: 4 }, { x: sideSign * 21, y: 4 }] }
    },
    water_bottle: {
      down: { item: { x: 8, y: 5, scale: .9 }, hands: [{ x: 2, y: 0 }, { x: 10, y: 7 }] },
      up: { item: { x: sideSign || 8, y: -1, scale: .82 }, hands: [{ x: 4, y: 0 }, { x: 10, y: 2 }] },
      side: { item: { x: sideSign * 17, y: 4, scale: .82 }, hands: [{ x: sideSign * 8, y: 1 }, { x: sideSign * 15, y: 7 }] }
    },
    rope_bundle: {
      down: { item: { x: 0, y: 5, scale: .95 }, hands: [{ x: -13, y: 5 }, { x: 13, y: 5 }] },
      up: { item: { x: 0, y: -1, scale: .85 }, hands: [{ x: -10, y: 0 }, { x: 10, y: 0 }] },
      side: { item: { x: sideSign * 17, y: 3, scale: .86 }, hands: [{ x: sideSign * 7, y: 3 }, { x: sideSign * 20, y: 3 }] }
    },
    compass: {
      down: { item: { x: 5, y: -1, scale: .78 }, hands: [{ x: -2, y: 1 }, { x: 7, y: 1 }] },
      up: { item: { x: 5, y: -3, scale: .72 }, hands: [{ x: -1, y: -1 }, { x: 7, y: -1 }] },
      side: { item: { x: sideSign * 14, y: 0, scale: .72 }, hands: [{ x: sideSign * 6, y: 0 }, { x: sideSign * 13, y: 1 }] }
    },
    bandage: {
      down: { item: { x: 0, y: 2, scale: .78 }, hands: [{ x: -10, y: 3 }, { x: 10, y: 3 }] },
      up: { item: { x: 0, y: -2, scale: .7 }, hands: [{ x: -8, y: 0 }, { x: 8, y: 0 }] },
      side: { item: { x: sideSign * 14, y: 2, scale: .72 }, hands: [{ x: sideSign * 6, y: 2 }, { x: sideSign * 15, y: 2 }] }
    }
  };
  const profile = profiles[definitionId] || profiles.radio_battery;
  return facing === "left" || facing === "right" ? profile.side : profile[facing];
}

export function renderItemThumbnail(canvas, definitionId) {
  const size = 40;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2 + 1);
  drawItemVisual(ctx, definitionId, { scale: 1 });
  ctx.restore();
}
