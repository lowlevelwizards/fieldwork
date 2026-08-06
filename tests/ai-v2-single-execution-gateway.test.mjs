import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root=new URL("../js/ai-v2/",import.meta.url).pathname;
function files(dir){return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):path.endsWith(".js")?[path]:[];});}

test("the action arbiter is the only AI V2 module that starts scheduler actions",()=>{
  const offenders=[];
  for(const path of files(root)){
    const source=readFileSync(path,"utf8");
    if(!/\b(?:this\.)?scheduler\.start\s*\(/.test(source))continue;
    const name=relative(root,path).replaceAll("\\","/");
    if(name!=="authority/actor-action-arbiter.js")offenders.push(name);
  }
  assert.deepEqual(offenders,[]);
});

test("behavior runtimes request cancellation through the unified actor brain",()=>{
  const offenders=[];
  for(const path of files(join(root,"actors"))){
    const source=readFileSync(path,"utf8");
    if(/\bscheduler\.cancel(?:Action|Actor)\s*\(/.test(source)&&!path.endsWith("unified-actor-brain.js"))offenders.push(relative(root,path).replaceAll("\\","/"));
  }
  assert.deepEqual(offenders,[]);
});
