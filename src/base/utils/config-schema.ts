import type { ParseToJsonSchemaOptions, TsParsingOptions } from "dilswer";
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
  path: "../progress/reporter",
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
      Type.RecordOf({})
    )
  ),
  errorReporterParser: OptionalField(
    Type.Function.setExtra({
      typeName: "ErrorReporterParser",
      path: "./error-reporter-parser-type",
    })
  ),
  reporters: OptionalField(Type.ArrayOf(Type.Literal("default"), ReporterType)),
});

ConfigSchema.setTitle("Config");

export const generateConfigSchema = (
  options?: ParseToJsonSchemaOptions | undefined
) => {
  return toJsonSchema(ConfigSchema, options);
};

export const generateConfigType = (options?: Partial<TsParsingOptions>) => {
  return toTsType(ConfigSchema, options);
};

// Config options description

ConfigSchema.recordOf.defaultTimeoutThreshold.type.setDescription(
  "Default timeout threshold for tests in milliseconds. If any test takes longer than this threshold, it will fail. Default value is 5000ms."
);

ConfigSchema.recordOf.parallel.type.setDescription(
  "Number of tests to run in parallel. Default value is 2."
);

ConfigSchema.recordOf.srcDir.type.setDescription(
  "Directory where your source files are located. (module mocks should be defined as filepaths relative to this dir) Default is the current directory."
);

ConfigSchema.recordOf.testDir.type.setDescription(
  "Directory where your test files are located. Default is a `__tests__` within the current directory."
);

ConfigSchema.recordOf.setup.type.setDescription(
  "Filepath to a setup file. This file will be executed before running any tests."
);

ConfigSchema.recordOf.globals.type.setDescription(
  "Global variables that will be available to all tests."
);

ConfigSchema.recordOf.errorReporterParser.type.setDescription(
  "A function that allows to modify and customize the error messages that are printed in the console output when running tests.\n\nEach Error intercepted during a test run will be passed to this function along with the message that would be printed by default. The returned string will be printed as the error message instead."
);

ConfigSchema.recordOf.reporters.type.setDescription(
  "An array of reporters to use. Default is `['default']`."
);
