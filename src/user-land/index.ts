import type { FakeTimers as FT } from "../base/builder/injects";
import type { CalledFrom, Matcher, MatcherResultHandlers } from "./matchers";
import { Matchers } from "./matchers";
import type { Describe } from "./test-collector";
import { TestCollector } from "./test-collector";
import { FunctionMockRegistry, createMock } from "./utils/function-mocks";
import { _getLineFromError } from "./utils/parse-error";

export const describe = (name: string, fn: () => void): Describe => {
  // Get line where this function was called
  const [line, column] = _getLineFromError(new Error());

  return TestCollector.collectDescribes(name, line, column, fn);
};

export const it = (name: string, fn: () => any) => {
  // Get line where this function was called
  const [line, column] = _getLineFromError(new Error());

  TestCollector.addIt({
    name,
    line,
    column,
    callback: fn,
  });
};

export const test = it;

export const skip = (name: string, fn: () => any) => {
  TestCollector.addIt({
    name,
    line: 0,
    column: 0,
    skip: true,
    callback: () => {},
  });
};

export const beforeAll = (fn: () => void) => {
  // Get line where this function was called
  const [line, column] = _getLineFromError(new Error());

  TestCollector.addBeforeAll({
    callback: fn,
    line,
    column,
  });
};

export const afterAll = (fn: () => void) => {
  // Get line where this function was called
  const [line, column] = _getLineFromError(new Error());

  TestCollector.addAfterAll({
    callback: fn,
    line,
    column,
  });
};

export const beforeEach = (fn: () => void) => {
  // Get line where this function was called
  const [line, column] = _getLineFromError(new Error());

  TestCollector.addBeforeEach({
    callback: fn,
    line,
    column,
  });
};

export const afterEach = (fn: () => void) => {
  // Get line where this function was called
  const [line, column] = _getLineFromError(new Error());

  TestCollector.addAfterEach({
    callback: fn,
    line,
    column,
  });
};

export class ExpectError extends Error {
  private timeoutId?: NodeJS.Timeout;
  line: number;
  column: number;

  constructor(
    message: string,
    public readonly expected: string | undefined,
    public readonly received: string | undefined,
    public readonly diff: string | undefined,
    calledFrom: CalledFrom
  ) {
    super(message);
    this.name = "ExpectError";
    this.line = calledFrom.line;
    this.column = calledFrom.column;
    this.detectUnhandled();
  }

  private detectUnhandled() {
    this.timeoutId = FakeTimers.originalSetTimeout(() => {
      // TODO: communicate with the monitor
      console.error(
        `An expect error was not handled. This is most likely due to an async matcher not being awaited.\n\nError: ${this.message}`
      );
    }, 100);
  }

  handle() {
    clearTimeout(this.timeoutId);
  }
}

export const expect = (value: any) => {
  const handlers: MatcherResultHandlers = {
    sync(result, negate, calledFrom) {
      if (result.failed && !negate) {
        throw new ExpectError(
          result.reason,
          result.expected,
          result.received,
          result.diff,
          calledFrom
        );
      } else if (!result.failed && negate) {
        throw new ExpectError(
          "Matcher was expected to fail, but it passed.",
          undefined,
          undefined,
          undefined,
          calledFrom
        );
      }
    },
    async async(result, negate, calledFrom) {
      const awaitedResult = await result;
      return this.sync(awaitedResult, negate, calledFrom);
    },
  };

  return Matchers.proxy(value, handlers);
};

export const defineMatcher = (matcherName: string, matcher: Matcher) => {
  Matchers.add(matcherName, matcher);
};

// Fake Timers

declare global {
  const FakeTimers: typeof FT;
}

export const Mock = {
  /**
   * Creates a new mock function.
   *
   * @example
   *   const mock = Mock.create(() => null);
   *
   *   // Call the mock function
   *   mock.fn();
   *
   *   // Check call count
   *   mock.tracker.callCount; // 1
   *
   *   // Check call arguments
   *   mock.tracker.latestCall.args; // []
   *
   *   // Check call return value
   *   mock.tracker.latestCall.result; // null
   *
   *   // Check if the last call failed
   *   mock.tracker.latestCall.error; // undefined
   *
   *   // Check if the result was asynchronous
   *   mock.tracker.latestCall.isAsync; // false
   */
  create: createMock,
  ...FunctionMockRegistry.public(),
};

// Default matchers

export { CustomMatcher as CustomMatch, match } from "./matchers";
export type { ExpectMatchers } from "./matchers";
