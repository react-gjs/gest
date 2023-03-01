import fs from "fs/promises";
import path from "path";
// import rimraf from "rimraf";
import { fileURLToPath, URL } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  await fs.rename(
    path.resolve(__dirname, "../@types/Gjs"),
    path.resolve(__dirname, "../@types/Gjs-declarations")
  );

  const gjs = path.resolve(__dirname, "../@types/Gjs-declarations");
  const types = path.resolve(__dirname, "../@types");

  const files = await fs.readdir(gjs);

  const defs = [];

  for (const file of files) {
    if (file.endsWith(".d.ts") && !file.endsWith("index.d.ts")) {
      const separator = file.lastIndexOf("-");
      const name = file.slice(
        0,
        separator != -1 ? separator : file.indexOf(".d.ts")
      );
      defs.push({
        name,
        file: path.resolve(gjs, file),
      });
    }
  }

  for (const typeDef of defs) {
    const dir = path.resolve(types, typeDef.name);

    let indexContent = await fs.readFile(typeDef.file, "utf-8");

    const importsRegexp = /import .* from ["'].\/.+["'];/g;
    const imports = indexContent.match(importsRegexp);

    if (imports) {
      for (const imp of imports) {
        const importingRegexp = /import (.*) from ["'].\/.+["'];/;
        const importingSearch = imp.match(importingRegexp);
        const importing = importingSearch[1];

        if (!importing) {
          console.error("No import name found in", typeDef.file);
          process.exit(1);
        }

        const importNameRegexp = /import .* from ["'].\/(.+)["'];/;
        const importNameSearch = imp.match(importNameRegexp);
        const importName = importNameSearch[1]
          .replace(".js", "")
          .replace(/-.+/, "");

        indexContent = indexContent.replace(
          imp,
          `import ${importing} from "gi://${importName}";`
        );
      }
    }

    indexContent = indexContent
      .replace(/\n{0,1}export default/g, "\n")
      .replace(/export /g, "\n")
      .replace(/^export /g, "");

    const nsNameRegexp = /namespace (.+) {/;
    const nsNameSearch = indexContent.match(nsNameRegexp);
    const nsName = nsNameSearch[1];

    if (!nsName) {
      console.error("No namespace found in", typeDef.file);
      process.exit(1);
    }

    // find if there's more than one namespace within the file
    const nsLinesRegexp = /namespace (.+) {/g;
    const nsLines = indexContent.match(nsLinesRegexp);
    const hasMultipleNamespaces = [...nsLines].length > 2;

    if (!hasMultipleNamespaces) {
      indexContent += `
        declare module "gi://${nsName}" { 
          export default ${nsName};
        }
        `;
    } else {
      let declareStatement = [
        `declare module "gi://${typeDef.name}" {`,
        "  export {",
      ];

      const nsLinesRegexp = /namespace (.+) {/g;
      const nsLines = indexContent.match(nsLinesRegexp);

      for (const nsLine of nsLines) {
        const nsNameRegexp = /namespace (.+) {/;
        const nsNameSearch = nsLine.match(nsNameRegexp);
        const nsName = nsNameSearch[1];

        if (!nsName) {
          console.error("No namespace found in", typeDef.file);
          process.exit(1);
        }

        declareStatement.push(`    ${nsName},`);
      }

      declareStatement.push("  }", "}");

      indexContent += declareStatement.join("\n");
    }

    await fs.mkdir(dir, { recursive: true });

    // const prettierConfig = await prettier.resolveConfig(
    //   path.resolve(__dirname, "..")
    // );
    await fs.writeFile(path.resolve(dir, "index.d.ts"), indexContent);

    const packagejson = {
      name: `@types/${nsName}`,
      version: "0.0.1",
      main: "",
      types: "index.d.ts",
    };

    await fs.writeFile(
      path.resolve(dir, "package.json"),
      JSON.stringify(packagejson, null, 2)
    );
  }

  // await rimraf(gjs);
}

main();
