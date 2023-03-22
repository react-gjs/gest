import GLib from "gi://GLib?version=2.0";
import { OutputBuffer } from "termx-markup";
import type { It, Test, TestHook } from "../user-land/test-collector";
import { _buildFile } from "./builder/build-file";
import { Global } from "./globals";
import type { ProgressTracker } from "./progress/progress";
import { _async } from "./utils/async";
import type { ConfigFacade } from "./utils/config";
import { _isExpectError } from "./utils/error-handling";
import { GestError } from "./utils/gest-error";
import { NoLogError } from "./utils/no-log-err";
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

function _isTest(t: any): t is Test {
  return t && typeof t === "object" && t.name && t.line !== undefined;
}

class SuiteRunner {
  constructor(
    private readonly options: TestRunnerOptions,
    private readonly tracker: ProgressTracker,
    private readonly suiteID: symbol
  ) {}

  private async measureRun(action: () => void): Promise<number> {
    const start = GLib.DateTime.new_now_local()!.get_microsecond();
    await action();
    const end = GLib.DateTime.new_now_local()!.get_microsecond();

    return end - start;
  }

  private testNameMatches(unitName: string[]) {
    const testableName = unitName.join(" > ");
    const { testNamePattern } = this.options;
    if (!testNamePattern) return true;
    return testableName.match(testNamePattern) !== null;
  }

  private markAsSkipped(units: It[], parentName: string[]) {
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

  private async runUnit(unit: It, parentName: string[]) {
    const unitName = [...parentName, unit.name];

    try {
      if (!this.testNameMatches(unitName)) {
        this.tracker.unitProgress({
          suite: this.suiteID,
          skipped: true,
          unitName,
          unit,
        });

        return true;
      }

      const duration = await this.measureRun(() => unit.callback());

      this.tracker.unitProgress({
        suite: this.suiteID,
        unitName,
        duration,
        unit,
      });

      return true;
    } catch (e) {
      this.tracker.unitProgress({
        suite: this.suiteID,
        unitName,
        error: {
          origin: "test",
          thrown: e,
        },
        unit,
      });

      if (_isExpectError(e)) {
        e.handle();
      }

      return false;
    }
  }

  async runSuite(test: Test, parentName: string[] = []): Promise<boolean> {
    let passed = true;

    const unitName = [...parentName, test.name];
    try {
      for (const hook of test.beforeAll) {
        try {
          await this.runHook(hook, unitName);
        } catch (e) {
          // All tests that cannot be ran because of a beforeAll hook
          // error should be marked as skipped
          this.markAsSkipped(test.its, unitName);
          throw e;
        }
      }

      $: for (const [index, unitTest] of test.its.entries()) {
        for (const hook of test.beforeEach) {
          try {
            await this.runHook(hook, unitName);
          } catch (e) {
            // All tests that cannot be ran because of a beforeAll hook
            // error should be marked as skipped
            this.markAsSkipped(test.its.slice(index, index + 1), unitName);
            continue $;
          }
        }

        const result = await this.runUnit(unitTest, unitName);

        passed &&= result;

        for (const hook of test.afterEach) {
          await this.runHook(hook, unitName);
        }
      }

      for (const subTest of test.subTests) {
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

            if (_isTest(test)) {
              const suiteRunner = new SuiteRunner(
                this.options,
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
