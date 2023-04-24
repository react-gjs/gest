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
