import type { SuiteUpdateParams } from "../../progress/progress-utils/suite-progress";
import type { UnitProgressInitParams } from "../../progress/progress-utils/unit-progress";
import { printError } from "./print-error";
import { serializeError } from "./serialize-error";

export class ProgressTrackerProxy {
  suiteProgress(progressUpdate: SuiteUpdateParams) {
    // @ts-ignore
    delete progressUpdate.suite;

    if (progressUpdate.error) {
      progressUpdate.error.thrown = serializeError(
        progressUpdate.error.thrown,
      );
    }

    Subprocess!.invoke
      .suiteProgress(progressUpdate)
      .catch(printError);
  }

  unitProgress(progressUpdate: UnitProgressInitParams) {
    // @ts-ignore
    delete progressUpdate.suite;

    if (progressUpdate.error) {
      progressUpdate.error.thrown = serializeError(
        progressUpdate.error.thrown,
      );
    }

    Subprocess!.invoke.unitProgress(progressUpdate).catch(printError);
  }

  finish(duration?: number) {
    Subprocess!.invoke.finish(duration).catch(printError);
  }
}
