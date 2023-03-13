const { build } = require("@ncpa0cpl/nodepack");
const path = require("path");

const p = (loc) => path.resolve(__dirname, "..", loc);

async function main() {
  try {
    const pkg = require(p("package.json"));

    await build({
      target: "ESNext",
      srcDir: p("src"),
      outDir: p("dist"),
      tsConfig: p("tsconfig.json"),
      formats: ["esm"],
      declarations: true,
      exclude: /.*\.d\.ts$/,
      compileVendors: pkg.bundledDependencies,
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
