import type { Describe } from "../../../user-land/test-collector";
import type { ConsoleInterceptor } from "../../utils/console-interceptor/console-interceptor";
import { currentMicrosecond } from "../../utils/current-microsecond";
import { GestError } from "../../utils/errors/gest-error";
import { initFakeTimers } from "../../utils/timers";
import type { TestFilepaths } from "../main-runner";
import { SuiteRunner } from "../suite-runner";
import type { TestRunnerOptions } from "../types";
import { printError } from "./print-error";
import { ProgressTrackerProxy } from "./tracker-proxy";

const consoleFnNames = [
  "assert",
  "clear",
  "count",
  "countReset",
  "debug",
  "dir",
  "dirxml",
  "error",
  "group",
  "groupCollapsed",
  "groupEnd",
  "info",
  "log",
  "print",
  "profile",
  "profileEnd",
  "table",
  "time",
  "timeEnd",
  "timeLog",
  "timeStamp",
  "trace",
  "warn",
] as const;

const consoleProxy = new Proxy(
  {},
  {
    get: (target, prop: any) => {
      if (consoleFnNames.includes(prop))
        return (...args: any[]) => {
          Subprocess!.invoke
            .sendLog(prop as keyof ConsoleInterceptor, args)
            .catch(printError);
        };
    },
  },
) as ConsoleInterceptor;

Object.defineProperty(globalThis, "__gest_console", {
  value: consoleProxy,
});

initFakeTimers(consoleProxy);

function isDescribe(t: any): t is Describe {
  return t && typeof t === "object" && t.name && t.line !== undefined;
}

export const runSuite = (
  filepaths: TestFilepaths,
  options: TestRunnerOptions,
  defaultTimeoutThreshold: number,
) => {
  (async () => {
    const module = await import(filepaths.bundleFile);

    const test = module.default;

    const timeout =
      module.timeout && typeof module.timeout === "number"
        ? (module.timeout as number)
        : defaultTimeoutThreshold;

    const id = Symbol();
    const tracker = new ProgressTrackerProxy();

    if (isDescribe(test)) {
      const suiteRunner = new SuiteRunner(
        { ...options, timeout },
        tracker,
        id,
      );

      const start = currentMicrosecond();
      const passed = await suiteRunner.runSuite(test);
      const end = currentMicrosecond();

      if (!passed) Subprocess?.invoke.testsFailed().catch(printError);

      tracker.finish(end - start);
    } else {
      const err = new GestError(
        `Not a test: ${filepaths.srcFile}\nMake sure the to add a default export to your test file.`,
      );

      tracker.suiteProgress({
        suite: id,
        error: {
          origin: "gest",
          thrown: err,
        },
      });
      tracker.finish();

      throw err;
    }

    Subprocess?.invoke.testFinished().catch(printError);
  })().catch((e) => {
    Subprocess?.invoke
      .testFinished(e ?? new Error("Test Failed"))
      .catch(printError);
  });
};
