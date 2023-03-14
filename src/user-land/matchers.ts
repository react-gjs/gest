import { diff } from "./utils/json-diff";
import { _getLineFromError } from "./utils/parse-error";
import { stringifyJson } from "./utils/stringify-json";

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
   * If the tested fuinction is async, this matcher will return a
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
  toReject(expected: Promise<any>): Promise<void>;
}

export type MatcherResult =
  | {
      failed: false;
    }
  | {
      failed: true;
      reason: string;
      expected: string;
      received: string;
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

export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (a === null || b === null) {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.valueOf() === b.valueOf();
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }

    for (const v of a) {
      if (!b.has(v)) {
        return false;
      }
    }

    for (const v of b) {
      if (!a.has(v)) {
        return false;
      }
    }

    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }

    for (const [k, v] of a) {
      if (!b.has(k)) {
        return false;
      }

      if (!deepEqual(v, b.get(k))) {
        return false;
      }
    }

    return true;
  }

  if (!a || !b || (typeof a !== "object" && typeof b !== "object")) {
    return a === b;
  }

  if (a.prototype !== b.prototype) {
    return false;
  }

  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }

  return keys.every((k) => deepEqual(a[k], b[k]));
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
}

const setHasMatch = (set: Set<any>, value: any) => {
  if (CustomMatcher.isCustomMatch(value)) {
    for (const v of set) {
      if (value.check(v)) {
        return true;
      }
    }
    return false;
  } else {
    if (set.has(value)) {
      return true;
    }

    for (const v of set) {
      if (CustomMatcher.isCustomMatch(v) && v.check(value)) {
        return true;
      }
    }

    return false;
  }
};

