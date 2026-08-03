import { drawItemVisual } from "./item-renderer.js";

function roundedRect(ctx,x,y,w,h,r,fill){
  ctx.fillStyle=fill;
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  ctx.fill();
}

function shadow(ctx,x,y,rx,ry){
  ctx.fillStyle="rgba(20,25,21,.23)";
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  ctx.fill();
}

function drawHighlight(ctx,e){
  ctx.save();
  ctx.strokeStyle="rgba(232,164,79,.9)";
  ctx.lineWidth=3;
  ctx.setLineDash([8,7]);
  ctx.beginPath();
  ctx.ellipse(e.x+e.width/2,e.groundY+5,Math.max(18,e.width*.55),11,0,0,Math.PI*2);
  ctx.stroke();
  ctx.restore();
}

function drawDoor(ctx,e){
  const t=Math.min(1,e.animation||0);
  const w=e.width*(1-t*.82);
  shadow(ctx,e.x+w/2+5,e.groundY+5,Math.max(8,w/2),5);
  roundedRect(ctx,e.x,e.y,Math.max(5,w),e.height,3,"#6f5d43");
}

function drawContainer(ctx,e){
  const t=e.animation||0;
  shadow(ctx,e.x+e.width/2+5,e.groundY+5,e.width*.48,8);
  if(e.containerType==="locker"){
    roundedRect(ctx,e.x,e.y,e.width,e.height,7,"#59645c");
    const dw=Math.max(4,e.width*(1-t*.78));
    roundedRect(ctx,e.x+3,e.y+4,dw,e.height-8,5,"#69756c");
    return;
  }
  if(e.containerType==="duffel"){
    roundedRect(ctx,e.x,e.y+6+t*5,e.width,e.height-6-t*5,15,"#665d48");
    return;
  }
  if(e.containerType==="drawer"){
    roundedRect(ctx,e.x,e.y,e.width,e.height,4,"#715f45");
    roundedRect(ctx,e.x+6,e.y+8+t*16,e.width-12,e.height-14,3,"#8b744e");
    return;
  }
  const body=e.containerType==="tote"?"#69756c":e.containerType==="truck_box"?"#4f5b50":"#65543b";
  const lid=e.containerType==="tote"?"#879086":"#806a48";
  roundedRect(ctx,e.x,e.y+8,e.width,e.height-8,6,body);
  roundedRect(ctx,e.x-2,e.y-t*11,e.width+4,14,5,lid);
}

export function getFieldRelayVisualState(entity={}){
  const state=entity.state??"offline";
  const progress=Math.max(0,Math.min(1,Number(entity.progress)||0));
  if(state==="operational")return{
    state,progress:1,label:"OPERATIONAL",body:"#45584b",panel:"#26372f",accent:"#9dca76",screen:"#b9e58d",panelOpen:false
  };
  if(state==="being_restored")return{
    state,progress,label:`RESTORING ${Math.round(progress*100)}%`,body:"#5b594a",panel:"#332f29",accent:"#e3a04c",screen:"#e8be67",panelOpen:true
  };
  if(state==="repairable")return{
    state,progress,label:"INSPECTED · REPAIRABLE",body:"#56584f",panel:"#312f2a",accent:"#d8ae63",screen:"#b89b62",panelOpen:true
  };
  return{
    state:"offline",progress,label:"OFFLINE",body:"#4c514b",panel:"#2c302d",accent:"#9a8360",screen:"#756f58",panelOpen:false
  };
}

