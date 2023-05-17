# gest

A simple testing framework for [Gnome Javascript](https://gitlab.gnome.org/GNOME/gjs).

## Table of Contents

- [Usage](#usage)
- [Configuration](#configuration)
- [Expect's and Matchers](#expects-and-matchers)
- [Function Mocks](#function-mocks)
- [Fake Timers](#fake-timers)
- [Module Mocks](#module-mocks)


## Usage

Run tests:

```sh
$ yarn gest
```

Run tests and show information on passed, skipped and failed tests:

```sh
$ yarn gest --verbose
```

Run tests that match the given filename pattern:

```sh
$ yarn gest --testPathPattern <regex>
```

Run tests that match the given test name pattern:

```sh
$ yarn gest --testNamePattern <regex>
```

Run tests in a specific file:

```sh
$ yarn gest --file <path>
```

### Example test file

```ts
// example.test.ts
import { describe, it, expect } from 'gest';

export default describe('Example test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  it('should fail', () => {
    expect(true).toBe(false);
  });
});
```

## Configuration

Gest can be configured by creating a `gest.config.js` file in the root of your project. The configuration file should export a function that  returns a `Config` object.

```ts
// gest.config.js

/** @type {import("@reactgjs/gest/config").ConfigGetter} */
const getConfig () => {
  /** @type {import("@reactgjs/gest/config").Config} */
  const config = {
    testDir: "./__tests__",
    srcDir: "./src",
  };

  return config;
};

export default getConfig;
```

Alternatively the config file can be in a JSON format:
  
```json
{
  "testDir": "./__tests__",
  "srcDir": "./src"
}
```

### Config options

- `srcDir` - Directory where your source files are located. (module mocks should be defined as filepaths relative to this dir) Default is the current directory. Defaults to `./`.
- `testDir` - The directory where the test files are located. Defaults to `./__tests__`..
- `parallel` - Defines how many test Suites can be ran in parallel. Although currently all tests are always ran on a single thread, meaning this option will mostly only affect tests that are heavily asynchronous. Defaults to `2`.
- `setup` - Path to a setup file that can contain module mock's import maps (see [Module Mocks](#module-mocks) section).
- `defaultTimeoutThreshold` - Default timeout threshold for tests in milliseconds. If any test takes longer than this threshold, it will fail. Default value is 5000ms.
- `globals` - Global variables that will be available to all tests.
- `errorReporterParser` - A function that allows to modify and customize the error messages that are printed in the console output when running tests.

  Each Error intercepted during a test run will be passed to this function along with the message that would be printed by default. The returned string will be printed as the error message instead.
- `reporters` - An array of reporters to use. Default is `['default']`.

## Expect's and Matchers

Gest provides a set of expect functions and matchers to make assertions in your tests:

### Expect

- `expect(arg: any).toBe(arg: any)` - Compares the tested value to the expected value using strict shallow equality (equivalent to `Object.is()`).
- `expect(arg: any).toEqual(arg: any)` - Compares the tested value to the expected value using deep equality.
- `expect(arg: any).toMatch(arg: any)` - Check if the tested value matches with the specified value, the specified values can be a custom match (for example match.anything()). Matching also does not care about additional properties on the tested objects. Matching is deep, so it will work even with nested objects.
- `expect(arg: object).toBeInstanceOf(arg: new (...a: any[]) => any)` - Checks if the tested value is an instance of the specified class.
- `expect(arg: any).toBeUndefined()` - Checks if the tested value is `undefined`.
- `expect(arg: any).toBeDefined()` - Check if the tested value is defined. `null` and
`undefined` values will fail this assertion.
- `expect(arg: any).toBeOfType(arg: string)` - Checks if the tested value is of the specified type.
- `expect(arg: string).toMatchRegex(arg: RegExp)` - Checks if the tested value is a string that matches the specified regular expression.
- `expect(arg: any[]).toContain(...arg: any[])` - Checks if the tested value is an array that contains the specified value. Each value must be strictly equal to the tested value.
- `expect(arg: any[]).toContainEqual(...arg: any[])` - Checks if the tested value is an array that contains the specified value. Each value is compared using deep equality.
- `expect(arg: any[]).toContainMatch(...arg: any[])` - Checks if the tested value is an array that contains the specified value. Each value is compared using the same method as `expect().toMatch()`.
- `expect(arg: any[]).toContainOnly(...arg: any[])` - Checks if the tested value is an array that contains only the specified values. Each value must be strictly equal to the tested value.
- `expect(arg: any[]).toContainOnlyEqual(...arg: any[])` - Checks if the tested value is an array that contains only the specified values. Each value is compared using deep equality.
- `expect(arg: any[]).toContainOnlyMatch(...arg: any[])` - Checks if the tested value is an array that contains only the specified values. Each value is compared using the same method as `expect().toMatch()`.
- `expect(arg: (...a: any[]) => any).toThrow(arg: any)` - Checks if the tested value is a function that throws an error when called. If the `toThrow()` function is called with an argument, it will check if the thrown error matches that argument.
- `expect(arg: Promise<any>).toReject(arg: any)` - Checks if the tested value is a promise that rejects. If the `toReject()` function is called with an argument, it will check if the rejected error matches that argument.
- `expect(arg: FunctionMock).toHaveBeenCalled(arg?: number)` - Checks if the tested value is a mock function that has been called at least once. It can be given a number as an argument to check if the mock function has been called exactly that many times.
- `expect(arg: FunctionMock).toHaveBeenCalledWith(...arg: any[])` - Checks if the tested value is a mock function that has been called at least once with the specified arguments.
- `expect(arg: FunctionMock).toHaveBeenCalledWithLast(...arg: any[])` - Checks if the tested value is a mock function which the most recent call to it was with the specified arguments.
- `expect(arg: FunctionMock).toHaveReturnedWithLast(arg: any)` - Checks if the tested value is a mock function which the most recent call to it returned the specified value.
- `expect(arg: FunctionMock).toHaveThrownWithLast(arg: any)` - Checks if the tested value is a mock function which the most recent call to it threw the specified value.
- `expect(arg: FunctionMock).toHaveResolvedWithLast(arg: any)` - Checks if the tested value is a mock function which the most recent call to it returned a promise that resolved the specified value.
- `expect(arg: FunctionMock).toHaveRejectedWithLast(arg: any)` - Checks if the tested value is a mock function which the most recent call to it returned a promise that rejected with the specified value.
- `expect().not` - Negates the assertion that follows it.

#### Custom expect's assert functions

Custom expect's assert functions can be created by using the `defineMatcher()` function. Assertion function created this way will be then available via the `expect()` call. The validation function will be called with the tested value and the arguments it was called with and should return a `MatcherResult` object.

`MatcherResult` object defines whether the match was successful and the message that will be displayed if it wasn't, additionally it can include information about what value was expected, what value was received and a diff between the two.

```ts
import { defineMatcher } from '@reactgjs/gest';

// Extend the TypeScript type definitions
declare module "@reactgjs/gest" {
  interface ExpectMatchers {
    toBeInRange(range: [number, number]): void;
  }
}

defineMatcher("toBeInRange", (testedValue: any, range: [number, number]) => {
  if (typeof testedValue !== "number") {
    return {
      failed: true,
      reason: "Expected value to be a number.",
    };
  }

  if (testedValue < range[0] || testedValue > range[1]) {
    return {
      failed: true,
      reason: `Expected value to be in range [${range[0]}, ${range[1]}]`,
      expected: `to be in range [${range[0]}, ${range[1]}]`,
      received: String(testedValue),
    };
  }

  return {
    failed: false,
  };
})

// To use it:
expect(5).toBeInRange(0, 10); // Passes
expect(5).toBeInRange(10, 20); // Fails
```

### Matchers

Matchers are special objects that can be used alongside the `expect().toMatch()` assertion.

- `match.anything()` - Matches any value.
- `match.type(arg: string)` - Matches any value of the specified type.
- `match.instanceOf(arg: new (...a: any[]) => any)` - Matches any value that is an instance of the specified class.
- `match.stringContaining(arg: string)` - Matches any string that contains the specified string.
- `match.stringMatchingRegex(arg: RegExp)` - Matches any string that matches the specified regular expression.
- `match.is(arg: any)` - Matches any value that is strictly equal to the specified value.
- `match.equal(arg: any)` - Matches any value that is equal to the specified value, using deep equality.
- `match.arrayContaining(...arg: any[])` - Matches any array that contains the specified values. Each value must be strictly equal to the tested value.
- `match.arrayContainingEqual(...arg: any[])` - Matches any array that contains the specified values. Each value is compared using deep equality.
- `match.arrayContainingOnly(...arg: any[])` - Matches any array that contains only the specified values. Each value must be strictly equal to the tested value.
- `match.arrayContainingOnlyEqual(...arg: any[])` - Matches any array that contains only the specified values. Each value is compared using deep equality.
- `match.validates(arg: (value: any) => boolean)` - Matches any value that passes the specified validation function.
- `match.allOf(...arg: any[])` - Matches any value that matches all of the specified matchers.
- `match.anyOf(...arg: any[])` - Matches any value that matches any of the specified matchers.

#### Custom matchers

Custom matchers can be used alongside the `expect().toMatch()` assertion. They can be created by extending the `CustomMatch` class.

```ts
import { CustomMatch } from '@reactgjs/gest';

class ToBeInRangeMatcher extends CustomMatch {
  constructor(private range: [number, number]) {
    super();
  }

  // This function will be called to determine whether the match was successful.
  check(testedValue: any) {
    if (typeof testedValue !== "number") {
      return {
        failed: true,
        reason: "Expected value to be a number.",
      };
    }

    if (testedValue < this.range[0] || testedValue > this.range[1]) {
      return {
        failed: true,
        reason: `Expected value to be in range [${this.range[0]}, ${this.range[1]}]`,
        expected: `to be in range [${this.range[0]}, ${this.range[1]}]`,
        received: String(testedValue),
      };
    }

    return {
      failed: false,
    };
  }

  /**
   * Should return a patch diff of the given value against this matcher. If the 
   * value matches this matcher, an empty object should be returned.
   * 
   * This function will be called when the `expect().toMatch()` assertion fails, 
   * and this matcher is being used to match the value that failed the assertion,
   * and the result of it will be used to generate a patch diff that will be
   * displayed in the console.
   */
  diffAgainst(key: string, value: any): Record<string, any> {
    if (this.check(value)) return {};

    return {
      [`+${key}`]: `Number [${this.range[0]} - ${this.range[1]}]`,
      [`-${key}`]: value,
    };
  }

  /**
   * Should return a string representation of this matcher. This function will be
   * called when the `expect().toMatch()` assertion fails, and this matcher is
   * the reason for the assertion failure. The returned string will be displayed
   * in the console.
   */
  toPresentation(): string {
    return `Number [${this.range[0]} - ${this.range[1]}]`;
  }
}

// To use it:
expect({foo: 1}).toMatch({
  foo: new ToBeInRangeMatcher([0, 10]),
}); // Passes

expect({foo: 1}).toMatch({
  foo: new ToBeInRangeMatcher([10, 20]),
}); // Fails
```

## Function Mocks

Function mocks can be used to track calls to functions and to replace their implementation.

```ts
import { describe, it, expect, Mock } from 'gest';

// Create a simple mock of a function that does nothing
const mock1 = Mock.create();

// Create a mock of a function with a simple default implementation
const mock2 = Mock.create((v: number) => v + 5);

// Invoke the mock function:
mock2.fn(2); // Returns 7

// Check how many times the mock function was called:
mock2.tracker.callCount; // Returns 1

// Check the arguments that the mock function was called with:
mock2.tracker.calls[0].args; // Returns [2]

// Check the return values of the mock function:
mock2.tracker.calls[0].result; // Returns 7

// Check the thrown errors of the mock function:
mock2.tracker.calls[0].error; // Returns undefined

// Change the mock implementation:
mock2.setImplementation((v: number) => v + 10);

// Change the mock implementation to return a specific value:
mock2.setReturn(20);

// Clear the mock's call tracker:
mock2.clear();

// Completely reset the mock to the exact same state it was in after it was created:
mock2.reset();
```

Mocks provide many more functions that are not showcased above, such as: `waitForUnresolved()`, `restorePreviousImplementation()`, `setImplementationOnce()`, `setThrow()`, `setResolve()`, `setReject()`, `Mock.clearAllMocks()` and `Mock.resetAllMocks()`.

## Fake Timers

Gest provides a way to control the passage of time in your tests. It replaces the global `setTimeout` function with a version that synchronously steps through the `setTimeout` callbacks that have been scheduled to run instead of waiting for time to pass in the outside world.

Fake timers can be disabled and enabled via the `FakeTimers` global object. Enabling fake timers affects all code ran within the given test file.

```ts
import { describe, it, expect } from 'gest';

export default describe('Fake timers', () => {
  it('test', () => {
    FakeTimers.enable();

    // Run you test

    FakeTimers.runNext(); // Run the next scheduled timeout
    FakeTimers.runAll(); // Run all scheduled timeouts

    FakeTimers.disable();
  });
});
```

## Module mocks

Gest provides a way to mock whole modules. This is done by creating a setup file alongside the test file, it should export an object with a `mocks` property that contains a dictionary which works as a map of import paths.

### Example:

```ts
// ./__tests__/foo.test.ts
import { myFunction } from '../src/foo';

// ...
```

```ts
// ./__tests__/foo.setup.mjs
export default {
  mocks: {
    // All imports of '../src/foo' will be replaced with './__mocks__/foo.mock'
    './src/foo': "./__mocks__/foo.mock",
  },
};
```

Module mock can also be defined for all tests, this can be achieved by creating a setup file and pointing to it in the Gest configuration.