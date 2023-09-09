import type {
  ParseToJsonSchemaOptions,
  TsParsingOptions,
} from "dilswer";
import { OptionalField, Type, toJsonSchema, toTsType } from "dilswer";
import { BaseReporter } from "../progress/base-reporter";

const ReporterType = Type.Custom((v): v is new () => BaseReporter => {
  return (
    (typeof v === "object" || typeof v === "function") &&
    v != null &&
    v.prototype instanceof BaseReporter
  );
});

ReporterType.setExtra({
  typeName: "BaseReporter",
  path: "../progress/base-reporter",
  valueImport: true,
});

export const ConfigSchema = Type.RecordOf({
  srcDir: OptionalField(Type.String),
  testDir: OptionalField(Type.String),
  parallel: OptionalField(Type.Number),
  setup: OptionalField(Type.String),
  defaultTimeoutThreshold: OptionalField(Type.Number),
  globals: OptionalField(
    Type.Dict(
      Type.Number,
      Type.Boolean,
      Type.String,
      Type.ArrayOf(Type.Unknown),
      Type.RecordOf({}),
    ),
  ),
  introspectedLibVersion: OptionalField(
    Type.RecordOf({
      atk: OptionalField(Type.String),
      gmodule: OptionalField(Type.String),
      gobject: OptionalField(Type.String),
      gdk: OptionalField(Type.String),
      gdkPixbuf: OptionalField(Type.String),
      graphene: OptionalField(Type.String),
      gsk: OptionalField(Type.String),
      gtk: OptionalField(Type.String),
      harfbuzz: OptionalField(Type.String),
      pango: OptionalField(Type.String),
      pangoCairo: OptionalField(Type.String),
      soup: OptionalField(Type.String),
      cairo: OptionalField(Type.String),
      xlib: OptionalField(Type.String),
    }),
  ),
  errorReporterParser: OptionalField(
    Type.Function.setExtra({
      typeName: "ErrorReporterParser",
      path: "./error-reporter-parser-type",
    }),
  ),
  errorStackParser: OptionalField(
    Type.Function.setExtra({
      typeName: "ErrorStackParser",
      path: "./error-stack-parser-type",
    }),
  ),
  reporters: OptionalField(
    Type.ArrayOf(Type.Literal("default"), ReporterType),
  ),
});

ConfigSchema.setTitle("Config");

export const generateConfigSchema = (
  options?: ParseToJsonSchemaOptions | undefined,
) => {
  return toJsonSchema(ConfigSchema, options);
};

export const generateConfigType = (
  options?: Partial<TsParsingOptions>,
) => {
  return toTsType(ConfigSchema, options);
};

// Config options description

ConfigSchema.recordOf.defaultTimeoutThreshold.type.setDescription(
  "Default timeout threshold for tests in milliseconds. If any test takes longer than this threshold, it will fail. Default value is 5000ms.",
);

ConfigSchema.recordOf.parallel.type.setDescription(
  "Defines how many test Suites can be ran in parallel. Although currently all tests are always ran on a single thread, meaning this option will mostly only affect tests that are heavily asynchronous. Defaults to `2`.",
);

ConfigSchema.recordOf.srcDir.type.setDescription(
  "Directory where your source files are located. (module mocks should be defined as filepaths relative to this dir) Default is the current directory.",
);

ConfigSchema.recordOf.testDir.type.setDescription(
  "The directory where the test files are located. Defaults to `./__tests__`.",
);

ConfigSchema.recordOf.setup.type.setDescription(
  "Path to a setup file that can contain module mock's import maps.",
);

ConfigSchema.recordOf.globals.type.setDescription(
  "Global variables that will be available to all tests.",
);

ConfigSchema.recordOf.introspectedLibVersion.type.setDescription(
  "Specify the default version for the given libraries imported via the GObject Introspection (`gi`).\n\n`GLib` and `Gio` versions cannot be changed, since gest is dependant on those.",
);

ConfigSchema.recordOf.errorReporterParser.type.setDescription(
  "A function that allows to modify and customize the error messages that are printed in the console output when running tests.\n\nEach Error intercepted during a test run will be passed to this function along with the message that would be printed by default. The returned string will be printed as the error message instead.",
);

ConfigSchema.recordOf.reporters.type.setDescription(
  "An array of reporters to use. Default is `['default']`.",
);
