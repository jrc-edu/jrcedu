#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, "portal");
const target = path.join(root, "public", "portal");
const checkOnly = process.argv.includes("--check");
const supported = new Set([".html", ".js", ".css"]);

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await filesIn(absolute));
    } else if (supported.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

const sourceFiles = await filesIn(source);
const mismatches = [];
for (const sourceFile of sourceFiles) {
  const relative = path.relative(source, sourceFile);
  const targetFile = path.join(target, relative);
  const [left, right] = await Promise.all([
    fs.readFile(sourceFile),
    fs.readFile(targetFile).catch(() => null)
  ]);
  if (!right || !left.equals(right)) mismatches.push(relative);
}

if (checkOnly) {
  if (mismatches.length) {
    console.error(`门户镜像不同步：${mismatches.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`门户镜像正常：${sourceFiles.length} 个源文件一致。`);
  }
} else {
  for (const relative of mismatches) {
    const sourceFile = path.join(source, relative);
    const targetFile = path.join(target, relative);
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.copyFile(sourceFile, targetFile);
  }
  console.log(mismatches.length ? `已同步 ${mismatches.length} 个门户文件到 public/portal。` : "门户镜像已是最新。");
}
