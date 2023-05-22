import GLib from "gi://GLib?version=2.0";
import { OutputBuffer } from "termx-markup";
import type { Describe, Test, TestHook } from "../user-land/test-collector";
import { _buildFile } from "./builder/build-file";
import { Global } from "./globals";
import type { ProgressTracker } from "./progress/progress";
import { _async } from "./utils/async";
import type { ConfigFacade } from "./utils/config";
import { _isExpectError } from "./utils/errors/error-handling";
import { GestError } from "./utils/errors/gest-error";
import { NoLogError } from "./utils/errors/no-log-err";
import path from "./utils/path";

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

type SuiteRunnerOptions = TestRunnerOptions & {
  timeout: number;
};

function _isTest(t: any): t is Describe {
  return t && typeof t === "object" && t.name && t.line !== undefined;
}

const currentMicrosecond = () => {
  const now = GLib.DateTime.new_now_local();
  return now.to_unix() * 1000000 + now.get_microsecond();
};

class UnitRunner {
  readonly unitName: string[];
  readonly isSkipped: boolean = false;

  constructor(
    public readonly unit: Test,
    parentName: string[],
    public readonly suite: SuiteRunner
  ) {
    this.unitName = [...parentName, unit.name];

    if (!this.testNameMatches(this.unitName) || unit.skip) {
      this.isSkipped = true;
      this.suite.tracker.unitProgress({
        suite: this.suite.suiteID,
        skipped: true,
        unitName: this.unitName,
        unit,
      });
    }
  }

  private testNameMatches(unitName: string[]) {
    const { testNamePattern } = this.suite.options;
    if (!testNamePattern) return true;
    const testableName = unitName.join(" > ");
    return testableName.match(testNamePattern) !== null;
  }

  private async runWithTimeout(
    action: () => void | Promise<void>,
    time: number
  ) {
    const r = action();

    if (r && typeof r === "object" && r instanceof Promise) {
      return await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(
            new Error(
              `Unit tests has not finished within the given time (${time}ms)`
            )
          );
        }, time);

        r.catch(() => {
          // prevent warning for unhandled promise rejection
        }).finally(() => {
          clearTimeout(t);
          resolve(r);
        });
      });
    }

    return r;
  }

  private async measureRun(
    action: () => void | Promise<void>
  ): Promise<number> {
    const start = currentMicrosecond();
    await action();
    const end = currentMicrosecond();

    const duration = end - start;
    return duration;
  }

  async run() {
    if (this.isSkipped) return false;

    try {
      const duration = await this.measureRun(() =>
        this.runWithTimeout(this.unit.callback, this.suite.options.timeout)
      );

      this.suite.tracker.unitProgress({
        suite: this.suite.suiteID,
        unitName: this.unitName,
        duration,
        unit: this.unit,
      });

      return true;
    } catch (e) {
      this.suite.tracker.unitProgress({
        suite: this.suite.suiteID,
        unitName: this.unitName,
        error: {
          origin: "test",
          thrown: e,
        },
        unit: this.unit,
      });

      if (_isExpectError(e)) {
        e.handle();
      }

      return false;
    }
  }
}

class SuiteRunner {
  constructor(
    public readonly options: SuiteRunnerOptions,
    public readonly tracker: ProgressTracker,
    public readonly suiteID: symbol
  ) {}

  private markAsSkipped(units: Test[], parentName: string[]) {
    for (const unit of units) {
      const unitName = [...parentName, unit.name];
      this.tracker.unitProgress({
        suite: this.suiteID,
        unitName,
        skipped: true,
        unit,
      });
    }
  }

  private async runHook(hook: TestHook, unitName: string[]) {
    try {
      await hook.callback();
    } catch (e) {
      this.tracker.suiteProgress({
        suite: this.suiteID,
        parentUnitName: unitName,
        error: {
          origin: "lifecycleHook",
          thrown: e,
          hook,
        },
      });

      throw new NoLogError(e, "Hook error");
    }
  }

