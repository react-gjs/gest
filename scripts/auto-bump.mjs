#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";

const ignore = ["git-hook-tasks"];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.join(__dirname, "..");

async function main() {
  const packageJsonPath = path.join(cwd, "package.json");

  const pkg = await fs.readFile(packageJsonPath, "utf-8").then(JSON.parse);

  const dependencies = Object.keys(pkg.dependencies);
  const devDependencies = Object.keys(pkg.devDependencies);

  const allDependencies = [...dependencies, ...devDependencies].filter(
    (dep) => !ignore.includes(dep)
  );

  const process = spawn("yarn", ["up", ...allDependencies], {
    cwd,
    stdio: "inherit",
  });

  await new Promise((resolve, reject) =>
    process.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject();
      }
    })
  );
}

main().catch((err) => {
  process.exit(1);
});
