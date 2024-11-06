import type { OutputBuffer } from "termx-markup";

export type TestSuite = {
  dirname: string;
  basename: string;
  filename: string;
  testFile: string;
  setupFile?: string;
};

export type TestUnitInfo = {
  sourceFile: string;
  bundleFile: string;
  mapFile: string;
};

export type RunnerTestOutputs = {
  err: OutputBuffer;
  info: OutputBuffer;
};

export type TestRunnerOptions = {
  verbose?: boolean;
  testNamePattern?: string;
  testFilePattern?: string;
};

export type SuiteRunnerOptions = TestRunnerOptions & {
  timeout: number;
};
