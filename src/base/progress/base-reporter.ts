import type { ProgressErrorReportParsed } from "./progress-utils/progress-parsed-error";
import type { SuiteFinishState } from "./progress-utils/suite-progress";
import type {
  UnitErrorReport,
  UnitFinishState,
} from "./progress-utils/unit-progress";

export abstract class BaseReporter {
  parseError: (
    err: any,
    errReport: UnitErrorReport | ProgressErrorReportParsed
  ) => string = (_, m) => m.message;

  /**
   * After a Test Suite is finished, this method is called once.
   * It is expected that this method will generate a report but
   * not print it to the console until `printStateReports` is
   * called.
   */
  reportSuiteState(
    suiteState: SuiteFinishState,
    unitResults: UnitFinishState[]
  ): void {}

  /**
   * After a Test Suite is finished, if the `verbose` options is
   * enabled, this method is called for each finished unit. It is
   * expected that this method will generate a report but not
   * print it to the console until `printStateReports` is
   * called.
   */
  reportUnitState(unitState: UnitFinishState): void {}

  /**
   * After a Test Suite is finished, this method is called for
   * each error that occurred when the Suite was running, but is
   * not associated with any specific unit. It is expected that
   * this method will generate a report but not print it to the
   * console until `printErrorReports` is called.
   */
  reportSuiteError(
    errReport: ProgressErrorReportParsed,
    suiteState: SuiteFinishState
  ): void {}

  /**
   * After a Test Suite is finished, this method is called for
   * each error that occurred when the Suite was running, and is
   * associated with a specific unit. It is expected that this
   * method will generate a report but not print it to the
   * console until `printErrorReports` is called.
   */
  reportUnitError(errReport: UnitErrorReport, update: UnitFinishState): void {}

  /**
   * When this method is called, all reports generated by this
   * Reporter should be printed to the console.
   */
  printStateReports(): void {}

  /**
   * When this method is called, all error reports generated by
   * this Reporter should be printed to the console.
   */
  printErrorReports(): void {}
}

export type {
  ProgressErrorReportParsed,
  SuiteFinishState,
  UnitErrorReport,
  UnitFinishState,
};