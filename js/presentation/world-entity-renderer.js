function roundedRect(ctx, x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawHighlight(ctx, entity) {
  ctx.save();
  ctx.strokeStyle = "rgba(232, 164, 79, 0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.ellipse(entity.x + entity.width / 2, entity.groundY + 4, Math.max(22, entity.width * 0.58), 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDoor(ctx, entity) {
  const t = Math.min(1, entity.animation || 0);
  const width = entity.width * (1 - t * 0.82);
  ctx.fillStyle = "rgba(22, 27, 23, 0.2)";
  ctx.fillRect(entity.x + 5, entity.y + 8, Math.max(5, width), entity.height);
  roundedRect(ctx, entity.x, entity.y, Math.max(5, width), entity.height, 3, "#6f5d43");
  ctx.fillStyle = "#3c433b";
  ctx.fillRect(entity.x + Math.max(3, width - 8), entity.y + 6, 4, 4);
}

function drawCrate(ctx, entity) {
  ctx.fillStyle = "rgba(20, 25, 21, 0.24)";
  ctx.beginPath();
  ctx.ellipse(entity.x + entity.width / 2 + 5, entity.groundY + 5, entity.width * 0.5, 10, 0.05, 0, Math.PI * 2);
  ctx.fill();
  roundedRect(ctx, entity.x, entity.y + 8, entity.width, entity.height - 8, 6, "#65543b");
  const lidLift = entity.state === "searched" ? -12 : entity.state === "searching" ? -4 : 0;
  roundedRect(ctx, entity.x - 2, entity.y + lidLift, entity.width + 4, 14, 5, "#806a48");
  ctx.fillStyle = "#3f493f";
  ctx.fillRect(entity.x + entity.width / 2 - 3, entity.y + 15, 6, entity.height - 18);
}

function drawBattery(ctx, entity) {
  ctx.fillStyle = "rgba(20, 25, 21, 0.24)";
  ctx.beginPath();
  ctx.ellipse(entity.x + entity.width / 2 + 3, entity.groundY + 3, entity.width * 0.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  roundedRect(ctx, entity.x, entity.y, entity.width, entity.height, 4, "#3d4741");
  roundedRect(ctx, entity.x + 5, entity.y + 4, entity.width - 10, entity.height - 8, 3, "#6e6e5e");
  roundedRect(ctx, entity.x + 6, entity.y - 4, 6, 5, 2, "#303936");
  roundedRect(ctx, entity.x + entity.width - 12, entity.y - 4, 6, 5, 2, "#303936");
}

export function drawWorldEntity(ctx, entity, { targeted = false } = {}) {
  if (entity.type === "item" && entity.locationType !== "world") return;
  if (targeted) drawHighlight(ctx, entity);
  if (entity.type === "door") drawDoor(ctx, entity);
  else if (entity.type === "crate") drawCrate(ctx, entity);
  else if (entity.type === "item") drawBattery(ctx, entity);
}
