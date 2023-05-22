import { FunctionMock } from "./utils/function-mocks";
import { diff } from "./utils/json-diff";
import { _getLineFromError } from "./utils/parse-error";
import {
  PresentableObjectIdentifier,
  stringifyJson,
} from "./utils/stringify-json";
import { deepEqual, matchValues } from "./utils/validators";

export interface ExpectMatchers {
  /**
   * Negates the matcher. The test will pass if expectation
   * fails.
   */
  not: Omit<ExpectMatchers, "not">;
  /**
   * Compares the tested value to the expected value using strict
   * shallow equality (equivalent to `Object.is`).
   */
  toBe(expected: any): void;
  /**
   * Check if the tested value is an instance of the specified
   * class.
   */
  toBeInstanceOf(expected: any): void;
  /**
   * Compares the tested value to the expected value using strict
   * deep equality.
   */
  toEqual(expected: any): void;
  /**
   * Check if the tested value is specifically `null` or
   * `undefined`.
   */
  toBeUndefined(): void;
  /**
   * Check if the tested value is defined. `null` and `undefined`
   * values will fail this expectation.
   */
  toBeDefined(): void;
  /** Check if the tested value is of the specified type. */
  toBeOfType(expected: string): void;
  /**
   * Check if the tested value matches with the specified value,
   * the specified values can be a custom match (for example
   * `match.anything()`).
   *
   * Matching also does not care about additional properties on
   * the tested objects.
   *
   * Matching is deep, so it will work even with nested objects.
   */
  toMatch(expected: any): void;
  /**
   * Check if the tested value is a string that matches the
   * specified regular expression.
   */
  toMatchRegex(expected: RegExp): void;
  /**
   * Check if the tested value is an array that contains the
   * specified values. Each value must be strictly equal to the
   * tested value.
   */
  toContain(...expected: any[]): void;
  /**
   * Check if the tested value is an array that contains the
   * specified values. Each value is deeply compared to the
   * tested value.
   */
  toContainEqual(...expected: any[]): void;
  /**
   * Check if the tested value is an array that contains the
   * specified values. Each value is matched with the tested
   * value.
   */
  toContainMatch(...expected: any[]): void;
  /**
   * Check if the tested value is an array contains the specified
   * values, and only those values. Each value must be strictly
   * equal to the tested value.
   */
  toContainOnly(...expected: any[]): void;
  /**
   * Check if the tested value is an array contains the specified
   * values, and only those values. Each value is deeply compared
   * to the tested value.
   */
  toContainOnlyEqual(...expected: any[]): void;
  /**
   * Check if the tested value is an array contains the specified
   * values, and only those values. Each value is matched with
   * the tested value.
   */
  toContainOnlyMatch(...expected: any[]): void;
  /**
   * Check if the tested value is a function that throws when
   * called.
   *
   * By default test will pass if the function throws anything,
   * if a parameter is specified, the test will pass only if the
   * thrown value is strictly equal to the specified value.
   *
   * If the tested function is async, this matcher will return a
   * promise that should be awaited.
   */
  toThrow(toBeThrown?: any): void | Promise<void>;
  /**
   * Check if the tested value is a promise that rejects with the
   * specified value.
   *
   * If no value is specified, the test will pass if the promise
   * rejects to any value, otherwise the test will pass only if
   * the rejected value is strictly equal to the specified
   * value.
   *
   * This matcher should always be awaited.
   */
  toReject(expected?: any): Promise<void>;
  /**
   * Check if the given Function Mock has been invoked, or if the
   * `times` parameter is specified, check if the function has
   * been invoked the specified number of times.
   */
  toHaveBeenCalled(time?: number): void;
  /**
   * Check if the given Function Mock has been invoked with
   * matching arguments. Arguments are compared using deep
   * equality similar to `toMatch`.
   */
  toHaveBeenCalledWith(...args: any[]): void;
  /**
   * Check if the last call to the given Function Mock has been
   * invoked with matching arguments. Arguments are compared
   * using deep equality similar to `toMatch`.
   */
  toHaveBeenCalledWithLast(...args: any[]): void;
  /**
   * Check if the given Function Mock has been invoked and has
   * returned the specified value.
   */
  toHaveReturnedWithLast(expected: any): void;
  /**
   * Check if the given Function Mock has been invoked and has
   * thrown the specified value.
   */
  toHaveThrownWithLast(expected: any): void;
  /**
   * Check if the given Function Mock has been invoked and has
   * returned a promise that resolves to the specified value.
   */
  toHaveResolvedWithLast(expected: any): void;
  /**
   * Check if the given Function Mock has been invoked and has
   * returned a promise that rejects to the specified value.
   */
  toHaveRejectedWithLast(expected: any): void;
}

