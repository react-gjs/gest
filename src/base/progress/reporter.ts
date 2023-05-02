import { Output, OutputBuffer } from "termx-markup";
import type { ExpectError } from "../../user-land";
import type { ConfigFacade } from "../utils/config";
import { BaseReporter } from "./base-reporter";
import type { ProgressTracker } from "./progress";
import type { ProgressErrorReportParsed } from "./progress-utils/progress-parsed-error";
import type { SuiteFinishState } from "./progress-utils/suite-progress";
import type {
  UnitErrorReport,
  UnitFinishState,
} from "./progress-utils/unit-progress";
import type { SummaryInfo } from "./reports-formatter";
import { ReportsFormatter } from "./reports-formatter";

export class DefaultReporter extends BaseReporter {
  private output = new OutputBuffer();
  private errorBuffer = new OutputBuffer();
  private hasErrors = false;

  private printErr(...markup: string[]) {
    this.hasErrors = true;
    this.errorBuffer.print(...markup);
  }

  override reportSuiteState(
    suiteState: SuiteFinishState,
    unitResults: UnitFinishState[]
  ) {
    const filepath = suiteState.testFilepath;
    const hasAnyUnitFailed =
      suiteState.errors.length > 0 ||
      unitResults.some((u) => u.error || u.timedOut);

    if (suiteState.skipped) {
      this.output.print(ReportsFormatter.info.suiteSkipped(filepath));
    } else if (hasAnyUnitFailed) {
      this.output.print(ReportsFormatter.info.suiteFailed(filepath));
    } else {
      this.output.print(ReportsFormatter.info.suitePassed(filepath));
    }
  }

  override reportUnitState(unitState: UnitFinishState) {
    if (unitState.skipped) {
      this.output.print(ReportsFormatter.info.unitSkipped(unitState.unitName));
    } else if (unitState.error) {
      this.output.print(ReportsFormatter.info.unitFailed(unitState.unitName));
    } else {
      this.output.print(
        ReportsFormatter.info.unitPassed(
          unitState.unitName,
          unitState.duration ?? "?"
        )
      );
    }
  }

  override reportSuiteError(
    errReport: ProgressErrorReportParsed,
    suiteState: SuiteFinishState
  ) {
    switch (errReport.origin) {
      case "gest":
        this.printErr(
          ReportsFormatter.error.unableToStartSuite(
            suiteState.testFilepath,
            this.parseError(errReport.thrown, errReport),
            errReport.stack ?? ""
          )
        );
        break;
      case "lifecycleHook":
        this.printErr(
          ReportsFormatter.error.lifecycleHook(
            errReport.link ?? suiteState.testFilepath,
            this.parseError(errReport.thrown, errReport),
            errReport.stack ?? ""
          )
        );
        break;
      case "test":
        this.printErr(
          ReportsFormatter.error.unknownSuiteError(
            suiteState.testFilepath,
            this.parseError(errReport.thrown, errReport),
            errReport.stack ?? ""
          )
        );
        break;
    }
  }

  override reportUnitError(
    errReport: UnitErrorReport,
    update: UnitFinishState
  ) {
    if (errReport.isExpectError) {
      const err = errReport.thrown as ExpectError;
      this.printErr(
        ReportsFormatter.error.expectError(
          update.unitName,
          errReport.expectLink ?? "",
          this.parseError(err, errReport),
          err.expected,
          err.received,
          err.diff
        )
      );
    } else {
      this.printErr(
        ReportsFormatter.error.unknownUnitError(
          update.unitName,
          update.unitLink ?? "",
          this.parseError(errReport.thrown, errReport),
          errReport.stack ?? ""
        )
      );
    }
  }

  override printStateReports(): void {
    this.output.flush();
  }

  override printErrorReports(): boolean {
    if (this.hasErrors) {
      this.errorBuffer.flush();
      return true;
    }
    return false;
  }

  override printSummary(summary: SummaryInfo): void {
    Output.print(ReportsFormatter.info.summary(summary));
  }
}

export class ProgressReporter {
  private suiteReporters: Array<BaseReporter> = [];

  private summaryInfo: SummaryInfo = {
    failedSuites: 0,
    failedUnits: 0,
    passedSuites: 0,
    passedUnits: 0,
    skippedSuites: 0,
    skippedUnits: 0,
  };

  constructor(
    tracker: ProgressTracker,
    private readonly verbose: boolean,
    private readonly config: ConfigFacade
  ) {
    tracker.on("suiteAdded", (suiteID) => {
      const suiteEmitter = tracker.suiteEmitter(suiteID);

      suiteEmitter.on("finished", (suiteState, unitResults) => {
        this.reportFinishedSuite(suiteState, unitResults);
        this.updateSummeryInfo(suiteState, unitResults);
      });
    });
  }

  parseError(
    err: any,
    errReport: UnitErrorReport | ProgressErrorReportParsed
  ): string {
    if (this.config.errorReporterParser) {
      try {
        const m = this.config.errorReporterParser(err, errReport);

        if (typeof m !== "string") {
          throw new Error("Error reporter parser must return a string.");
        }
      } catch {
        //
      }
    }

    return errReport.message;
  }

  private reportFinishedSuite(
    suiteState: SuiteFinishState,
    unitResults: UnitFinishState[]
  ) {
    const reporters = this.config.reporters.map((r) =>
      typeof r === "string" ? DefaultReporter : r
    );

    for (const Reporter of reporters) {
      try {
        const suiteReporter = new Reporter();
        suiteReporter.parseError = (e, m) => this.parseError(e, m);
        this.suiteReporters.push(suiteReporter);

        suiteReporter.reportSuiteState(suiteState, unitResults);

        if (this.verbose) {
          for (const update of unitResults) {
            suiteReporter.reportUnitState(update);
          }
        }

        suiteReporter.printStateReports();

        for (const update of unitResults) {
          if (update.error) {
            suiteReporter.reportUnitError(update.error, update);
          }
        }

        for (const error of suiteState.errors) {
          suiteReporter.reportSuiteError(error, suiteState);
        }
      } catch {
        //
      }
    }
  }

  private updateSummeryInfo(
    suiteState: SuiteFinishState,
    unitResults: UnitFinishState[]
  ) {
    if (suiteState.skipped) {
      this.summaryInfo.skippedSuites++;
    } else if (
      suiteState.errors.length > 0 ||
      unitResults.some((u) => u.error || u.timedOut)
    ) {
      this.summaryInfo.failedSuites++;
    } else {
      this.summaryInfo.passedSuites++;
    }

    for (const unit of unitResults) {
      if (unit.skipped) {
        this.summaryInfo.skippedUnits++;
      } else if (unit.error || unit.timedOut) {
        this.summaryInfo.failedUnits++;
      } else {
        this.summaryInfo.passedUnits++;
      }
    }
  }

  flushErrorBuffer() {
    for (const reporter of this.suiteReporters) {
      const wasPrinted = reporter.printErrorReports();
      if (wasPrinted) {
        Output.print(""); // add a new line, in between error reports
      }
    }
  }

  printSummary() {
    const reporters = this.config.reporters.map((r) =>
      typeof r === "string" ? DefaultReporter : r
    );

    for (const Reporter of reporters) {
      try {
        const suiteReporter = new Reporter();
        suiteReporter.parseError = (e, m) => this.parseError(e, m);

        suiteReporter.printSummary(this.summaryInfo);
      } catch {
        //
      }
    }
  }
}
