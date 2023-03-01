import { _async } from "../utils/async";
import { Emitter } from "../utils/emitter";
import type {
  SuiteProgressEvents,
  SuiteProgressInitParams,
  SuiteUpdateParams,
} from "./progress-utils/suite-progress";
import { SuiteProgress } from "./progress-utils/suite-progress";
import type { UnitProgressInitParams } from "./progress-utils/unit-progress";

export type ProgressTrackerEvents = {
  suiteAdded: (suite: symbol) => void;
};

export class ProgressTracker {
  private suites: SuiteProgress[] = [];
  private readonly emitter = new Emitter<ProgressTrackerEvents>();
  private readonly outputFlushOps: Array<Promise<void>> = [];

  private getSuite(suite: symbol) {
    return this.suites.find((s) => s.id === suite)!;
  }

  suiteEmitter(suite: symbol) {
    const s = this.getSuite(suite);

    return {
      on<K extends keyof SuiteProgressEvents>(
        event: K,
        listener: SuiteProgressEvents[K]
      ) {
        s.emitter.on(event, listener);
      },
      off<K extends keyof SuiteProgressEvents>(
        event: K,
        listener: SuiteProgressEvents[K]
      ) {
        s.emitter.off(event, listener);
      },
    };
  }

  on<K extends keyof ProgressTrackerEvents>(
    event: K,
    listener: ProgressTrackerEvents[K]
  ) {
    this.emitter.on(event, listener);
  }

  off<K extends keyof ProgressTrackerEvents>(
    event: K,
    listener: ProgressTrackerEvents[K]
  ) {
    this.emitter.off(event, listener);
  }

  createSuiteTracker(params: SuiteProgressInitParams) {
    const suite = new SuiteProgress(params);
    this.suites.push(suite);

    this.emitter.emitImmediate("suiteAdded", suite.id);

    return suite.id;
  }

  suiteProgress(progressUpdate: SuiteUpdateParams) {
    const suite = this.getSuite(progressUpdate.suite);

    suite.addSuiteUpdate(progressUpdate);
  }

  unitProgress(progressUpdate: UnitProgressInitParams) {
    const suite = this.getSuite(progressUpdate.suite);

    suite.addUnitUpdate(progressUpdate);
  }

  finish(suite: symbol) {
    const s = this.getSuite(suite);

    this.outputFlushOps.push(
      _async((p) => {
        s.emitter.on("finished", () => {
          p.resolve();
        });
        s.finish().catch((e) => {
          e.mapFile = s.map;
          p.reject(e);
        });
      })
    );
  }

  flush() {
    return Promise.all(this.outputFlushOps);
  }
}
