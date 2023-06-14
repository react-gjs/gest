import GLib from "gi://GLib?version=2.0";
import type { Test } from "../../user-land/test-collector";
import { _isExpectError } from "../utils/errors/error-handling";
import type { SuiteRunner } from "./suite-runner";

const currentMicrosecond = () => {
  const now = GLib.DateTime.new_now_local();
  return now.to_unix() * 1000000 + now.get_microsecond();
};

export class UnitRunner {
  readonly unitName: string[];
  readonly isSkipped: boolean = false;

  constructor(
    public readonly unit: Test,
    parentName: string[],
    public readonly suite: SuiteRunner,
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

  get fullTitle() {
    return this.unitName.join(" > ");
  }

  private testNameMatches(unitName: string[]) {
    const { testNamePattern } = this.suite.options;
    if (!testNamePattern) return true;
    const testableName = unitName.join(" > ");
    return testableName.match(testNamePattern) !== null;
  }

  private async runWithTimeout(
    action: () => void | Promise<void>,
    time: number,
  ) {
    const r = action();

    if (r && typeof r === "object" && r instanceof Promise) {
      return await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(
            new Error(
              `Unit tests has not finished within the given time (${time}ms)`,
            ),
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
    action: () => void | Promise<void>,
  ): Promise<number> {
    const start = currentMicrosecond();
    await action();
    const end = currentMicrosecond();

    const duration = end - start;
    return duration;
  }

  async run() {
    if (this.isSkipped) return false;

    const reportError = (e: any) => {
      this.suite.tracker.unitProgress({
        suite: this.suite.suiteID,
        unitName: this.unitName,
        error: {
          origin: "test",
          thrown: e,
        },
        unit: this.unit,
      });
    };

    try {
      const duration = await this.measureRun(() =>
        this.runWithTimeout(
          () =>
            this.unit.callback({
              fullTitle: this.fullTitle,
              reportError,
            }),
          this.suite.options.timeout,
        ),
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
