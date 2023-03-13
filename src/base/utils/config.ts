import type { GetDataType } from "dilswer";
import { assertDataType, OptionalField, Type, ValidationError } from "dilswer";
import path from "path";
import { html, Output } from "termx-markup";
import { Global } from "../globals";
import { _readdir, _readFile } from "./filesystem";

export const ConfigSchema = Type.RecordOf({
  testDirectory: OptionalField(Type.String),
  parallel: OptionalField(Type.Number),
  setup: OptionalField(Type.String),
  defaultTimeoutThreshold: OptionalField(Type.Number),
  globals: OptionalField(
    Type.Dict(
      Type.Number,
      Type.Boolean,
      Type.String,
      Type.RecordOf({ json: Type.String })
    )
  ),
});

type Config = GetDataType<typeof ConfigSchema>;

class ConfigFacade {
  private defaults: Config = {
    defaultTimeoutThreshold: 5000,
    globals: {},
    parallel: 2,
    testDirectory: "__tests__",
    setup: undefined,
  };

  constructor(private config: Config) {}

  isSet(key: keyof Config) {
    return key in this.config && this.config[key] != null;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key] ?? this.defaults[key];
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

  get testDirectory() {
    return this.get("testDirectory")!;
  }

  get setup() {
    return this.config.setup;
  }
}

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
      Output.print(
        html`<span color="yellow">
          Invalid config file. Using default config instead.
        </span>`
      );

      if (ValidationError.isValidationError(e)) {
        Output.print(html`<pre dim>  Invalid value at: ${e.fieldPath}</pre>`);
      }

      return new ConfigFacade({});
    }
  }
  return new ConfigFacade({});
}
