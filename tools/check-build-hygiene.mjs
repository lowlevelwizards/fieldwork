import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const [main,index]=await Promise.all([
  readFile(resolve(root,"js/main.js"),"utf8"),
  readFile(resolve(root,"index.html"),"utf8")
]);

function fail(message){throw new Error(`Build hygiene: ${message}`);}
function requireMatch(source,pattern,label){
  const match=source.match(pattern);
  if(!match)fail(`missing ${label}`);
  return match;
}

const buildId=requireMatch(main,/\bconst\s+BUILD_ID\s*=\s*["']([^"']+)["']\s*;/,"canonical BUILD_ID in js/main.js")[1];

const mirrors=[
  [/<meta\s+name=["']fieldwork-build["']\s+content=["']([^"']+)["']\s*\/>/,"HTML build meta"],
  [/<title>Fieldwork\s+([^\s<]+)\s+—/,"document title build"],
  [/<p\s+class=["']eyebrow["']>FIELD TEST\s+([^<]+)<\/p>/,"title-card field-test build"],
  [/<span\s+id=["']title-build-id["']>([^<]+)<\/span>/,"title-card build value"],
  [/<section\s+id=["']live-sandbox-panel["'][\s\S]*?<header><div><span>FIELDWORK\s+([^<]+)<\/span>/,"live sandbox build value"],
  [/<strong\s+id=["']debug-build["']>([^<]+)<\/strong>/,"debug build value"]
];

for(const [pattern,label] of mirrors){
  const value=requireMatch(index,pattern,label)[1].trim();
  if(value!==buildId)fail(`${label} is ${value}; expected ${buildId}`);
}

const localAssets=[...index.matchAll(/(?:href|src)=["']([^"']+\.(?:css|js)(?:\?[^"']*)?)["']/g)].map(match=>match[1]);
if(!localAssets.length)fail("no local CSS/JS assets found in index.html");
for(const asset of localAssets){
  const [path,query=""]=asset.split("?",2);
  if(!query)fail(`${path} has no cache revision`);
  if(query!==`v=${buildId}`)fail(`${asset} must use ?v=${buildId}`);
}

const entry=localAssets.find(asset=>asset.startsWith("js/main.js?"));
if(!entry)fail("index.html does not load js/main.js as the module entrypoint");

console.log(`Build hygiene OK: ${buildId}; ${localAssets.length} HTML assets share one revision token`);
