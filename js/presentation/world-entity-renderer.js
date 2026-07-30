import { getItemDefinition } from "../../data/items.js";

function roundedRect(ctx, x, y, width, height, radius, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill();
}
function drawHighlight(ctx, entity) {
  ctx.save(); ctx.strokeStyle = "rgba(232, 164, 79, 0.9)"; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.ellipse(entity.x + entity.width / 2, entity.groundY + 4, Math.max(18, entity.width * 0.58), 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function drawDoor(ctx, entity) {
  const t = Math.min(1, entity.animation || 0), width = entity.width * (1 - t * 0.82);
  ctx.fillStyle = "rgba(22, 27, 23, 0.2)"; ctx.fillRect(entity.x + 5, entity.y + 8, Math.max(5, width), entity.height);
  roundedRect(ctx, entity.x, entity.y, Math.max(5, width), entity.height, 3, "#6f5d43"); ctx.fillStyle = "#3c433b"; ctx.fillRect(entity.x + Math.max(3, width - 8), entity.y + 6, 4, 4);
}
function drawCrate(ctx, entity) {
  ctx.fillStyle = "rgba(20, 25, 21, 0.24)"; ctx.beginPath(); ctx.ellipse(entity.x + entity.width / 2 + 5, entity.groundY + 5, entity.width * 0.5, 10, 0.05, 0, Math.PI * 2); ctx.fill();
  roundedRect(ctx, entity.x, entity.y + 8, entity.width, entity.height - 8, 6, "#65543b");
  const lidLift = entity.state === "searched" ? -12 : entity.state === "searching" ? -4 : 0;
  roundedRect(ctx, entity.x - 2, entity.y + lidLift, entity.width + 4, 14, 5, "#806a48"); ctx.fillStyle = "#3f493f"; ctx.fillRect(entity.x + entity.width / 2 - 3, entity.y + 15, 6, entity.height - 18);
}
function drawItem(ctx, entity) {
  const def = getItemDefinition(entity.definitionId);
  ctx.fillStyle = "rgba(20, 25, 21, 0.24)"; ctx.beginPath(); ctx.ellipse(entity.x + entity.width / 2 + 3, entity.groundY + 3, Math.max(8, entity.width * 0.48), 5, 0, 0, Math.PI * 2); ctx.fill();
  if (entity.definitionId === "water_bottle") {
    roundedRect(ctx, entity.x + 3, entity.y + 4, entity.width - 6, entity.height - 4, 6, def.color); roundedRect(ctx, entity.x + 6, entity.y, entity.width - 12, 7, 2, def.accent);
  } else if (entity.definitionId === "rope_bundle") {
    ctx.strokeStyle = def.color; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(entity.x + entity.width / 2, entity.y + entity.height / 2, 9, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = def.accent; ctx.lineWidth = 2; ctx.stroke();
  } else if (entity.definitionId === "compass") {
    roundedRect(ctx, entity.x, entity.y, entity.width, entity.height, 4, def.color); ctx.fillStyle = def.accent; ctx.beginPath(); ctx.arc(entity.x + entity.width / 2, entity.y + entity.height / 2, 5, 0, Math.PI * 2); ctx.fill();
  } else if (entity.definitionId === "bandage") {
    roundedRect(ctx, entity.x, entity.y, entity.width, entity.height, 4, def.color); ctx.fillStyle = def.accent; ctx.fillRect(entity.x + entity.width / 2 - 2, entity.y + 2, 4, entity.height - 4);
  } else {
    roundedRect(ctx, entity.x, entity.y, entity.width, entity.height, 4, def.color); roundedRect(ctx, entity.x + 5, entity.y + 4, entity.width - 10, entity.height - 8, 3, def.accent);
    roundedRect(ctx, entity.x + 6, entity.y - 4, 6, 5, 2, "#303936"); roundedRect(ctx, entity.x + entity.width - 12, entity.y - 4, 6, 5, 2, "#303936");
  }
}
export function drawWorldEntity(ctx, entity, { targeted = false } = {}) {
  if (entity.type === "item" && entity.locationType !== "world") return;
  if (targeted) drawHighlight(ctx, entity);
  if (entity.type === "door") drawDoor(ctx, entity); else if (entity.type === "crate") drawCrate(ctx, entity); else if (entity.type === "item") drawItem(ctx, entity);
}