  async runSuite(test: Describe, parentName: string[] = []): Promise<boolean> {
    let passed = true;

    const unitName = [...parentName, test.name];
    try {
      for (const hook of test.beforeAll) {
        try {
          await this.runHook(hook, unitName);
        } catch (e) {
          // All tests that cannot be ran because of a beforeAll hook
          // error should be marked as skipped
          this.markAsSkipped(test.tests, unitName);
          throw e;
        }
      }

      $: for (const unitTest of test.tests) {
        const unitRunner = new UnitRunner(unitTest, unitName, this);

        if (unitRunner.isSkipped) {
          continue;
        }

        for (const hook of test.beforeEach) {
          try {
            await this.runHook(hook, unitName);
          } catch (e) {
            // All tests that cannot be ran because of a beforeAll hook
            // error should be marked as skipped
            this.markAsSkipped([unitTest], unitName);
            continue $;
          }
        }

        const result = await unitRunner.run();

        passed &&= result;

        for (const hook of test.afterEach) {
          await this.runHook(hook, unitName);
        }
      }

      for (const subTest of test.children) {
        const result = await this.runSuite(
          {
            ...subTest,
            beforeEach: [...test.beforeEach, ...subTest.beforeEach],
            afterEach: [...test.afterEach, ...subTest.afterEach],
          },
          unitName
        );
        passed &&= result;
      }

      for (const hook of test.afterAll) {
        await this.runHook(hook, unitName);
      }
    } catch (e) {
      if (NoLogError.isError(e) && e instanceof NoLogError) {
        return false;
      }

      this.tracker.suiteProgress({
        suite: this.suiteID,
        parentUnitName: unitName,
        error: {
          origin: "test",
          thrown: e,
        },
      });

      return false;
    }

    return passed;
  }
}

export class TestRunner {
  success = true;
  mainOutput = new OutputBuffer();
  testErrorOutputs: OutputBuffer[] = [];

  tmpFiles: string[] = [];

  constructor(
    private testFileQueue: TestSuite[],
    private config: ConfigFacade,
    private tracker: ProgressTracker,
    private options: TestRunnerOptions = {}
  ) {}

  private testFileMatches(name: string) {
    const { testFilePattern } = this.options;
    if (!testFilePattern) return true;
    return name.match(testFilePattern) !== null;
  }

  async nextSuite() {
    if (this.testFileQueue.length === 0) return false;

    const testUnit = this.testFileQueue.pop()!;

    const outputFile =
      path.resolve(
        Global.getTmpDir(),
        path.relative(Global.getCwd(), testUnit.testFile)
      ) + ".bundled.js";
    const mapFile = outputFile + ".map";
    const isOutputAbsolute = outputFile.startsWith("/");
    const importPath =
      "file://" +
      (isOutputAbsolute
        ? outputFile
        : path.resolve(Global.getCwd(), outputFile));

    const suiteID = this.tracker.createSuiteTracker({
      filepath: testUnit.testFile,
      bundle: outputFile,
      map: mapFile,
    });

    try {
      if (!this.testFileMatches(testUnit.testFile)) {
        this.tracker.suiteProgress({
          suite: suiteID,
          skipped: true,
        });
        this.tracker.finish(suiteID);

        return true;
      }

      await _buildFile({
        input: testUnit.testFile,
        output: outputFile,
        fileSetup: testUnit.setupFile,
        mainSetup: this.config.setup,
        globals: this.config.globals,
        projectSrcDir: path.resolve(Global.getCwd(), this.config.srcDir),
      });

      this.tmpFiles.push(outputFile, mapFile);

      await _async((p) => {
        import(importPath)
          .then(async (module) => {
            const test = module.default;

            const timeout =
              module.timeout && typeof module.timeout === "number"
                ? (module.timeout as number)
                : this.config.defaultTimeoutThreshold;

            if (_isTest(test)) {
              const suiteRunner = new SuiteRunner(
                { ...this.options, timeout },
                this.tracker,
                suiteID
              );

              const passed = await suiteRunner.runSuite(test);

              if (!passed) this.success = false;

              this.tracker.finish(suiteID);

              p.resolve();
            } else {
              const err = new GestError(
                `Not a test: ${testUnit.testFile}\nMake sure the to add a default export to your test file.`
              );

              this.tracker.suiteProgress({
                suite: suiteID,
                error: {
                  origin: "gest",
                  thrown: err,
                },
              });
              this.tracker.finish(suiteID);

              p.reject(err);
            }
          })
          .catch(p.reject);
      });
    } catch (e) {
      this.success = false;

      if (!GestError.isGestError(e)) {
        this.tracker.suiteProgress({
          suite: suiteID,
          error: {
            origin: "test",
            thrown: e,
          },
        });
        this.tracker.finish(suiteID);
      }
    }

    return true;
  }

  async start() {
    while (await this.nextSuite()) {
      //
    }
  }
}