export function matchValues(a: any, b: any): boolean {
  if (CustomMatcher.isCustomMatch(b)) {
    return b.check(a);
  }

  if (a === b) {
    return true;
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (a === null || b === null) {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }

    for (const v of a) {
      if (!setHasMatch(b, v)) {
        return false;
      }
    }

    for (const v of b) {
      if (!setHasMatch(a, v)) {
        return false;
      }
    }

    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }

    for (const [k, v] of a) {
      if (!b.has(k)) {
        return false;
      }

      if (!matchValues(v, b.get(k))) {
        return false;
      }
    }

    return true;
  }

  if (!a || !b || (typeof a !== "object" && typeof b !== "object")) {
    return a === b;
  }

  const keys = Object.keys(b);
  if (keys.length > Object.keys(a).length) {
    return false;
  }

  // @ts-ignore
  return keys.every((k) => deepEqual(a[k], b[k], matchValues));
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
      return v.name ? `[Function: ${v.name}]` : "[Function]";
    case "object":
      if (v === null) {
        return "null";
      }
      if (Array.isArray(v)) {
        return "Array<...>";
      }
      if (Object.getPrototypeOf(v) !== Object.prototype) {
        return `[Object: ${v.constructor.name}]`;
      }
      return "Object";
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
  if (testedValue !== "object" || testedValue === null) {
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
  if (!deepEqual(testedValue, expectedValue)) {
    return {
      failed: true,
      reason: "Deep equality test has failed.",
      received: getPresentationForValue(testedValue),
      expected: getPresentationForValue(expectedValue),
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
  if (!matchValues(testedValue, expectedValue)) {
    const d = diff(testedValue, expectedValue, "match");
    return {
      failed: true,
      reason: "Expected value to match.",
      received: getPresentationForValue(testedValue),
      expected: getPresentationForValue(expectedValue),
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
        expected: getPresentationForValue(requiredValue),
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
    const match = testedValues.find((v) => deepEqual(v, requiredValue));

    if (!match) {
      return {
        failed: true,
        reason: "Expected array to contain a certain value.",
        received: getPresentationForArray(testedValues),
        expected: getPresentationForValue(requiredValue),
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
    const match = testedValues.find((v) => deepEqual(v, requiredValue));

    if (!match) {
      return {
        failed: true,
        reason: "Expected array to contain a certain value.",
        received: getPresentationForArray(testedValues),
        expected: getPresentationForValue(requiredValue),
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
        expected: getPresentationForValue(requiredValue),
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
        expected: getPresentationForArray(requiredValues),
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
      if (!testedValues.some((v) => deepEqual(v, requiredValue))) {
        return {
          failed: true,
          reason: "Expected array to contain certain value.",
          received: getPresentationForArray(testedValues),
          expected: getPresentationForValue(requiredValue),
          diff: testedValues
            .map(
              (v, i) => `${i}: ${diff(v, requiredValue, "equal").stringify()}`
            )
            .join("\n"),
        };
      }
    }

    for (const value of testedValues) {
      if (!requiredValues.some((v) => deepEqual(value, v))) {
        return {
          failed: true,
          reason: "Expected array to contain only certain values.",
          received: getPresentationForValue(value),
          expected: getPresentationForArray(requiredValues),
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
      if (!testedValues.some((v) => matchValues(v, requiredValue))) {
        return {
          failed: true,
          reason: "Expected array to contain certain value.",
          received: getPresentationForArray(testedValues),
          expected: getPresentationForValue(requiredValue),
          diff: testedValues
            .map(
              (v, i) => `${i}: ${diff(v, requiredValue, "match").stringify()}`
            )
            .join("\n"),
        };
      }
    }

    for (const value of testedValues) {
      if (!requiredValues.some((v) => matchValues(value, v))) {
        return {
          failed: true,
          reason: "Expected array to contain only certain values.",
          received: getPresentationForValue(value),
          expected: getPresentationForArray(requiredValues),
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
  if (fn !== "object" || fn === null || !(fn instanceof Promise)) {
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
          [`+${key}`]: this.stringify(),
          [`-${key}`]: v,
        };
      }

      stringify(): string {
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
          [`+${key}`]: this.stringify(),
          [`-${key}`]: v,
        };
      }

      stringify(): string {
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
          [`+${key}`]: this.stringify(),
          [`-${key}`]: v,
        };
      }

      stringify(): string {
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
          [`+${key}`]: this.stringify(),
          [`-${key}`]: v,
        };
      }

      stringify(): string {
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
          [`+${key}`]: this.stringify(),
          [`-${key}`]: v,
        };
      }

      stringify(): string {
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
    class ExactlyMatcher extends CustomMatcher {
      check(value: any) {
        return value === expectedValue;
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: expectedValue }, "match").diffStruct;
      }
    }

    return new ExactlyMatcher();
  },
  /**
   * Matches any value that is equal to the specified value,
   * using deep comparison. (equivalent to `toEqual()`)
   */
  equal(expectedValue: any): CustomMatcher {
    class EqualToMatcher extends CustomMatcher {
      check(value: any) {
        return deepEqual(value, expectedValue);
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: expectedValue }, "equal").diffStruct;
      }
    }

    return new EqualToMatcher();
  },
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
    }

    return new ArrayContainingMatcher();
  },
  arrayContainingEqual(requiredValues: any[]): CustomMatcher {
    class ArrayContainingEqualMatcher extends CustomMatcher {
      check(value: any) {
        if (!Array.isArray(value)) return false;
        if (value.length < requiredValues.length) return false;
        return requiredValues.every((v) => value.some((i) => deepEqual(i, v)));
      }

      diffAgainst(key: string, v: any): Record<string, any> {
        return diff({ [key]: v }, { [key]: requiredValues }, "equal")
          .diffStruct;
      }
    }

    return new ArrayContainingEqualMatcher();
  },
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
    }

    return new ArrayContainingOnlyMatcher();
  },
  arrayContainingOnlyEqual(requiredValues: any[]): CustomMatcher {
    class ArrayContainingOnlyEqualMatcher extends CustomMatcher {
      check(value: any) {
        if (!Array.isArray(value)) return false;
        if (value.length < requiredValues.length) return false;
        return (
          requiredValues.every((v) => value.some((i) => deepEqual(i, v))) &&
          value.every((v) => requiredValues.some((i) => deepEqual(v, i)))
        );
      }

      diffAgainst(key: string, values: any): Record<string, any> {
        if (this.check(values)) return {};

        return {
          [`+${key}`]: "...",
          [`-${key}`]: values,
        };
      }
    }

    return new ArrayContainingOnlyEqualMatcher();
  },
};
