import type { InternalTestContext } from "./test-collector";
import { DeferedTaskError, GestTestError } from "./utils/errors";
import { _getLineFromError } from "./utils/parse-error";

export type TestContext = {
  /**
   * Title of the test unit, the same value as given to the `it`
   * function.
   */
  title: string;
  /**
   * The full title of the test unit, including the titles of the
   * parent describe blocks.
   */
  fullTitle: string;
  /**
   * Defer is where you can put the teardown logic for your test.
   * Every deferred function will run after the test has finished,
   * regardless of whether it has passed or failed.
   *
   * If a deferred function fails, the test will fail as well.
   */
  defer(task: () => any): void;
  /**
   * Logs an error to the console with a mapped stack trace. Logging
   * an error will cause the test to fail.
   */
  logError(err: any): void;
};

type DeferredTask = {
  action: () => any;
  line: number;
  column: number;
};

export const testCallback = (
  title: string,
  fn: (context: TestContext) => any,
) => {
  const deferredTasks: Array<DeferredTask> = [];

  const runDeferred = async (
    err: unknown,
    _context: InternalTestContext,
  ) => {
    const errors: {
      line: number;
      column: number;
      thrown: any;
    }[] = [];

    for (const task of deferredTasks) {
      try {
        await task.action();
      } catch (e) {
        errors.push({
          line: task.line,
          column: task.column,
          thrown: e,
        });
      }
    }

    if (err) {
      if (errors.length > 0) {
        _context.reportError(new DeferedTaskError(errors));
      }

      throw err;
    }

    if (errors.length > 0) {
      throw new DeferedTaskError(errors);
    }
  };

  return async (_context: InternalTestContext) => {
    const ctx: TestContext = {
      title,
      fullTitle: _context.fullTitle,
      defer(action) {
        const { column, line } = _getLineFromError(new Error());
        deferredTasks.push({
          action,
          column,
          line,
        });
      },
      logError(err) {
        const location = _getLineFromError(new Error());
        _context.reportError(GestTestError.from(err, location));
      },
    };

    let err: any = undefined;
    try {
      await fn(ctx);
    } catch (e) {
      err = e;
    }

    return await runDeferred(err, _context);
  };
};
