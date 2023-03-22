#!/usr/bin/env node

import { build } from "@ncpa0cpl/nodepack";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rimraf from "rimraf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const p = (loc) => path.resolve(__dirname, "..", loc);

async function generateConfigSchema() {
  const { generateConfigSchema } = await import(
    "../dist/esm/base/utils/config-schema.mjs"
  );

  const schema = generateConfigSchema();

  return fs.writeFile(
    p("dist/gest-config.schema.json"),
    JSON.stringify(schema, null, 2)
  );
}

async function main() {
  try {
    const shouldCleanDist = process.argv.includes("--clean");

    if (shouldCleanDist) {
      try {
        await rimraf(p("dist"));
      } catch {
        // do nothing
      }
    }

    const pkg = await fs.readFile(p("package.json")).then(JSON.parse);

    await build({
      target: "ES2022",
      srcDir: p("src"),
      outDir: p("dist"),
      tsConfig: p("tsconfig.json"),
      formats: ["esm"],
      declarations: true,
      exclude: /.*\.d\.ts$/,
      compileVendors: pkg.bundledDependencies,
    });

    await generateConfigSchema();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
