import { assertDataType, ValidationError } from "dilswer";
import { html, Output } from "termx-markup";
import { Global } from "../globals";
import type { Config } from "./config-schema";
import { ConfigSchema } from "./config-schema";
import { _readdir, _readFile } from "./filesystem";
import path from "./path";

class ConfigFacade {
  private defaults: Config = {
    srcDir: Global.getCwd(),
    defaultTimeoutThreshold: 5000,
    globals: {},
    parallel: 2,
    testDir: "__tests__",
    setup: undefined,
  };

  constructor(private config: Config) {}

  isSet(key: keyof Config) {
    return key in this.config && this.config[key] != null;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key] ?? this.defaults[key];
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

  get setup() {
    return this.config.setup;
  }
}

export type { ConfigFacade };

export async function loadConfig() {
  const files = await _readdir(Global.getCwd());

  if (files.includes("gest.config.json")) {
    const configText = await _readFile(
      path.join(Global.getCwd(), "gest.config.json")
    );
    const config = JSON.parse(configText);

    try {
      assertDataType(ConfigSchema, config);
      return new ConfigFacade(config);
    } catch (e) {
      Output.print(html`<span color="yellow"> Invalid config file. </span>`);

      if (ValidationError.isValidationError(e)) {
        Output.print(html`<pre>  Invalid value at: ${e.fieldPath}</pre>`);
      }

      Output.print("");

      return null;
    }
  }

  Output.print(
    html`<span color="yellow">
      Config file not found. Using default config instead.
    </span>`
  );
  return new ConfigFacade({});
}
