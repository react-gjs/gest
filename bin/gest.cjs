#!/usr/bin/env node

const childProcess = require("child_process");
const path = require("path");

const args = process.argv.slice(2);

const proc = childProcess.spawn(
  "gjs",
  [
    "-m",
    path.resolve(__dirname, "..", "dist", "esm", "base", "index.mjs"),
    ...args,
  ],
  {
    stdio: "inherit",
    shell: true,
  }
);

proc.on("exit", (code) => {
  process.exit(code);
});
