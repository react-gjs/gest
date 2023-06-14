import type { TestHook } from "../../../user-land/test-collector";

export type ProgressErrorReport = {
  thrown: unknown;
  origin: "lifecycleHook" | "test" | "gest";
  hook?: Omit<TestHook, "callback">;
};

export type ProgressErrorReportParsed = {
  thrown: unknown;
  origin: "lifecycleHook" | "test" | "gest";
  message: string;
  errorType?: string;
  stack?: string;
  link?: string;
};
