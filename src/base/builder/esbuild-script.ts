import { OptionalField, Type, createValidatedFunction } from "dilswer";
import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";
import * as url from "url";
import type { BuildScriptMessage } from "./build-script-message";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const setupFileSchema = Type.RecordOf({
  mocks: OptionalField(Type.Dict(Type.String)),
});

function getDefineForGlobals(
  globals: Exclude<BuildScriptMessage["globals"], undefined>
) {
  const define: Record<string, any> = {};

  for (const [key, globalDef] of Object.entries(globals)) {
    if (globalDef.kind === "json") {
      define[key] = globalDef.value.json;
      define[`globalThis.${key}`] = globalDef.value.json;
    } else if (globalDef.kind === "value") {
      define[key] = JSON.stringify(globalDef.value);
      define[`globalThis.${key}`] = JSON.stringify(globalDef.value);
    } else {
      define[key] = globalDef.value;
      define[`globalThis.${key}`] = globalDef.value;
    }
  }

  return define;
}

export class MockRegistry {
  private mocks = new Map<string, string>();

  hasAny() {
    return this.mocks.size > 0;
  }

  add(filepath: string, mockFilepath: string) {
    this.mocks.set(filepath, mockFilepath);
  }

  getPackageMock(packageName: string) {
    return this.mocks.get(packageName);
  }

  get(filepath: string) {
    const normalized = path.normalize(filepath);

    if (this.mocks.has(normalized)) {
      return this.mocks.get(normalized);
    } else if (this.mocks.has("./" + normalized)) {
      return this.mocks.get("./" + normalized);
    } else {
      const hasExt = path.extname(normalized) !== "";

      if (hasExt) {
        const withoutExt = path.join(
          path.dirname(normalized),
          path.basename(normalized, path.extname(normalized))
        );
        if (this.mocks.has(withoutExt)) {
          return this.mocks.get(withoutExt);
        } else {
          return this.mocks.get("./" + withoutExt);
        }
      } else {
        return undefined;
      }
    }
  }
}

class PluginHelpers {
  static addIntrospectionImportHandlers(build: esbuild.PluginBuild) {
    build.onResolve({ filter: /gi:.*/ }, (args) => {
      return {
        external: true,
      };
    });
  }

  static addMockImportHandlers(
    build: esbuild.PluginBuild,
    entryDir: string,
    projectSrcDir: string,
    mocks: MockRegistry
  ) {
    if (mocks.hasAny()) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const isFileImport =
          args.path.startsWith("./") || args.path.startsWith("../");

        if (!isFileImport) {
          const mock = mocks.get(args.path);
          if (mock) {
            return {
              path: path.join(projectSrcDir, mock!),
            };
          }
          return;
        }

        const absPath = path.resolve(args.resolveDir, args.path);
        const relativePath = path.relative(projectSrcDir, absPath);

        const mock = mocks.get(relativePath);
        if (mock) {
          return {
            path: path.join(projectSrcDir, mock!),
          };
        }
      });
    }
  }

  static addSystemImportHandlers(
    build: esbuild.PluginBuild,
    msg: BuildScriptMessage
  ) {
    build.onResolve({ filter: /system/ }, (args) => {
      return {};
    });

    build.onLoad({ filter: /system/ }, (args) => {
      return {
        contents: /* js */ `
          export const version = imports.system.version;
          export const programArgs = [];
          export const programInvocationName = ${JSON.stringify(msg.output)};
          export const programPath = ${JSON.stringify(msg.output)};

          export const exit = (code: number) => {
            console.warn("You cannot exit the program from within a test.")
            throw new Error("App Exit with code "+ String(code));
          };

          const _system = {
            version,
            programArgs,
            programInvocationName,
            programPath,
            exit,
          };

          export default _system;
        `,
      };
    });
  }
}

async function main() {
  try {
    if (!process.argv[2])
      throw new Error("Missing required argument for test building script.");

    const encodedMsg = process.argv[2].trim();

    const msg: BuildScriptMessage = JSON.parse(atob(encodedMsg).trim());

    const mocks = new MockRegistry();

    const loadSetup = async (filepath: string) => {
      const setupFile = path.resolve(process.cwd(), filepath);

      const setup = (await import(setupFile)).default;

      const parse = createValidatedFunction(
        setupFileSchema,
        (setup) => {
          if (setup.mocks) {
            for (const [key, value] of Object.entries(setup.mocks)) {
              mocks.add(key, value);
            }
          }
        },
        (err) => {
          throw new Error(
            `Test setup is invalid. '${err.fieldPath}' was not what was expected.`
          );
        }
      );

      parse(setup);
    };

    if (msg.setup.main) {
      await loadSetup(msg.setup.main);
    }

    if (msg.setup.secondary) {
      await loadSetup(msg.setup.secondary);
    }

    const fileBanner = await fs.readFile(
      path.join(__dirname, "injects.mjs"),
      "utf-8"
    );

    await esbuild.build({
      target: "es2022",
      entryPoints: [msg.input],
      bundle: true,
      define: getDefineForGlobals(msg.globals ?? {}),
      outfile: msg.output,
      format: "esm",
      minify: false,
      keepNames: true,
      sourcemap: true,
      banner: {
        js: fileBanner,
      },
      plugins: [
        {
          name: "gest-import-replacer",
          setup(build) {
            build.onResolve(
              { filter: /^gest$|^@reactgjs\/gest$|^gest-globals$/ },
              () => {
                return {
                  path: path.resolve(__dirname, "../../user-land/index.mjs"),
                };
              }
            );

            PluginHelpers.addIntrospectionImportHandlers(build);
            PluginHelpers.addMockImportHandlers(
              build,
              path.dirname(msg.input),
              msg.projectSrcDir,
              mocks
            );
            PluginHelpers.addSystemImportHandlers(build, msg);
          },
        },
      ],
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
