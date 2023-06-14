import type { Test } from "../../../user-land/test-collector";
import type { SourceMapReader } from "../../sourcemaps/reader";
import type { ConfigFacade } from "../../utils/config";
import {
  _getErrorMessage,
  _getErrorStack,
  _getErrorType,
  _isDeferedError,
  _isExpectError,
  _isGestTestError,
} from "../../utils/errors/error-handling";
import type {
  ProgressErrorReport,
  ProgressErrorReportParsed,
} from "./progress-parsed-error";
import type { SuiteProgress } from "./suite-progress";

export interface UnitProgressInitParams {
  suite: symbol;
  unitName: string[];
  /**
   * In microseconds
   */
  duration?: number;
  error?: ProgressErrorReport;
  timedOut?: boolean;
  skipped?: boolean;
  unit?: Test;
}

export type UnitErrorReport = ProgressErrorReportParsed & {
  /**
   * Link to the `gest` statement within which the error was thrown.
   * This most most of the time will be an `expect` statement.
   */
  link?: string;
  isExpectError: boolean;
};

export interface UnitFinishState {
  suite: symbol;
  unitName: string[];
  /**
   * In microseconds
   */
  duration?: number;
  errors?: UnitErrorReport[];
  timedOut?: boolean;
  skipped?: boolean;
  unitLink?: string;
}

export class UnitProgress {
  suite!: symbol;
  unitName!: string[];
  /**
   * In microseconds
   */
  duration?: number;
  error?: ProgressErrorReport;
  timedOut?: boolean;
  skipped?: boolean;
  unit?: Test;

  constructor(
    private parent: SuiteProgress,
    update: UnitProgressInitParams,
    private config: ConfigFacade,
  ) {
    Object.assign(this, update);
  }

  private createUnitLink(
    sourceMap?: SourceMapReader,
  ): string | undefined {
    if (this.unit == null || !sourceMap) return undefined;

    const unitLocation = sourceMap.getOriginalPosition(
      this.unit.line,
      this.unit.column,
    );

    const suiteFilepath = this.parent.getSuiteFilepath();

    if (!unitLocation) return suiteFilepath;

    return `${suiteFilepath}:${unitLocation.line}:${unitLocation.column}`;
  }

  private linkFrom(
    sourceMap: SourceMapReader,
    location: { file: string; line: number; column: number },
  ) {
    const expectLocation = sourceMap.getOriginalPosition(
      location.line,
      location.column,
    );

    if (!expectLocation) return location.file;

    return `${location.file}:${expectLocation.line}:${expectLocation.column}`;
  }

  private createLink(
    sourceMap: SourceMapReader,
    error: unknown,
    fallbackLocation?: { line: number; column: number },
  ): string | undefined {
    if (error == null) return undefined;

    const suiteFilepath = this.parent.getSuiteFilepath();

    if (_isDeferedError(error)) {
      const err1 = error.errors[0]!;

      return this.linkFrom(sourceMap, {
        file: suiteFilepath,
        line: err1.line,
        column: err1.column,
      });
    } else if (_isGestTestError(error)) {
      return this.linkFrom(sourceMap, {
        file: suiteFilepath,
        line: error.line,
        column: error.column,
      });
    } else if (fallbackLocation) {
      return this.linkFrom(sourceMap, {
        file: suiteFilepath,
        line: fallbackLocation.line,
        column: fallbackLocation.column,
      });
    } else {
      return undefined;
    }
  }

  private parseSingleError(
    thrown: unknown,
    origin: ProgressErrorReport["origin"],
    sourceMap?: SourceMapReader,
    fallbackLocation?: { line: number; column: number },
  ): UnitErrorReport {
    const errType = _getErrorType(thrown);
    const message = _getErrorMessage(thrown);
    const stack = _getErrorStack(thrown, sourceMap, this.config);

    return {
      thrown,
      origin,
      errorType: errType,
      message: message,
      stack: stack,
      link: sourceMap
        ? this.createLink(sourceMap, thrown, fallbackLocation)
        : undefined,
      isExpectError: _isExpectError(thrown),
    };
  }

  private parseErrors(
    sourceMap?: SourceMapReader,
  ): UnitErrorReport[] | undefined {
    if (this.error) {
      if (_isDeferedError(this.error.thrown)) {
        return this.error.thrown.errors.map((err) =>
          this.parseSingleError(
            err.thrown,
            this.error!.origin,
            sourceMap,
            err,
          ),
        );
      }

      return [
        this.parseSingleError(
          this.error.thrown,
          this.error.origin,
          sourceMap,
        ),
      ];
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
      errors: this.parseErrors(sourceMap),
      skipped: this.skipped,
      timedOut: this.timedOut,
      unitLink: this.createUnitLink(sourceMap),
    };
  }
}
