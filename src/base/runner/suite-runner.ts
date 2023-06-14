import type { Describe, Test, TestHook } from "../../user-land/test-collector";
import type { ProgressTracker } from "../progress/progress";
import { NoLogError } from "../utils/errors/no-log-err";
import type { ProgressTrackerProxy } from "./subprocess/tracker-proxy";
import type { SuiteRunnerOptions } from "./types";
import { UnitRunner } from "./unit-runner";

export class SuiteRunner {
  constructor(
    public readonly options: SuiteRunnerOptions,
    public readonly tracker: ProgressTracker | ProgressTrackerProxy,
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
