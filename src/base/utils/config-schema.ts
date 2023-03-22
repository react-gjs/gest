import type { GetDataType, ParseToJsonSchemaOptions } from "dilswer";
import { OptionalField, Type, toJsonSchema } from "dilswer";

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
});

export const generateConfigSchema = (
  options?: ParseToJsonSchemaOptions | undefined
) => {
  return toJsonSchema(ConfigSchema, options);
};

export type Config = GetDataType<typeof ConfigSchema>;

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
