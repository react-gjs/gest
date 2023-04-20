import type {
  ProgressErrorReportParsed,
  UnitErrorReport,
} from "../progress/base-reporter";

export type ErrorReporterParser = (
  err: any,
  errReport: UnitErrorReport | ProgressErrorReportParsed
) => string;
