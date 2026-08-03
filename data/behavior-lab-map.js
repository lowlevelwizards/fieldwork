// Authored geometry for the intentional Behavior Lab.
export const sandboxMap={
 worldBounds:{width:5500,height:2000},
 sandboxLayout:{
  name:"Fieldwork Behavior Lab",
  subtitle:"One question at a time",
  controlWalk:{x:70,y:1570,width:5360,height:320},
  zones:[
   {id:"open_contact",index:"01",name:"OPEN CONTACT",x:100,y:170,width:940,height:1320},
   {id:"observation",index:"02",name:"OBSERVATION",x:1100,y:170,width:940,height:1320},
   {id:"cover_position",index:"03",name:"COVER & POSITION",x:2100,y:170,width:1160,height:1320},
   {id:"casualty_recovery",index:"04",name:"CASUALTY RECOVERY",x:3320,y:170,width:980,height:1320},
   {id:"objective_initiative",index:"05",name:"OBJECTIVE INITIATIVE",x:4380,y:170,width:1000,height:1320}
  ],
  northLine:{y:360,label:"NORTH / PRESSURE"},
  southLine:{y:1410,label:"SOUTH / RESPONSE"}
 },
 spawn:{x:570,y:1760},
 extraction:{x:180,y:1760,radius:72},
 road:[{x:0,y:825},{x:5500,y:825},{x:5500,y:1065},{x:0,y:1065}],
 shed:{x:6000,y:5000,width:1,height:1,wallThickness:1,doorGap:{side:"bottom",start:0,width:1}},
 site:{
  name:"Fieldwork Behavior Lab",
  workArea:{x:80,y:1550,width:5340,height:350},
  truck:{x:0,y:0,width:0,height:0},
  breakArea:{x:0,y:0,width:0,height:0},
  trailhead:{x:100,y:1760}
 },
 places:{
  pull_off:{id:"pull_off",name:"Behavior Lab",bounds:{x:0,y:0,width:5500,height:2000}},
  north_culvert:{id:"north_culvert",name:"Behavior Lab",bounds:{x:0,y:0,width:5500,height:2000},arrival:{x:2750,y:1000,radius:260}}
 },
 trail:[{x:100,y:1760},{x:5400,y:1760}],
 culvert:{x:6000,y:5000,width:1,height:1,water:{x:6000,y:5000,width:1,height:1},crossing:{x:6000,y:5000,width:1,height:1}},
 obstacles:[
  // Observation bay: irregular concealment with incomplete sight lines.
  {type:"tree",x:1260,y:650,radius:58},{type:"tree",x:1460,y:770,radius:66},
  {type:"tree",x:1710,y:705,radius:62},{type:"tree",x:1910,y:820,radius:58},
  {type:"tree",x:1840,y:1180,radius:45},
  // 2.0J activity fixture: block each security responsibility from its start while leaving the opposing observer's sight line open.
  {type:"tree",x:1815,y:575,radius:48},{type:"tree",x:1355,y:1180,radius:48},
  // Cover bay: three deliberately separated positions on each side.
  {type:"rock",x:2450,y:700,radius:54},{type:"rock",x:2700,y:690,radius:64},{type:"rock",x:2950,y:710,radius:54},
  {type:"rock",x:2450,y:1190,radius:54},{type:"rock",x:2700,y:1200,radius:64},{type:"rock",x:2950,y:1185,radius:54},
  // Casualty bay: exposed patient with two plausible recovery positions.
  {type:"rock",x:3480,y:1120,radius:58},{type:"rock",x:4010,y:1160,radius:60},
  {type:"tree",x:3420,y:690,radius:64},{type:"tree",x:4100,y:735,radius:62},
  // Objective bay: several approach possibilities around a clear central worksite.
  {type:"tree",x:4520,y:650,radius:58},{type:"tree",x:5240,y:660,radius:58},
  {type:"rock",x:4545,y:1080,radius:54},{type:"rock",x:5210,y:1090,radius:56}
 ],
 brush:[
  {x:1260,y:735,radius:135},{x:1450,y:850,radius:150},{x:1660,y:800,radius:165},{x:1880,y:900,radius:145},
  {x:2290,y:930,radius:90},{x:3120,y:950,radius:90},
  {x:3440,y:1240,radius:105},{x:4050,y:1270,radius:110},
  {x:4490,y:1220,radius:92},{x:5260,y:1230,radius:96}
 ]
};