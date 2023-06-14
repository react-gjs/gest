import { assertDataType, ValidationError } from "dilswer";
import Fs from "fs-gjs";
import path from "path-gjsify";
import { html, Output } from "termx-markup";
import { Global } from "../globals";
import type { TestRunnerOptions } from "../runner/types";
import { ConfigSchema } from "./config-schema";
import type { Config } from "./config-type";
import type { ErrorReporterParser } from "./error-reporter-parser-type";
import type { ErrorStackParser } from "./error-stack-parser-type";
import { importModule } from "./import-module";

class ConfigFacade {
  private defaults: Config = {
    srcDir: Global.getCwd(),
    defaultTimeoutThreshold: 5000,
    globals: {},
    parallel: 2,
    testDir: "__tests__",
    setup: undefined,
    reporters: ["default"],
  };

  private overrides: Partial<Config> = {};

  constructor(private config: Config) {}

  override<K extends keyof Config>(key: K, value: Config[K]) {
    this.overrides[key] = value;
  }

  isSet(key: keyof Config) {
    return key in this.config && this.config[key] != null;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return (
      this.overrides[key] ?? this.config[key] ?? this.defaults[key]
    );
  }

  get srcDir() {
    return this.get("srcDir")!;
  }

  get defaultTimeoutThreshold() {
    return this.get("defaultTimeoutThreshold")!;
  }

  get globals() {
    return this.get("globals")!;
  }

  get parallel() {
    return this.get("parallel")!;
  }

  get testDir() {
    return this.get("testDir")!;
  }

  get reporters() {
    return this.get("reporters")!;
  }

  get setup() {
    return this.get("setup");
  }

  get introspectedLibVersion() {
    return this.get("introspectedLibVersion");
  }

  get multiprocessing() {
    return this.get("multiprocessing")!;
  }

  get errorReporterParser() {
    return this.get("errorReporterParser") as
      | ErrorReporterParser
      | undefined;
  }

  get errorStackParser() {
    return this.get("errorStackParser") as
      | ErrorStackParser
      | undefined;
  }
}

export { ConfigFacade };

export type ConfigContext = {
  vargs: string[];
  options: TestRunnerOptions;
  importModule: <T>(module: string) => Promise<T>;
};

export type ConfigGetter = (
  context: ConfigContext,
) => Promise<Config> | Config;

export async function loadConfig(
  vargs: string[],
  options: TestRunnerOptions,
) {
  const files = await Fs.listFilenames(Global.getCwd());

  const jsTypeConfig = files.find((filename) =>
    /gest\.config\.(js|mjs)$/i.test(filename),
  );

  if (jsTypeConfig) {
    let configLoaded = false;

    const configFilePath = path.join(Global.getCwd(), jsTypeConfig);
    try {
      const getConfig: ConfigGetter = await import(
        "file://" + configFilePath
      ).then((module) => module.default);

      const config = await getConfig({
        vargs,
        options,
        importModule,
      });
      configLoaded = true;

      assertDataType(ConfigSchema, config);
      return new ConfigFacade(config);
    } catch (e) {
      if (!configLoaded) {
        Output.print(html`
          <line color="yellow">
            Unable to get the config. Error ocurred in:
          </line>
          <line color="cyan">${configFilePath}</line>
          <pad size="2"><pre>${String(e)}</pre></pad>
        `);
      } else {
        Output.print(
          html`<span color="yellow"> Invalid config file. </span>`,
        );

        if (ValidationError.isValidationError(e)) {
          Output.print(
            html`<pre>  Invalid value at: ${e.fieldPath}</pre>`,
          );
        }
      }

      Output.print("");

      return null;
    }
  }

  if (files.includes("gest.config.json")) {
    const configText = await Fs.readTextFile(
      path.join(Global.getCwd(), "gest.config.json"),
    );
    const config = JSON.parse(configText);

    try {
      assertDataType(ConfigSchema, config);
      return new ConfigFacade(config);
    } catch (e) {
      Output.print(
        html`<span color="yellow"> Invalid config file. </span>`,
      );

      if (ValidationError.isValidationError(e)) {
        Output.print(
          html`<pre>  Invalid value at: ${e.fieldPath}</pre>`,
        );
      }

      Output.print("");

      return null;
    }
  }

  Output.print(
    html`<span color="yellow">
      Config file not found. Using default config instead.
    </span>`,
  );
  return new ConfigFacade({});
}