function drawFieldRelay(ctx,e){
  const visual=getFieldRelayVisualState(e);
  const centerX=e.x+e.width/2;
  const bodyY=e.y+18;
  const bodyH=Math.max(50,e.height-18);

  shadow(ctx,centerX+8,e.groundY+8,Math.max(24,e.width*.58),10);

  ctx.fillStyle="rgba(28,34,29,.35)";
  ctx.beginPath();
  ctx.ellipse(centerX,e.groundY+3,Math.max(28,e.width*.65),12,0,0,Math.PI*2);
  ctx.fill();

  ctx.strokeStyle="#303830";
  ctx.lineWidth=5;
  ctx.lineCap="round";
  ctx.beginPath();
  ctx.moveTo(centerX-17,e.groundY-4);
  ctx.lineTo(centerX-24,e.groundY+18);
  ctx.moveTo(centerX+17,e.groundY-4);
  ctx.lineTo(centerX+24,e.groundY+18);
  ctx.stroke();

  roundedRect(ctx,e.x,bodyY,e.width,bodyH,10,visual.body);
  roundedRect(ctx,e.x+7,bodyY+8,e.width-14,bodyH-19,7,visual.panel);

  ctx.fillStyle="#2d352f";
  ctx.fillRect(centerX-4,e.y-1,8,22);
  ctx.strokeStyle="#2d352f";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(centerX,e.y+2);
  ctx.lineTo(centerX-13,e.y-14);
  ctx.moveTo(centerX,e.y+2);
  ctx.lineTo(centerX+13,e.y-14);
  ctx.stroke();

  const screenX=e.x+14;
  const screenY=bodyY+15;
  const screenW=e.width-28;
  const screenH=18;
  roundedRect(ctx,screenX,screenY,screenW,screenH,4,"#18211d");
  ctx.fillStyle=visual.screen;
  ctx.fillRect(
    screenX+4,
    screenY+4,
    Math.max(4,(screenW-8)*(visual.state==="being_restored"?visual.progress:visual.state==="operational"?1:.22)),
    screenH-8
  );

  ctx.fillStyle=visual.accent;
  for(let index=0;index<3;index+=1){
    ctx.beginPath();
    ctx.arc(e.x+16+index*17,bodyY+46,3.5,0,Math.PI*2);
    ctx.fill();
  }

  if(visual.panelOpen){
    ctx.fillStyle="#35352f";
    ctx.beginPath();
    ctx.moveTo(e.x+e.width-4,bodyY+10);
    ctx.lineTo(e.x+e.width+22,bodyY+20);
    ctx.lineTo(e.x+e.width+22,bodyY+bodyH-13);
    ctx.lineTo(e.x+e.width-4,bodyY+bodyH-4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle=visual.accent;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(e.x+e.width+3,bodyY+21);
    ctx.lineTo(e.x+e.width+16,bodyY+27);
    ctx.moveTo(e.x+e.width+3,bodyY+31);
    ctx.lineTo(e.x+e.width+16,bodyY+37);
    ctx.stroke();
  }

  ctx.fillStyle="rgba(18,27,22,.9)";
  ctx.beginPath();
  ctx.roundRect(centerX-58,e.y-48,116,31,10);
  ctx.fill();
  ctx.strokeStyle=visual.accent;
  ctx.lineWidth=1.7;
  ctx.stroke();
  ctx.fillStyle=visual.accent;
  ctx.font="850 8px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText("FIELD RELAY",centerX,e.y-38);
  ctx.fillStyle="rgba(239,235,211,.72)";
  ctx.font="750 6.5px system-ui";
  ctx.fillText(visual.label,centerX,e.y-27);
}

function drawProp(ctx,e){
  if(e.propType==="field_relay"){
    drawFieldRelay(ctx,e);
    return;
  }

  shadow(ctx,e.x+e.width/2+8,e.groundY+7,Math.max(18,e.width*.45),Math.max(6,e.height*.09));
  if(e.propType==="sign"){
    ctx.fillStyle="#4b4434";
    ctx.fillRect(e.x+e.width/2-5,e.y+36,10,e.height-20);
    roundedRect(ctx,e.x,e.y,e.width,48,5,"#d0b06d");
    ctx.fillStyle="#354037";
    ctx.font="700 10px system-ui";
    ctx.textAlign="center";
    ctx.fillText("SERVICE",e.x+e.width/2,e.y+20);
    ctx.fillText("ROUTE",e.x+e.width/2,e.y+34);
  }else if(e.propType==="truck"){
    roundedRect(ctx,e.x,e.y+26,e.width,e.height-26,18,"#596752");
    roundedRect(ctx,e.x+16,e.y,e.width*.34,75,14,"#677860");
    ctx.fillStyle="#252b27";
    for(const x of[e.x+66,e.x+270]){
      ctx.beginPath();
      ctx.arc(x,e.y+e.height-2,25,0,Math.PI*2);
      ctx.fill();
    }
  }else if(e.propType==="picnic"){
    ctx.fillStyle="#745d40";
    ctx.fillRect(e.x+20,e.y+24,e.width-40,26);
    ctx.fillRect(e.x+2,e.y+75,e.width-4,18);
    ctx.fillRect(e.x+62,e.y+42,14,e.height-40);
    ctx.fillRect(e.x+e.width-76,e.y+42,14,e.height-40);
  }else if(e.propType==="shelf"){
    ctx.fillStyle="#5d4c37";
    ctx.fillRect(e.x,e.y,e.width,8);
    ctx.fillRect(e.x,e.y+34,e.width,8);
    ctx.fillRect(e.x,e.y+68,e.width,8);
    ctx.fillRect(e.x+8,e.y,8,e.height);
    ctx.fillRect(e.x+e.width-16,e.y,8,e.height);
  }else if(e.propType==="radio"){
    roundedRect(ctx,e.x,e.y,e.width,e.height,5,"#3f4a42");
    ctx.fillStyle=e.radioPowered?"#8ecb80":"#9d8e60";
    ctx.fillRect(e.x+8,e.y+7,e.width-16,e.height-14);
  }else if(e.propType==="culvert"){
    roundedRect(ctx,e.x,e.y,e.width,e.height,18,"#575d56");
    ctx.fillStyle="#29332f";
    ctx.beginPath();
    ctx.arc(e.x+e.width/2,e.y+e.height/2,45,0,Math.PI*2);
    ctx.fill();
  }else if(e.propType==="debris"){
    ctx.strokeStyle=e.cleared?"#655840":"#4e4533";
    ctx.lineWidth=14;
    ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(e.x+8,e.y+12);
    ctx.lineTo(e.x+e.width-10,e.y+e.height-12);
    ctx.moveTo(e.x+25,e.y+e.height-8);
    ctx.lineTo(e.x+e.width-28,e.y+10);
    ctx.stroke();
  }else if(e.propType==="marker"){
    ctx.fillStyle="#e09a45";
    ctx.fillRect(e.x+15,e.y,8,e.height);
    ctx.fillRect(e.x,e.y+10,e.width,12);
  }else if(e.propType==="recovery"){
    ctx.strokeStyle="rgba(224,154,69,.65)";
    ctx.lineWidth=4;
    ctx.setLineDash([10,8]);
    ctx.strokeRect(e.x,e.y,e.width,e.height);
    ctx.setLineDash([]);
  }
}

function drawItem(ctx,e){
  if(!e.revealed)return;
  shadow(ctx,e.x+e.width/2+3,e.groundY+3,Math.max(8,e.width*.48),5);
  ctx.save();
  ctx.translate(e.x+e.width/2,e.y+e.height/2);
  drawItemVisual(ctx,e.definitionId,{scale:.9,condition:e.condition});
  ctx.restore();
}

export function drawWorldEntity(ctx,entity,{targeted=false}={}){
  if(entity.revealed===false)return;
  if(entity.type==="item"&&!["world","stored"].includes(entity.locationType))return;
  if(targeted)drawHighlight(ctx,entity);
  if(entity.type==="door")drawDoor(ctx,entity);
  else if(entity.type==="container")drawContainer(ctx,entity);
  else if(entity.type==="prop")drawProp(ctx,entity);
  else if(entity.type==="item")drawItem(ctx,entity);
}