export type MatcherResult =
  | {
      failed: false;
    }
  | {
      failed: true;
      reason: string;
      expected?: string;
      received?: string;
      diff?: string;
    };

export type Matcher = (
  testedValue: any,
  matcherArgs: any[]
) => MatcherResult | Promise<MatcherResult>;

export type CalledFrom = {
  line: number;
  column: number;
};

export type MatcherResultHandlers = {
  sync: (
    result: MatcherResult,
    negate: boolean,
    celledFrom: CalledFrom
  ) => void;
  async: (
    result: Promise<MatcherResult>,
    negate: boolean,
    celledFrom: CalledFrom
  ) => Promise<void>;
};

export class Matchers {
  private static matchers = new Map<string, Matcher>();

  static add(name: string, matcher: Matcher) {
    this.matchers.set(name, matcher);
  }

  static get(name: string): Matcher {
    const m = this.matchers.get(name);

    if (!m) {
      throw new Error(`Invalid matcher: '${name}'`);
    }

    return m;
  }

  static proxy(
    testedValue: any,
    handleMatcherResult: MatcherResultHandlers,
    negate = false
  ): ExpectMatchers {
    return new Proxy(
      {},
      {
        get(_, matcherName) {
          if (matcherName === "not") {
            return Matchers.proxy(testedValue, handleMatcherResult, true);
          }

          const matcher = Matchers.get(matcherName as string);

          return (...args: any[]) => {
            // Get line where this function was called
            const [line, column] = _getLineFromError(new Error());

            const calledFrom = {
              line,
              column,
            };

            const r = matcher(testedValue, args);
            if (r instanceof Promise) {
              return handleMatcherResult.async(r, negate, calledFrom);
            } else {
              return handleMatcherResult.sync(r, negate, calledFrom);
            }
          };
        },
        has(_, p) {
          return Matchers.matchers.has(p as string);
        },
        ownKeys() {
          return [...Matchers.matchers.keys()];
        },
      }
    ) as any;
  }
}

export abstract class CustomMatcher {
  static isCustomMatch(value: any): value is CustomMatcher {
    return (
      typeof value === "object" &&
      value !== null &&
      value instanceof CustomMatcher
    );
  }

  /** Check if the value matches this custom matcher. */
  abstract check(value: any): boolean;

  /**
   * Should return a patch diff of the given value against this
   * matcher. If the value matches this matcher, an empty object
   * should be returned.
   *
   * @example
   *   const diff = matcher.diffAgainst("foo", 123);
   *   // diff = {
   *   //   "+foo": "hello", <- this is the value that the matcher expects
   *   //   "-foo": 123, <- this is the value that was received
   *   // }
   */
  abstract diffAgainst(key: string, v: any): Record<string, any>;

  abstract toPresentation(): string;
}

function getPresentationForValue(v: unknown): string {
  switch (typeof v) {
    case "string":
      return `"${v}"`;
    case "number":
    case "boolean":
    case "bigint":
    case "undefined":
      return String(v);
    case "symbol":
      return v.toString();
    case "function":
      return v.name ? `[Function: ${v.name}]` : "Function";
    case "object": {
      if (v === null) {
        return "null";
      }
      if (CustomMatcher.isCustomMatch(v)) {
        return v.toPresentation();
      }
      if (Array.isArray(v)) {
        return "Array{...}";
      }
      if (v instanceof Map) {
        return "Map{...}";
      }
      if (v instanceof Set) {
        return "Set{...}";
      }
      if (v instanceof Date) {
        return `Date{${v.toISOString()}}`;
      }
      if (v instanceof RegExp) {
        return `RegExp{${v.toString()}}`;
      }
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype) {
        const name = proto.name ?? proto.constructor.name;

        if (name && name !== "Object") {
          return `[Object: ${name}]`;
        }
      }
      return "Object";
    }
  }
}

function getPresentationForArray(v: any[]): string {
  return `[${v.map((i) => getPresentationForValue(i)).join(", ")}]`;
}

