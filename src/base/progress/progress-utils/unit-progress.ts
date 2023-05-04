import type { It } from "../../../user-land/test-collector";
import type { SourceMapReader } from "../../sourcemaps/reader";
import type { ConfigFacade } from "../../utils/config";
import {
  _getErrorMessage,
  _getErrorStack,
  _isExpectError,
} from "../../utils/errors/error-handling";
import type {
  ProgressErrorReport,
  ProgressErrorReportParsed,
} from "./progress-parsed-error";
import type { SuiteProgress } from "./suite-progress";

export interface UnitProgressInitParams {
  suite: symbol;
  unitName: string[];
  /** In microseconds */
  duration?: number;
  error?: ProgressErrorReport;
  timedOut?: boolean;
  skipped?: boolean;
  unit?: It;
}

export type UnitErrorReport = ProgressErrorReportParsed & {
  expectLink?: string;
  isExpectError: boolean;
};

export interface UnitFinishState {
  suite: symbol;
  unitName: string[];
  /** In microseconds */
  duration?: number;
  error?: UnitErrorReport;
  timedOut?: boolean;
  skipped?: boolean;
  unitLink?: string;
}

export class UnitProgress {
  suite!: symbol;
  unitName!: string[];
  /** In microseconds */
  duration?: number;
  error?: ProgressErrorReport;
  timedOut?: boolean;
  skipped?: boolean;
  unit?: It;

  constructor(
    private parent: SuiteProgress,
    update: UnitProgressInitParams,
    private config: ConfigFacade
  ) {
    Object.assign(this, update);
  }

  private createUnitLink(sourceMap?: SourceMapReader): string | undefined {
    if (this.unit == null || !sourceMap) return undefined;

    const unitLocation = sourceMap.getOriginalPosition(
      this.unit.line,
      this.unit.column
    );

    const suiteFilepath = this.parent.getSuiteFilepath();

    if (!unitLocation) return suiteFilepath;

    return `${suiteFilepath}:${unitLocation.line}:${unitLocation.column}`;
  }

  private createExpectLink(sourceMap: SourceMapReader): string | undefined {
    if (this.error == null) return undefined;

    const suiteFilepath = this.parent.getSuiteFilepath();

    if (!_isExpectError(this.error.thrown)) return suiteFilepath;

    const expectLocation = sourceMap.getOriginalPosition(
      this.error.thrown.line,
      this.error.thrown.column
    );

    if (!expectLocation) return suiteFilepath;

    return `${suiteFilepath}:${expectLocation.line}:${expectLocation.column}`;
  }

  private parseError(sourceMap?: SourceMapReader): UnitErrorReport | undefined {
    if (this.error) {
      const message = _getErrorMessage(this.error.thrown);
      const stack = _getErrorStack(this.error.thrown, sourceMap, this.config);

      return {
        thrown: this.error.thrown,
        origin: this.error.origin,
        message: message,
        stack: stack,
        expectLink: sourceMap ? this.createExpectLink(sourceMap) : undefined,
        isExpectError: _isExpectError(this.error.thrown),
      };
    }

    return undefined;
  }

  get filepath() {
    return this.parent.getSuiteFilepath();
  }

  getFinishState(sourceMap?: SourceMapReader): UnitFinishState {
    return {
      suite: this.suite,
      unitName: this.unitName,
      duration: this.duration,
      error: this.parseError(sourceMap),
      skipped: this.skipped,
      timedOut: this.timedOut,
      unitLink: this.createUnitLink(sourceMap),
    };
  }
}
