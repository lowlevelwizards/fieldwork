import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RETIRED_DUPLICATE_PATHS } from "./retired-duplicates.mjs";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
let removed=0;
for(const path of RETIRED_DUPLICATE_PATHS){
  try{
    await rm(resolve(root,path));
    removed+=1;
    console.log(`Removed ${path}`);
  }catch(error){
    if(error?.code!=="ENOENT")throw error;
  }
}
console.log(`Retired duplicate cleanup complete: ${removed} file(s) removed`);