Matchers.add("toBe", (testedValue, [expectedValue]) => {
  if (testedValue !== expectedValue) {
    return {
      failed: true,
      reason: "Equality test has failed.",
      received: getPresentationForValue(testedValue),
      expected: getPresentationForValue(expectedValue),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toBeInstanceOf", (testedValue, [expectedClassProto]) => {
  if (typeof testedValue !== "object" || testedValue === null) {
    return {
      failed: true,
      reason: "Expected value to be an object.",
      received: getPresentationForValue(testedValue),
      expected: `instanceof ${
        expectedClassProto.name ??
        expectedClassProto.constructor.name ??
        "UnknownClass"
      }`,
    };
  }

  if (!(testedValue instanceof expectedClassProto)) {
    return {
      failed: true,
      reason: "Expected value to be an instance of a class.",
      received: getPresentationForValue(testedValue),
      expected: `instanceof ${
        expectedClassProto.name ??
        expectedClassProto.constructor.name ??
        "UnknownClass"
      }`,
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toEqual", (testedValue, [expectedValue]) => {
  const result = deepEqual(testedValue, expectedValue);
  if (!result.isEqual) {
    return {
      failed: true,
      reason: "Deep equality test has failed.",
      received: getPresentationForValue(result.received),
      expected: getPresentationForValue(result.expected),
      diff: diff(testedValue, expectedValue, "equal").stringify(),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toBeUndefined", (testedValue) => {
  if (testedValue != null) {
    return {
      failed: true,
      reason: "Expected value to be undefined.",
      received: getPresentationForValue(testedValue),
      expected: getPresentationForValue(undefined),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toBeDefined", (testedValue) => {
  if (testedValue == null) {
    return {
      failed: true,
      reason: "Expected value to be defined.",
      received: getPresentationForValue(testedValue),
      expected: "Any",
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toBeOfType", (testedValue, [expectedType]) => {
  if (typeof testedValue !== expectedType) {
    return {
      failed: true,
      reason: "Expected value to be of different type.",
      received: getPresentationForValue(testedValue),
      expected: "typeof " + getPresentationForValue(expectedType),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toMatchRegex", (testedValue, [regex]) => {
  if (typeof testedValue !== "string") {
    return {
      failed: true,
      reason: "Expected value to be a string.",
      received: getPresentationForValue(testedValue),
      expected: "String",
    };
  }

  if (!regex.test(testedValue)) {
    return {
      failed: true,
      reason: "Expected value to match regex.",
      received: getPresentationForValue(testedValue),
      expected: regex.toString(),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toMatch", (testedValue, [expectedValue]) => {
  const result = matchValues(testedValue, expectedValue);
  if (!result.isEqual) {
    const d = diff(testedValue, expectedValue, "match");
    return {
      failed: true,
      reason: "Expected value to match.",
      received: getPresentationForValue(result.received),
      expected: getPresentationForValue(result.expected),
      diff: d.stringify(),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toContain", (testedValues, requiredValues) => {
  if (!Array.isArray(testedValues)) {
    return {
      failed: true,
      reason: "Expected value to be an array.",
      received: getPresentationForValue(testedValues),
      expected: "Array",
    };
  }

  for (const requiredValue of requiredValues) {
    if (!testedValues.includes(requiredValue)) {
      return {
        failed: true,
        reason: "Expected array to contain a certain value.",
        received: getPresentationForArray(testedValues),
        expected: "array containing: " + getPresentationForValue(requiredValue),
      };
    }
  }

  return {
    failed: false,
  };
});

Matchers.add("toContainEqual", (testedValues, requiredValues) => {
  if (!Array.isArray(testedValues)) {
    return {
      failed: true,
      reason: "Expected value to be an array.",
      received: getPresentationForValue(testedValues),
      expected: "Array",
    };
  }

  for (const requiredValue of requiredValues) {
    const match = testedValues.find((v) => deepEqual(v, requiredValue).isEqual);

    if (!match) {
      return {
        failed: true,
        reason: "Expected array to contain a certain value.",
        received: getPresentationForArray(testedValues),
        expected: "array containing: " + getPresentationForValue(requiredValue),
        diff: testedValues
          .map((v, i) => `${i}: ${diff(v, requiredValue, "equal").stringify()}`)
          .join("\n"),
      };
    }
  }

  return {
    failed: false,
  };
});

Matchers.add("toContainMatch", (testedValues, requiredValues) => {
  if (!Array.isArray(testedValues)) {
    return {
      failed: true,
      reason: "Expected value to be an array.",
      received: getPresentationForValue(testedValues),
      expected: "Array",
    };
  }

  for (const requiredValue of requiredValues) {
    const match = testedValues.find(
      (v) => matchValues(v, requiredValue).isEqual
    );

    if (!match) {
      return {
        failed: true,
        reason: "Expected array to contain a certain value.",
        received: getPresentationForArray(testedValues),
        expected: "array containing: " + getPresentationForValue(requiredValue),
        diff: testedValues
          .map((v, i) => `${i}: ${diff(v, requiredValue, "match").stringify()}`)
          .join("\n"),
      };
    }
  }

  return {
    failed: false,
  };
});

Matchers.add("toContainOnly", (testedValues, requiredValues) => {
  if (!Array.isArray(testedValues)) {
    return {
      failed: true,
      reason: "Expected value to be an array.",
      received: getPresentationForValue(testedValues),
      expected: "Array",
    };
  }

  for (const requiredValue of requiredValues) {
    if (!testedValues.includes(requiredValue)) {
      return {
        failed: true,
        reason: "Expected array to contain a certain value.",
        received: getPresentationForArray(testedValues),
        expected: "array containing: " + getPresentationForValue(requiredValue),
      };
    }
  }

  for (const value of testedValues) {
    const match = requiredValues.find((v) => v === value);
    if (!match) {
      return {
        failed: true,
        reason: "Expected array to not contain anything but a certain value.",
        received: getPresentationForValue(value),
        expected: "one of: " + getPresentationForArray(requiredValues),
      };
    }
  }

  return {
    failed: false,
  };
});

Matchers.add(
  "toContainOnlyEqual",
  (testedValues: any, requiredValues: any[]) => {
    if (!Array.isArray(testedValues)) {
      return {
        failed: true,
        reason: "Expected value to be an array.",
        received: getPresentationForValue(testedValues),
        expected: "Array",
      };
    }

    for (const requiredValue of requiredValues) {
      if (!testedValues.some((v) => deepEqual(v, requiredValue).isEqual)) {
        return {
          failed: true,
          reason: "Expected array to contain certain value.",
          received: getPresentationForArray(testedValues),
          expected:
            "array containing: " + getPresentationForValue(requiredValue),
          diff: testedValues
            .map(
              (v, i) => `${i}: ${diff(v, requiredValue, "equal").stringify()}`
            )
            .join("\n"),
        };
      }
    }

    for (const value of testedValues) {
      if (!requiredValues.some((v) => deepEqual(value, v).isEqual)) {
        return {
          failed: true,
          reason: "Expected array to contain only certain values.",
          received: getPresentationForValue(value),
          expected: "one of: " + getPresentationForArray(requiredValues),
          diff: requiredValues
            .map((req, i) => `${i}: ${diff(value, req, "equal").stringify()}`)
            .join("\n"),
        };
      }
    }

    return {
      failed: false,
    };
  }
);

Matchers.add(
  "toContainOnlyMatch",
  (testedValues: any, requiredValues: any[]) => {
    if (!Array.isArray(testedValues)) {
      return {
        failed: true,
        reason: "Expected value to be an array.",
        received: getPresentationForValue(testedValues),
        expected: "Array",
      };
    }

    for (const requiredValue of requiredValues) {
      if (!testedValues.some((v) => matchValues(v, requiredValue).isEqual)) {
        return {
          failed: true,
          reason: "Expected array to contain certain value.",
          received: getPresentationForArray(testedValues),
          expected:
            "array containing: " + getPresentationForValue(requiredValue),
          diff: testedValues
            .map(
              (v, i) => `${i}: ${diff(v, requiredValue, "match").stringify()}`
            )
            .join("\n"),
        };
      }
    }

    for (const value of testedValues) {
      if (!requiredValues.some((v) => matchValues(value, v).isEqual)) {
        return {
          failed: true,
          reason: "Expected array to contain only certain values.",
          received: getPresentationForValue(value),
          expected: "one of: " + getPresentationForArray(requiredValues),
          diff: requiredValues
            .map((req, i) => `${i}: ${diff(value, req, "match").stringify()}`)
            .join("\n"),
        };
      }
    }

    return {
      failed: false,
    };
  }
);

Matchers.add("toThrow", (fn, [toBeThrown]) => {
  if (typeof fn !== "function") {
    return {
      failed: true,
      reason: "Expected value to be a function.",
      received: getPresentationForValue(fn),
      expected: "Function",
    };
  }

  const onErr = (e: any) => {
    if (toBeThrown === undefined) {
      return {
        failed: false,
      };
    }
    if (e !== toBeThrown) {
      return {
        failed: true,
        reason: "Expected function to throw a specific value.",
        received: getPresentationForValue(e),
        expected: getPresentationForValue(toBeThrown),
      };
    }
  };

  try {
    const result = fn();
    if (result === "object" && fn === null && fn instanceof Promise) {
      return result.catch(onErr);
    }
  } catch (e) {
    return onErr(e);
  }

  return {
    failed: false,
  };
});

Matchers.add("toReject", async (fn, [toBeThrown]) => {
  if (typeof fn !== "object" || fn === null || !(fn instanceof Promise)) {
    return {
      failed: true,
      reason: "Expected value to be a promise.",
      received: getPresentationForValue(fn),
      expected: "Promise",
    };
  }

  try {
    await fn;
  } catch (e) {
    if (toBeThrown === undefined) {
      return {
        failed: false,
      };
    }
    if (e !== toBeThrown) {
      return {
        failed: true,
        reason: "Expected promise to reject a certain value.",
        received: getPresentationForValue(e),
        expected: getPresentationForValue(toBeThrown),
      };
    }
  }

  return {
    failed: false,
  };
});

// Mock Matchers

Matchers.add("toHaveBeenCalled", (mock, [times]) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (times != null && typeof times !== "number") {
    return {
      failed: true,
      reason: "toHaveBenCalled() argument must be a number.",
      received: getPresentationForValue(times),
      expected: "number",
    };
  }

  if (mock.tracker.callCount === 0) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  if (times != null && mock.tracker.callCount !== times) {
    return {
      failed: true,
      reason: "Expected mock to have been called a specific number of times.",
      received: getPresentationForValue(mock.tracker.callCount),
      expected: getPresentationForValue(times),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toHaveBeenCalledWith", (mock, args: any[]) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (mock.tracker.callCount === 0) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  const matchingCall = mock.tracker.calls.find((call) => {
    return (
      call.args.length === args.length && matchValues(call.args, args).isEqual
    );
  });

  if (!matchingCall) {
    return {
      failed: true,
      reason: "Expected mock to have been called with specific arguments.",
      expected: getPresentationForArray(args),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toHaveBeenCalledWithLast", (mock, args: any[]) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (!mock.tracker.latestCall) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  const match = matchValues(mock.tracker.latestCall.args, args);

  if (!match.isEqual) {
    return {
      failed: true,
      reason: "Expected mock to have been called with specific arguments.",
      expected: getPresentationForValue(match.expected),
      received: getPresentationForValue(match.received),
      diff: diff(mock.tracker.latestCall?.args, args, "match").stringify(),
    };
  }

  if (mock.tracker.latestCall.args.length !== args.length) {
    return {
      failed: true,
      reason: "Expected mock to have been called with specific arguments.",
      expected: getPresentationForArray(args),
      received: getPresentationForArray(mock.tracker.latestCall.args as any),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toHaveReturnedWithLast", (mock, args) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (!mock.tracker.latestCall) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  if (mock.tracker.latestCall.isAsync) {
    return {
      failed: true,
      reason:
        "Expected mock to have returned a value, but instead it returned a promise.",
    };
  }

  if (mock.tracker.latestCall.error) {
    return {
      failed: true,
      reason:
        "Expected mock to have returned a value, but instead it threw an error.",
      diff: String(mock.tracker.latestCall.error),
    };
  }

  if (args.length === 0) {
    return {
      failed: false,
    };
  }

  const match = matchValues(mock.tracker.latestCall.result, args[0]);

  if (!match.isEqual) {
    return {
      failed: true,
      reason: "Expected mock to have returned a specific value.",
      expected: getPresentationForValue(match.expected),
      received: getPresentationForValue(match.received),
      diff: diff(mock.tracker.latestCall.result, args[0], "match").stringify(),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toHaveThrownWithLast", (mock, args) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (!mock.tracker.latestCall) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  if (mock.tracker.latestCall.isAsync) {
    return {
      failed: true,
      reason:
        "Expected mock to have throw a exception, but instead it returned a promise.",
    };
  }

  if (!mock.tracker.latestCall.error) {
    return {
      failed: true,
      reason:
        "Expected mock to have throw a exception, but instead it returned.",
      diff: String(mock.tracker.latestCall.result),
    };
  }

  if (args.length === 0) {
    return {
      failed: false,
    };
  }

  const match = matchValues(mock.tracker.latestCall.error, args[0]);

  if (!match.isEqual) {
    return {
      failed: true,
      reason: "Expected mock to have throw a specific exception.",
      expected: getPresentationForValue(match.expected),
      received: getPresentationForValue(match.received),
      diff: diff(mock.tracker.latestCall.error, args[0], "match").stringify(),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toHaveResolvedWithLast", (mock, args) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (!mock.tracker.latestCall) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  if (!mock.tracker.latestCall.isAsync) {
    return {
      failed: true,
      reason:
        "Expected mock to have resolved a value, but it was not a promise.",
    };
  }

  if (mock.tracker.latestCall.error) {
    return {
      failed: true,
      reason:
        "Expected mock to have resolved a value, but instead it rejected.",
      diff: String(mock.tracker.latestCall.error),
    };
  }

  if (args.length === 0) {
    return {
      failed: false,
    };
  }

  const match = matchValues(mock.tracker.latestCall.result, args[0]);

  if (!match.isEqual) {
    return {
      failed: true,
      reason: "Expected mock to have resolved with a specific value.",
      expected: getPresentationForValue(match.expected),
      received: getPresentationForValue(match.received),
      diff: diff(mock.tracker.latestCall.result, args[0], "match").stringify(),
    };
  }

  return {
    failed: false,
  };
});

Matchers.add("toHaveRejectedWithLast", (mock, args) => {
  if (!(mock instanceof FunctionMock)) {
    return {
      failed: true,
      reason: "Expected value to be a mock.",
      received: getPresentationForValue(mock),
      expected: "FunctionMock",
    };
  }

  if (!mock.tracker.latestCall) {
    return {
      failed: true,
      reason: "Expected mock to have been called.",
    };
  }

  if (!mock.tracker.latestCall.isAsync) {
    return {
      failed: true,
      reason:
        "Expected mock to have rejected a value, but it was not a promise.",
    };
  }

  if (!mock.tracker.latestCall.error) {
    return {
      failed: true,
      reason:
        "Expected mock to have rejected an exception, but instead it resolved.",
    };
  }

  if (args.length === 0) {
    return {
      failed: false,
    };
  }

  const match = matchValues(mock.tracker.latestCall.error, args[0]);

  if (!match.isEqual) {
    return {
      failed: true,
      reason: "Expected mock to have rejected with a specific exception.",
      expected: getPresentationForValue(match.expected),
      received: getPresentationForValue(match.received),
      diff: diff(mock.tracker.latestCall.error, args[0], "match").stringify(),
    };
  }

  return {
    failed: false,
  };
});

/**
 * Creates a special object that will be treated differently when
 * parsing with `stringifyJson`.
 *
 * The value provided as the argument should end up being
 * inserted into the JSON string without quotes like a regular
 * value would.
 */
const withoutQuotes = (s: string) => ({
  [PresentableObjectIdentifier]: true,
  _toPresentation: () => s,
  value: s,
  notice:
    "This is a internal Gest object. If you are seeing it in a diff patch of a test error, please report a bug here: https://github.com/ncpa0cpl/gest/issues",
});

export const match = {
  /** Matches any non-nullish value. */
  anything(): CustomMatcher {
    class AnythingMatcher extends CustomMatcher {
      check(value: any) {
        return value != null;
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        if (this.check(v)) return {};
        return {
          [`+${key}`]: withoutQuotes(this.toPresentation()),
          [`-${key}`]: v,
        };
      }

      toPresentation(): string {
        return "any";
      }
    }

    return new AnythingMatcher();
  },
  /** Matches any value of the specified type. */
  type(expectedType: string): CustomMatcher {
    class TypeMatcher extends CustomMatcher {
      check(value: any) {
        return typeof value === expectedType;
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        if (this.check(v)) return {};
        return {
          [`+${key}`]: withoutQuotes(this.toPresentation()),
          [`-${key}`]: v,
        };
      }

      toPresentation(): string {
        return `typeof ${expectedType}`;
      }
    }

    return new TypeMatcher();
  },
  /** Matches any value that's an instance of the specified class. */
  instanceOf(expectedClass: any): CustomMatcher {
    class InstanceOfMatcher extends CustomMatcher {
      check(value: any) {
        return (
          typeof value === "object" &&
          value != null &&
          value instanceof expectedClass
        );
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        if (this.check(v)) return {};

        return {
          [`+${key}`]: withoutQuotes(this.toPresentation()),
          [`-${key}`]: v,
        };
      }

      toPresentation(): string {
        return `instanceof ${
          expectedClass?.name ??
          expectedClass?.constructor?.name ??
          "UnknownClass"
        }`;
      }
    }

    return new InstanceOfMatcher();
  },
  /** Matches any string that contains the specified substring. */
  stringContaining(expectedString: string): CustomMatcher {
    class StringContainingMatcher extends CustomMatcher {
      check(value: any) {
        return typeof value === "string" && value.includes(expectedString);
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        if (this.check(v)) return {};
        return {
          [`+${key}`]: withoutQuotes(this.toPresentation()),
          [`-${key}`]: v,
        };
      }

      toPresentation(): string {
        return stringifyJson(expectedString);
      }
    }

    return new StringContainingMatcher();
  },
  /**
   * Matches any string that matches specified regular
   * expression.
   */
  stringMatchingRegex(expectedRegex: RegExp): CustomMatcher {
    class StringMatchingRegexMatcher extends CustomMatcher {
      check(value: any) {
        return typeof value === "string" && expectedRegex.test(value);
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        if (this.check(v)) return {};
        return {
          [`+${key}`]: withoutQuotes(this.toPresentation()),
          [`-${key}`]: v,
        };
      }

      toPresentation(): string {
        return stringifyJson(expectedRegex);
      }
    }

    return new StringMatchingRegexMatcher();
  },
  /**
   * Matches any value that is strictly equal to the specified
   * value. (equivalent to `toBe()`)
   */
  is(expectedValue: any): CustomMatcher {
    class IsMatcher extends CustomMatcher {
      check(value: any) {
        return value === expectedValue;
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: expectedValue }, "equal").diffStruct;
      }

      toPresentation(): string {
        return getPresentationForValue(expectedValue);
      }
    }

    return new IsMatcher();
  },
  /**
   * Matches any value that is equal to the specified value,
   * using deep comparison. (equivalent to `toEqual()`)
   */
  equal(expectedValue: any): CustomMatcher {
    class EqualToMatcher extends CustomMatcher {
      check(value: any) {
        return deepEqual(value, expectedValue).isEqual;
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: expectedValue }, "equal").diffStruct;
      }

      toPresentation(): string {
        return getPresentationForValue(expectedValue);
      }
    }

    return new EqualToMatcher();
  },
  /**
   * Matches any array that contains the specified values.
   *
   * Equivalent to expect's `toContain()`
   */
  arrayContaining(requiredValues: any[]): CustomMatcher {
    class ArrayContainingMatcher extends CustomMatcher {
      check(value: any) {
        if (!Array.isArray(value)) return false;
        if (value.length < requiredValues.length) return false;
        return requiredValues.every((v) => value.includes(v));
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: requiredValues }, "equal")
          .diffStruct;
      }

      toPresentation(): string {
        return getPresentationForArray(requiredValues);
      }
    }

    return new ArrayContainingMatcher();
  },
  /**
   * Matches any array that contains the specified values, using
   * deep comparison.
   *
   * Equivalent to expect's `toContainEqual()`
   */
  arrayContainingEqual(requiredValues: any[]): CustomMatcher {
    class ArrayContainingEqualMatcher extends CustomMatcher {
      check(value: any) {
        if (!Array.isArray(value)) return false;
        if (value.length < requiredValues.length) return false;
        return requiredValues.every((v) =>
          value.some((i) => deepEqual(i, v).isEqual)
        );
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: requiredValues }, "equal")
          .diffStruct;
      }

      toPresentation(): string {
        return getPresentationForArray(requiredValues);
      }
    }

    return new ArrayContainingEqualMatcher();
  },
  /**
   * Matches any array that contains only the exact specified
   * values.
   *
   * Equivalent to expect's `toContainOnly()`
   */
  arrayContainingOnly(requiredValues: any[]): CustomMatcher {
    class ArrayContainingOnlyMatcher extends CustomMatcher {
      check(value: any) {
        if (!Array.isArray(value)) return false;
        if (value.length < requiredValues.length) return false;
        return (
          requiredValues.every((v) => value.includes(v)) &&
          value.every((v) => requiredValues.includes(v))
        );
      }

      diffAgainst(key: string, values: any): Record<string, any> {
        if (this.check(values)) return {};

        return {
          [`+${key}`]: "...",
          [`-${key}`]: values,
        };
      }

      toPresentation(): string {
        return getPresentationForArray(requiredValues);
      }
    }

    return new ArrayContainingOnlyMatcher();
  },
  /**
   * Matches any array that contains all the specified values,
   * using deep comparison, and only those.
   *
   * Equivalent to expect's `toContainOnlyEqual()`
   */
  arrayContainingOnlyEqual(requiredValues: any[]): CustomMatcher {
    class ArrayContainingOnlyEqualMatcher extends CustomMatcher {
      check(value: any) {
        if (!Array.isArray(value)) return false;
        if (value.length < requiredValues.length) return false;
        return (
          requiredValues.every((v) =>
            value.some((i) => deepEqual(i, v).isEqual)
          ) &&
          value.every((v) =>
            requiredValues.some((i) => deepEqual(v, i).isEqual)
          )
        );
      }

      diffAgainst(key: string, values: any): Record<string, any> {
        if (this.check(values)) return {};

        return {
          [`+${key}`]: "...",
          [`-${key}`]: values,
        };
      }

      toPresentation(): string {
        return getPresentationForArray(requiredValues);
      }
    }

    return new ArrayContainingOnlyEqualMatcher();
  },
  /**
   * Matches any value that positively validates with the given
   * function.
   */
  validates(validator: (value: any) => boolean): CustomMatcher {
    class ValidatesMatcher extends CustomMatcher {
      check(value: any) {
        return !!validator(value);
      }

      diffAgainst(key: string, value: any): Record<string, any> {
        if (this.check(value)) return {};

        return {
          [`+${key}`]: "",
          [`-${key}`]: value,
        };
      }

      toPresentation(): string {
        return "unknown";
      }
    }

    return new ValidatesMatcher();
  },
  /**
   * Matches any value that is matching all the given values or
   * Matchers.
   *
   * @example
   *   expect(new Error("Hello")).toMatch(
   *     match.allOf(
   *       {
   *         message: "Hello",
   *       },
   *       match.instanceOf(Error)
   *     )
   *   );
   */
  allOf(...matchers: any[]): CustomMatcher {
    class AllOfMatcher extends CustomMatcher {
      private checkWith(m: any, value: any) {
        if (CustomMatcher.isCustomMatch(m)) {
          return m.check(value);
        } else {
          return matchValues(value, m).isEqual;
        }
      }

      check(value: any) {
        for (const m of matchers) {
          const isMatching = this.checkWith(m, value);
          if (!isMatching) return false;
        }
        return true;
      }

      diffAgainst(key: string, value: any): Record<string, any> {
        // find matcher that does not match
        const mismatch = matchers.find((m) => !this.checkWith(m, value));

        if (mismatch) {
          if (CustomMatcher.isCustomMatch(mismatch)) {
            return mismatch.diffAgainst(key, value);
          } else {
            return diff({ [key]: value }, { [key]: mismatch }, "match")
              .diffStruct;
          }
        }

        return {};
      }

      toPresentation(): string {
        return matchers.map((m) => getPresentationForValue(m)).join(" &&\n");
      }
    }

    return new AllOfMatcher();
  },
  /**
   * Matches any value that is matching any of the given values
   * or Matchers.
   *
   * @example
   *   expect(123).toMatch(
   *     match.anyOf(
   *       match.type("number"),
   *       match.type("string")
   *     )
   *   );
   */
  anyOf(...matchers: any[]): CustomMatcher {
    class OneOfMatcher extends CustomMatcher {
      private checkWith(m: any, value: any) {
        if (CustomMatcher.isCustomMatch(m)) {
          return m.check(value);
        } else {
          return matchValues(value, m).isEqual;
        }
      }

      check(value: any) {
        for (const m of matchers) {
          const isMatching = this.checkWith(m, value);
          if (isMatching) return true;
        }
        return false;
      }

      diffAgainst(key: string, value: any): Record<string, any> {
        if (this.check(value)) return {};

        const diffResults: Record<string, any> = {};

        for (const [index, mismatch] of matchers.entries()) {
          if (mismatch) {
            if (CustomMatcher.isCustomMatch(mismatch)) {
              diffResults[index] = mismatch.diffAgainst(key, value);
            } else {
              diffResults[index] = diff(
                { [key]: value },
                { [key]: mismatch },
                "match"
              ).diffStruct;
            }
          }
        }

        return diffResults;
      }

      toPresentation(): string {
        return matchers.map((m) => getPresentationForValue(m)).join(" ||\n");
      }
    }

    return new OneOfMatcher();
  },
};
