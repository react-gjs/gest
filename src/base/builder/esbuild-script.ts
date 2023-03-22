import { OptionalField, Type, createValidatedFunction } from "dilswer";
import esbuild from "esbuild";
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
    mockMap: Record<string, string>
  ) {
    if (Object.keys(mockMap).length > 0) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const relativePath = path.relative(
          projectSrcDir,
          path.join(entryDir, args.path)
        );

        if (mockMap[relativePath]) {
          return {
            path: path.join(projectSrcDir, mockMap[relativePath]!),
          };
        } else if (mockMap["./" + relativePath]) {
          return {
            path: path.join(projectSrcDir, mockMap["./" + relativePath]!),
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

    const mockMap: Record<string, string> = {};

    const loadSetup = async (filepath: string) => {
      const setupFile = path.resolve(process.cwd(), filepath);

      const setup = (await import(setupFile)).default;

      const parse = createValidatedFunction(
        setupFileSchema,
        (setup) => {
          if (setup.mocks) {
            Object.assign(mockMap, setup.mocks);
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
      plugins: [
        {
          name: "gest-import-replacer",
          setup(build) {
            build.onResolve({ filter: /^gest$/ }, (args) => {
              return {
                path: path.resolve(__dirname, "../../user-land/index.mjs"),
              };
            });

            PluginHelpers.addIntrospectionImportHandlers(build);
            PluginHelpers.addMockImportHandlers(
              build,
              path.dirname(msg.input),
              msg.projectSrcDir,
              mockMap
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
