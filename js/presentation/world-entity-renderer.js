import { drawItemVisual } from "./item-renderer.js";

function roundedRect(ctx, x, y, width, height, radius, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill(); }
function shadow(ctx, x, y, rx, ry) { ctx.fillStyle = "rgba(20,25,21,.23)"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function drawHighlight(ctx, entity) { ctx.save(); ctx.strokeStyle = "rgba(232,164,79,.9)"; ctx.lineWidth = 3; ctx.setLineDash([8,7]); ctx.beginPath(); ctx.ellipse(entity.x + entity.width / 2, entity.groundY + 5, Math.max(18, entity.width * .55), 11, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
function drawDoor(ctx, e) { const t=Math.min(1,e.animation||0), w=e.width*(1-t*.82); shadow(ctx,e.x+w/2+5,e.groundY+5,Math.max(8,w/2),5); roundedRect(ctx,e.x,e.y,Math.max(5,w),e.height,3,"#6f5d43"); ctx.fillStyle="#303830"; ctx.fillRect(e.x+Math.max(3,w-8),e.y+6,4,4); }

function drawContainer(ctx, e) {
  const t=e.animation||0; shadow(ctx,e.x+e.width/2+5,e.groundY+5,e.width*.48,8);
  if (e.containerType === "locker") {
    roundedRect(ctx,e.x,e.y,e.width,e.height,7,"#59645c"); ctx.fillStyle="#343d37"; ctx.fillRect(e.x+8,e.y+10,e.width-16,3);
    const dw=Math.max(4,e.width*(1-t*.78)); roundedRect(ctx,e.x+3,e.y+4,dw,e.height-8,5,"#69756c"); ctx.fillStyle="#303832"; ctx.fillRect(e.x+Math.max(8,dw-9),e.y+e.height/2,4,12); return;
  }
  if (e.containerType === "duffel") {
    const open=t*5; roundedRect(ctx,e.x,e.y+6+open,e.width,e.height-6-open,15,"#665d48"); ctx.strokeStyle="#383d36"; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(e.x+e.width*.35,e.y+10,e.width*.18,Math.PI,0); ctx.arc(e.x+e.width*.65,e.y+10,e.width*.18,Math.PI,0); ctx.stroke(); return;
  }
  if (e.containerType === "drawer") {
    roundedRect(ctx,e.x,e.y,e.width,e.height,4,"#715f45"); const shift=t*16; roundedRect(ctx,e.x+6,e.y+8+shift,e.width-12,e.height-14,3,"#8b744e"); ctx.fillStyle="#343a34"; ctx.fillRect(e.x+e.width/2-9,e.y+14+shift,18,4); return;
  }
  if (e.containerType === "truck_box") {
    roundedRect(ctx,e.x,e.y+8,e.width,e.height-8,5,"#4f5b50"); roundedRect(ctx,e.x-1,e.y-t*10,e.width+2,13,4,"#6b7669"); ctx.fillStyle="#303832"; ctx.fillRect(e.x+e.width/2-10,e.y+18,20,5); return;
  }
  const body=e.containerType === "tote" ? "#69756c" : "#65543b";
  const lid=e.containerType === "tote" ? "#879086" : "#806a48";
  roundedRect(ctx,e.x,e.y+8,e.width,e.height-8,6,body); roundedRect(ctx,e.x-2,e.y-t*11,e.width+4,14,5,lid);
  if (e.containerType === "crate") { ctx.fillStyle="#3f493f"; ctx.fillRect(e.x+e.width/2-3,e.y+15,6,e.height-18); }
}

function drawProp(ctx,e) {
  shadow(ctx,e.x+e.width/2+8,e.groundY+7,Math.max(18,e.width*.45),Math.max(6,e.height*.09));
  if (e.propType === "sign") { ctx.fillStyle="#4b4434"; ctx.fillRect(e.x+40,e.y+36,10,e.height-20); roundedRect(ctx,e.x,e.y,e.width,48,5,"#d0b06d"); ctx.fillStyle="#354037"; ctx.font="700 10px system-ui"; ctx.textAlign="center"; ctx.fillText("SERVICE",e.x+e.width/2,e.y+20); ctx.fillText("ROUTE",e.x+e.width/2,e.y+34); }
  else if (e.propType === "truck") { roundedRect(ctx,e.x,e.y+26,e.width,e.height-26,18,"#596752"); roundedRect(ctx,e.x+16,e.y,e.width*.34,75,14,"#677860"); ctx.fillStyle="#2f3a34"; ctx.fillRect(e.x+35,e.y+15,55,28); ctx.fillStyle="#252b27"; for (const x of [e.x+66,e.x+270]) { ctx.beginPath(); ctx.arc(x,e.y+e.height-2,25,0,Math.PI*2); ctx.fill(); } }
  else if (e.propType === "picnic") { ctx.fillStyle="#745d40"; ctx.fillRect(e.x+20,e.y+24,e.width-40,26); ctx.fillRect(e.x+2,e.y+75,e.width-4,18); ctx.fillRect(e.x+62,e.y+42,14,e.height-40); ctx.fillRect(e.x+e.width-76,e.y+42,14,e.height-40); }
  else if (e.propType === "shelf") { ctx.fillStyle="#5d4c37"; ctx.fillRect(e.x,e.y,e.width,8); ctx.fillRect(e.x,e.y+34,e.width,8); ctx.fillRect(e.x,e.y+68,e.width,8); ctx.fillRect(e.x+8,e.y,8,e.height); ctx.fillRect(e.x+e.width-16,e.y,8,e.height); }
  else if (e.propType === "radio") { roundedRect(ctx,e.x,e.y,e.width,e.height,5,"#3f4a42"); ctx.fillStyle="#9d8e60"; ctx.fillRect(e.x+8,e.y+7,e.width-16,e.height-14); }
}

function drawItem(ctx,e) { if (!e.revealed) return; shadow(ctx,e.x+e.width/2+3,e.groundY+3,Math.max(8,e.width*.48),5); ctx.save(); ctx.translate(e.x+e.width/2,e.y+e.height/2); drawItemVisual(ctx,e.definitionId,{scale:.9}); ctx.restore(); }

export function drawWorldEntity(ctx, entity, { targeted=false }={}) {
  if (entity.type === "item" && (entity.locationType !== "world" || !entity.revealed)) return;
  if (targeted) drawHighlight(ctx,entity);
  if (entity.type === "door") drawDoor(ctx,entity);
  else if (entity.type === "container") drawContainer(ctx,entity);
  else if (entity.type === "prop") drawProp(ctx,entity);
  else if (entity.type === "item") drawItem(ctx,entity);
}
