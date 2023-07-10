## 0.4.1 (July 10, 2023)

### Bug Fixes

- #### fix: polyfill the runAsync if it is not available on GMainLoop ([#99](https://github.com/react-gjs/gest/pull/99))

  The `GLib.MainLoop.runAsync` method is used by Gest to initiate a new event loop of the program, however in the older versions of `gjs` that method is not available. To ensure compatibility with these older versions, Gest will polyfill that method if it doesn't exist.

## 0.4.0 (July 4, 2023)

### Features

- #### feat: extended support for fake timers ([#95](https://github.com/react-gjs/gest/pull/95))

  FakeTimers although present in the previous version, were incomplete. Only the `setTimeout` was being mocked when using them, and it was impossible to clear fake timeouts, advancing the timers by an arbitrary amount was also not possible.
  
  All that has changed, `setInterval` is now also mocked when using FakeTimers, clearing the mocked timers should also work, and a new method has been added to the FakeTimers api: `advance()` which will run all pending timers that would have been scheduled within the timeframe of when they were initiated and N milliseconds after that, whereas N is provided to the advance function.

- #### feat: test context ([#93](https://github.com/react-gjs/gest/pull/93))

  Added a context object that is available to all unit tests, to access it simply add an argument to the function passed to the `it`. At this moment context will give access to the title of the test, and two helper methods: `defer()` - which can be used to add teardown logic to the test and `logError()` which will log errors similarly to how it's done with the errors thrown from the `it` blocks.
  
  ### Example
  
  ```ts
  export default describe("myTest", () => {
    it("this is how you use context", (ctx) => {
      ctx.title; // "this is how you use context"
      ctx.fullTitle; // "myTest > this is how you use context"
      ctx.defer(() => {/* cleanup */});
      ctx.logError(new Error("oh no!"));
    })
  })
  ``` 

- #### feat: added duration for suites logs ([#78](https://github.com/react-gjs/gest/pull/78))

  Each test Suite in the output logs will now display the total duration it took to run it. Additionally the time formatting was slightly changed.

- #### feat: use the MainLoop's `runAsync` instead of the Gtk's `main` ([#77](https://github.com/react-gjs/gest/pull/77))

### Bug Fixes

- #### fix: toEqual bug with arrays ([#96](https://github.com/react-gjs/gest/pull/96))

  Fixed a bug in the comparison algorithm used in the `expect.toEqual()` and `match.equal()` functions. The bug was causing the assertion to pass in situations where the expected array was shorter than the tested array. That was not intentional since the equalision comparison is supposed to assert objects to be strictly equal to each other.
  
  ### Example
  
  ```ts
  // old behavior
  expect([1, 2, 3]).toEqual([]); // passes
  
  // new, fixed behavior
  expect([1, 2, 3]).toEqual([]); // fails with: "ExpectError: Deep equality test has failed. Expected: undefined Received: 1"
  ```

- #### fix: added a catch to the mainloop start ([#79](https://github.com/react-gjs/gest/pull/79))

## 0.3.2 (May 22, 2023)

### Features

- #### feat: added toThrowMatch and toRejectMatch assert methods ([#54](https://github.com/react-gjs/gest/pull/54))

  Added two new assert methods on the `expect()`:
  - `toThrowMatch()` - similar to the existing `toThrow()` but uses the sane comparison algorithm as `toMatch()` 
  - `toRejectMatch()` - similar to the existing `toReject()` but uses the sane comparison algorithm as `toMatch()` 

### Bug Fixes

- #### fix: toThrow and toReject assert were sometimes incorrectly passing ([#53](https://github.com/react-gjs/gest/pull/53))

  `toThrow()` and `toReject()` asserts both were incorrectly handling promises and as a result, asserts that should have failed, were passing. Has been fixed now.

- #### fix: prevent async describes by throwing errors when detected ([#52](https://github.com/react-gjs/gest/pull/52))

  Before, passing asynchronous function into `describe()` would not raise any errors or warnings and the test would pass successfully even if some tests have been omitted because of a race condition. This has now been fixed, if the function given to `describe()` is detected to be asynchronous, error will be thrown and the whole Test Suite will not be run.

## 0.3.1 (May 22, 2023)

### Bug Fixes

