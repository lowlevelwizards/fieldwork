import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RETIRED_DUPLICATE_PATHS } from "./retired-duplicates.mjs";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const entry=resolve(root,"js/main.js");
const importPatterns=[
  /^\s*import\s+(?:[^;]*?\sfrom\s*)?["']([^"']+)["']\s*;/gm,
  /^\s*export\s+[^;]*?\sfrom\s*["']([^"']+)["']\s*;/gm
];
const graph=new Map();
const reachable=new Set();

function resolveSpecifier(from,specifier){
  if(!specifier.startsWith("."))return null;
  const clean=specifier.split(/[?#]/,1)[0];
  const candidate=resolve(dirname(from),clean);
  return extname(candidate)?candidate:`${candidate}.js`;
}

async function visit(file){
  if(reachable.has(file))return;
  reachable.add(file);
  const source=await readFile(file,"utf8");
  const dependencies=[];
  for(const pattern of importPatterns){
    pattern.lastIndex=0;
    for(const match of source.matchAll(pattern)){
      const dependency=resolveSpecifier(file,match[1]);
      if(!dependency)continue;
      try{await access(dependency,constants.R_OK);}catch{
        throw new Error(`Unresolved import in ${relative(root,file)}: ${match[1]}`);
      }
      dependencies.push(dependency);
    }
  }
  graph.set(file,dependencies);
  for(const dependency of dependencies)await visit(dependency);
}

function findCycle(){
  const visiting=new Set();
  const visited=new Set();
  const path=[];
  function walk(node){
    if(visiting.has(node))return [...path.slice(path.indexOf(node)),node];
    if(visited.has(node))return null;
    visiting.add(node);path.push(node);
    for(const dependency of graph.get(node)??[]){
      const cycle=walk(dependency);if(cycle)return cycle;
    }
    path.pop();visiting.delete(node);visited.add(node);return null;
  }
  for(const node of graph.keys()){
    const cycle=walk(node);if(cycle)return cycle;
  }
  return null;
}

async function collectJavaScript(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if([".git","node_modules","tests","tools"].includes(entry.name))continue;
    const path=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await collectJavaScript(path));
    else if(extname(entry.name)===".js")files.push(resolve(path));
  }
  return files;
}

await visit(entry);
const cycle=findCycle();
if(cycle)throw new Error(`Import cycle: ${cycle.map(file=>relative(root,file)).join(" -> ")}`);


for(const path of RETIRED_DUPLICATE_PATHS){
  try{await access(resolve(root,path),constants.F_OK);throw new Error(`Retired duplicate still exists: ${path}`);}catch(error){
    if(error?.message?.startsWith("Retired duplicate"))throw error;
  }
}

const all=await collectJavaScript(root);
const unreachable=all.filter(file=>!reachable.has(file));
if(unreachable.length)throw new Error(`Unreachable active JavaScript: ${unreachable.map(file=>relative(root,file)).join(", ")}`);
console.log(`Imports OK: ${reachable.size} reachable modules, no cycles, no retired duplicates`);
