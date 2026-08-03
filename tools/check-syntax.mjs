import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const skipped=new Set([".git","node_modules"]);

async function collect(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(skipped.has(entry.name))continue;
    const path=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await collect(path));
    else if([".js",".mjs"].includes(extname(entry.name)))files.push(path);
  }
  return files;
}

const files=await collect(root);
for(const file of files){
  const result=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  if(result.status!==0){
    process.stderr.write(result.stderr||result.stdout);
    throw new Error(`Syntax check failed: ${relative(root,file)}`);
  }
}
console.log(`Syntax OK: ${files.length} JavaScript modules`);