- #### fix: missing `typeof` operator in matchers ([#50](https://github.com/react-gjs/gest/pull/50))

  `expect().toBeInstanceOf` and `expect().toReject` have been broken due to missing `typeof`` operator, matchers were comparing the tested value itself against the type name which was causing tests to fail in situations where the values were correct. 

## 0.3.0 (May 17, 2023)

### Features

- #### feat: added the total duration of all tests in the reported summary ([#35](https://github.com/react-gjs/gest/pull/35))

  Report summary is now able to display one more additional information - the time it took to complete all the tests.

- #### feat: function mocks ([#34](https://github.com/react-gjs/gest/pull/34))

  Added a Function Mock API, that allows to create special functions which are being tracked and can have their implementation changed at any time.
  
  Mocks track information's about:
  - the amount of times they were called
  - arguments provided to each call
  - result given for each call
  - whether a call ended in a failure or not
  - whether the returned value was a Promise or not
  - number of mock calls that are still pending (unresolved promises)

- #### feat: added FakeTimers feature ([#33](https://github.com/react-gjs/gest/pull/33))

  Added fake timers. To use fake timers use the global variable that globally available in all tests - `FakeTimers`.
  
  **Example**
  
  ```ts
  export default describe("FakeTimers test", () => {
    it("timers are disabled in this test", () => {
      FakeTimers.enable();
      
      let wasCalled = false;
  
      const onTimeout = () => {
        wasCalled = true;
      }
      setTimeout(onTimeout); // will never run until manually triggered
  
      wasCalled; // false
  
      FakeTimers.runNext(); // trigger, will invoke the `onTimeout` callback
  
      wasCalled; // true
  
      FakeTimers.disable(); // remember to disable fake timers once the test ends
    })
  })
  ```

- #### feat: reworked the stack parsing algorithm, added config option that allows for replacing this algorithm ([#32](https://github.com/react-gjs/gest/pull/32))

## 0.2.0 (May 3, 2023)

### Features

- #### feat: added option to skip a single unit test in code ([#29](https://github.com/react-gjs/gest/pull/29))

  new function available in tests: `skip()` which can be used instead of `it()`, tests declared with `skip()` will not be ran and will show as skipped in the report.
  
  Additionally `beforeEach` and `afterEach` hooks will now always be skipped along with the individual tests. Before those hooks could be ran before a test that was skipped.

- #### feat: added timeouts to test units ([#27](https://github.com/react-gjs/gest/pull/27))

  Added timeouts to all unit tests. Previously the config had a timeout threshold option, but it did not do anything. If a tests hanged and did never finish `gest` would also hang. A proper timeouts are now added, by default if a single test takes longer than 5 seconds it will be marked as failed. (this does not prevent synchronous thread locks, for example a synchronous infinite loop will still lock the program)

- #### feat: improved the mock path detection logic ([#25](https://github.com/react-gjs/gest/pull/25))

  Improved how mocks are matched against import paths, mocks should now work with paths that start with `./` or without it, the file extension can as well be defined or not. Package names will not be transformed to incorrect filepaths when resolving mocks.

- #### feat: added option that will silence all logs within the test files ([#23](https://github.com/react-gjs/gest/pull/23))

  A new cli argument has been added: `-s` or `--silenceLogs`. When passed to the gest all logs emitted from within tests will be silenced.

- #### feat: added test summary reporting ([#14](https://github.com/react-gjs/gest/pull/14))

  Added a test summary that will be printed at the very end of all test runs, it will present you with the information on how many Suite/Units have failed, passed or have been skipped.

### Bug Fixes

- #### fix: incorrect test duration measurement ([#28](https://github.com/react-gjs/gest/pull/28))

  Duration measurement were previously done incorrectly, if a test took more than a second or happened to start at the end of the current second (ex. 12:00:01.990), the measurement would be incorrect. This has been fixed now.

- #### fix: proper comparison of arrays ([#26](https://github.com/react-gjs/gest/pull/26))

  Comparison methods up till now did not handle arrays properly, each array was being treated as a regular object and each enumerable property on those was being compared.

- #### fix: errors and mistakes related to reporting ([#15](https://github.com/react-gjs/gest/pull/15))

  - added a proper error message for situations when the specified test directory does not exist
  - in-tests logs concatenation - previously each separate argument passed to a console log function would get joined with neighboring ones with an white-space character in between them, because of that if an argument started or ended with an end-of-line character, the formatting of those arguments could get broken, from now on, a white-space character is inserted between arguments only if there's not a EOL char in between already

## 0.1.1 (April 24, 2023)

### Bug Fixes

- #### fix: loading of config file in a json format ([#12](https://github.com/react-gjs/gest/pull/12))

  Previous release unintentionally broke loading `gest.config.json` files. This is fixed now.

## 0.1.0 (April 24, 2023)

### Features

- #### feat: added support for custom reporters ([#7](https://github.com/react-gjs/gest/pull/7))

  - config files can now be in a `.js` or `.mjs` format
  - error message parsing can be customized via a new config property `errorReporterParser`
  - gest console output can now be customized via a new config property `reporters`
  
  Custom reporter example:
  ```ts
  // gest.config.js
  
  export default async ({ importModule }) => {
    const { BaseReporter } = await importModule("@reactgjs/gest/base-reporter");
    
    class CustomReporter extends BaseReporter {
      reportSuiteState(suiteState) {
        // generate a Test Suite report
      }
  
      reportUnitState(unitState) {
        // generate a Test Unit report
      }
  
      reportSuiteError(errReport, suiteState) {
        // generate an Error report
      }
  
      reportUnitError(errReport, unitState) {
        // generate an Error report
      }
  
      printStateReports() {
        // print collected state reports
      }
  
      printErrorReports() {
        // print collected error reports
      } 
    }
  
    return {
      testDir: "__tests__",
      srcDir: "src",
      reporters: [CustomReporter]
      // alternatively, keep the default reporter as is:
      // reporters: ["default", CustomReporter]
    }
  }
  ```

### Bug Fixes

- #### Fix/log interceptor and diff patches ([#4](https://github.com/react-gjs/gest/pull/4))

  Because all logs within tests are intercepted and logged only after all test runs have finished, if an object was logged and then mutated after, in logs that object would be printed with the changes that happened after it was console.log'ed. 
  
  This now has been fixed, all values given to the log function will now be deeply copied, so mutating them afterwards will not have any effect on the printed output.
