import type { FakeTimers as FT } from "../base/builder/injects";
import type {
  Assert,
  AssertResultHandlers,
  CalledFrom,
  ExpectAsserts,
} from "./matchers";
import { Asserts } from "./matchers";
import type { Describe } from "./test-collector";
import { TestCollector } from "./test-collector";
import type { TestContext } from "./test-context";
import { testCallback } from "./test-context";
import { ExpectError } from "./utils/errors";
import {
  FunctionMockRegistry,
  createMock,
} from "./utils/function-mocks";
import { _getLineFromError } from "./utils/parse-error";

export const describe = (name: string, fn: () => void): Describe => {
  // Get line where this function was called
  const { column, line } = _getLineFromError(new Error());

  return TestCollector.collectDescribes(name, line, column, fn);
};

export const it = (
  name: string,
  fn: (context: TestContext) => any,
) => {
  // Get line where this function was called
  const { column, line } = _getLineFromError(new Error());

  TestCollector.addIt({
    name,
    line,
    column,
    callback: testCallback(name, fn),
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
  const { column, line } = _getLineFromError(new Error());

  TestCollector.addBeforeAll({
    callback: fn,
    line,
    column,
  });
};

export const afterAll = (fn: () => void) => {
  // Get line where this function was called
  const { column, line } = _getLineFromError(new Error());

  TestCollector.addAfterAll({
    callback: fn,
    line,
    column,
  });
};

export const beforeEach = (fn: () => void) => {
  // Get line where this function was called
  const { column, line } = _getLineFromError(new Error());

  TestCollector.addBeforeEach({
    callback: fn,
    line,
    column,
  });
};

export const afterEach = (fn: () => void) => {
  // Get line where this function was called
  const { column, line } = _getLineFromError(new Error());

  TestCollector.addAfterEach({
    callback: fn,
    line,
    column,
  });
};

const assertionHandlers: AssertResultHandlers = {
  sync(result, negate, calledFrom) {
    if (result.failed && !negate) {
      throw new ExpectError(
        result.reason,
        result.expected,
        result.received,
        result.diff,
        calledFrom,
      );
    } else if (!result.failed && negate) {
      throw new ExpectError(
        "Assertion was expected to fail, but it passed.",
        undefined,
        undefined,
        undefined,
        calledFrom,
      );
    }
  },
  async async(result, negate, calledFrom) {
    const awaitedResult = await result;
    return this.sync(awaitedResult, negate, calledFrom);
  },
};

export const expect = (value: any) => {
  return Asserts.proxy(value, assertionHandlers);
};

type ExpectFactory<
  A extends any[],
  K extends Exclude<keyof ExpectAsserts, "not"> = "toBe",
> = {
  assert(getArgs: A, ...expectedValue: any[]): AssertFn<A, K>;
  assertMany(
    ...scenarios: [A, Parameters<ExpectAsserts[K]>][]
  ): AssertAllFn<A, K>;
};

type AssertFn<
  A extends any[],
  K extends Exclude<keyof ExpectAsserts, "not">,
> = ReturnType<ExpectAsserts[K]> extends Promise<any>
  ? Promise<ExpectFactory<A, K>>
  : ExpectFactory<A, K>;

type AssertAllFn<
  A extends any[],
  K extends Exclude<keyof ExpectAsserts, "not">,
> = ReturnType<ExpectAsserts[K]> extends Promise<any>
  ? Promise<void>
  : void;

export const expectFactory = <
  A extends any[],
  K extends Exclude<keyof ExpectAsserts, "not"> = "toBe",
>(
  getTestedValue: (...args: A) => any,
  assertion: K = "toEqual" as any,
  negate = false,
): ExpectFactory<A, K> => {
  const calledFromSym = Symbol("calledFrom");

  return {
    assert(...args): any {
      const [getArgs, ...expectedValue] = args;
      const lastArg = args[args.length - 1];

      let calledFrom: CalledFrom | undefined;

      if (
        typeof lastArg === "object" &&
        null !== lastArg &&
        calledFromSym in lastArg
      ) {
        expectedValue.pop();
        calledFrom = lastArg as CalledFrom;
      } else {
        // Get line where this function was called
        calledFrom = _getLineFromError(new Error());
      }

      const testedValue = getTestedValue(...getArgs);
      const assert = Asserts.get(assertion);

      const r = assert(testedValue, expectedValue);

      if (r instanceof Promise) {
        return assertionHandlers
          .async(r, negate, calledFrom)
          .then(() => this);
      } else {
        assertionHandlers.sync(r, negate, calledFrom);
        return this;
      }
    },
    assertMany(...scenarios): any {
      // Get line where this function was called
      const { line, column } = _getLineFromError(new Error());

      const calledFrom = {
        [calledFromSym]: true,
        line,
        column,
      };

      const results = scenarios.map(([getArgs, expectedValue]) =>
        this.assert(getArgs, ...expectedValue, calledFrom),
      );

      const hasPromise = results.some((r) => r instanceof Promise);

      if (hasPromise) {
        return Promise.all(results).then(() => {});
      }
    },
  };
};

export const defineMatcher = (
  matcherName: string,
  matcher: Assert,
) => {
  Asserts.add(matcherName, matcher);
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
export type { ExpectAsserts as ExpectMatchers } from "./matchers";
