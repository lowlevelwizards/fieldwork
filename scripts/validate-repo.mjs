import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const errors = [];
const warnings = [];

const requiredRuntimeFiles = [
  "index.html",
  "js/main.js",
  "js/game.js",
  "js/continuous-game-state.js",
];

const allowedDataModules = new Set([
  "items.js",
  "map.js",
  "operator-kits.js",
  "operators.js",
]);

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

for (const path of requiredRuntimeFiles) {
  if (!existsSync(join(repoRoot, path))) fail(`Missing required runtime file: ${path}`);
}

for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
  if (entry.isFile() && extname(entry.name) === ".js") {
    fail(`Root-level gameplay JavaScript is not allowed: ${entry.name}`);
  }
}

const dataDir = join(repoRoot, "data");
for (const moduleName of allowedDataModules) {
  if (!existsSync(join(dataDir, moduleName))) fail(`Missing canonical data module: data/${moduleName}`);
}

for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
  if (entry.isFile() && extname(entry.name) === ".js" && !allowedDataModules.has(entry.name)) {
    fail(`Behavior/source module found in data/: data/${entry.name}`);
  }
}

const indexHtml = readFileSync(join(repoRoot, "index.html"), "utf8");
if (!/<script[^>]+type=["']module["'][^>]+src=["']js\/main\.js(?:\?[^"']*)?["']/i.test(indexHtml)) {
  fail("index.html must load js/main.js as the module entrypoint");
}

const sourceFiles = [
  ...walk(join(repoRoot, "js")).filter((path) => extname(path) === ".js"),
  ...[...allowedDataModules].map((name) => join(dataDir, name)),
];

const staticImportPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /import\(\s*["']([^"']+)["']\s*\)/g;

for (const sourcePath of sourceFiles) {
  const source = readFileSync(sourcePath, "utf8");
  const repoPath = relative(repoRoot, sourcePath).replaceAll("\\", "/");
  const specifiers = [];

  for (const pattern of [staticImportPattern, dynamicImportPattern]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) specifiers.push(match[1]);
  }

  for (const specifier of specifiers) {
    if (!specifier.startsWith(".")) continue;
    if (specifier.includes("?v=")) {
      warn(`${repoPath}: internal cache-buster remains (${specifier})`);
    }

    const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
    const target = resolve(dirname(sourcePath), cleanSpecifier);
    if (!existsSync(target) || !statSync(target).isFile()) {
      fail(`${repoPath}: unresolved relative import ${specifier}`);
    }
  }
}

if (warnings.length) {
  console.warn(`Fieldwork repository validation: ${warnings.length} warning(s)`);
  for (const message of warnings) console.warn(`  WARN ${message}`);
}

if (errors.length) {
  console.error(`Fieldwork repository validation failed: ${errors.length} error(s)`);
  for (const message of errors) console.error(`  ERROR ${message}`);
  process.exit(1);
}

console.log(`Fieldwork repository validation passed (${sourceFiles.length} source/data modules checked).`);
