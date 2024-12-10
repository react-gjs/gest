import path from "path-gjsify";
import { OutputBuffer } from "termx-markup";
import type { Describe } from "../../user-land/test-collector";
import { _buildFile } from "../builder/build-file";
import { Global } from "../globals";
import type { ProgressTracker } from "../progress/progress";
import type { ConfigFacade } from "../utils/config";
import { ConsoleInterceptor } from "../utils/console-interceptor/console-interceptor";
import { GestError } from "../utils/errors/gest-error";
import { Multiprocessing } from "./subprocess/server";
import { SuiteRunner } from "./suite-runner";
import type { TestRunnerOptions, TestSuite } from "./types";
import { currentMicrosecond } from "../utils/current-microsecond";
import { readStream } from "../utils/read-stream";

export type TestFilepaths = {
  srcFile: string;
  bundleFile: string;
  bundle: string;
  map: string;
};

function isDescribe(t: any): t is Describe {
  return t && typeof t === "object" && t.name && t.line !== undefined;
}

class WorkerApi {
  currentSuiteID?: symbol;
  currentTracker?: ProgressTracker;

  constructor(private runner: MainRunner) {}

  onNextFinish = (e?: any) => {};

  private api: MainProcessApi = {
    testsFailed: () => {
      this.runner.success = false;
    },
    unitProgress: (progressUpdate) => {
      if (!this.currentSuiteID || !this.currentTracker) {
        console.warn(
          "No suite ID or tracker set for worker API, progress update will be lost.",
        );
        return;
      }

      progressUpdate.suite = this.currentSuiteID;
      this.currentTracker.unitProgress(progressUpdate);
    },
    suiteProgress: (progressUpdate) => {
      if (!this.currentSuiteID || !this.currentTracker) {
        console.warn(
          "No suite ID or tracker set for worker API, progress update will be lost.",
        );
        return;
      }

      progressUpdate.suite = this.currentSuiteID;
      this.currentTracker.suiteProgress(progressUpdate);
    },
    finish: (duration?: number) => {
      if (!this.currentSuiteID || !this.currentTracker) {
        console.warn(
          "No suite ID or tracker set for worker API, progress update will be lost.",
        );
        return;
      }

      this.currentTracker.finish(this.currentSuiteID, duration);
    },
    sendLog: (type, data) => {
      const interceptor = ConsoleInterceptor.getInterceptor();
      interceptor[type].apply(interceptor, data);
    },
    testFinished: (error) => {
      this.onNextFinish(error);
    },
  };

  setSuiteId(id: symbol) {
    this.currentSuiteID = id;
  }

  setTracker(tracker: ProgressTracker) {
    this.currentTracker = tracker;
  }

  getApi(): MainProcessApi {
    return this.api;
  }
}

export class MainRunner {
  success = true;
  mainOutput = new OutputBuffer();
  testErrorOutputs: OutputBuffer[] = [];
  runnerID = Symbol("runnerID");
  workerApi = new WorkerApi(this);

  constructor(
    private testFileQueue: TestSuite[],
    private config: ConfigFacade,
    private tracker: ProgressTracker,
    private options: TestRunnerOptions = {},
  ) {}

  private testFileMatches(name: string) {
    const { testFilePattern } = this.options;
    if (!testFilePattern) return true;
    return name.match(testFilePattern) !== null;
  }

  private resolvePaths(testFilePath: string): TestFilepaths {
    const outputFile =
      path.resolve(
        Global.getTmpDir(),
        path.relative(Global.getCwd(), testFilePath),
      ) + ".bundled.js";

    const mapFile = outputFile + ".map";

    const isOutputAbsolute = outputFile.startsWith("/");

    const importPath =
      "file://" +
      (isOutputAbsolute
        ? outputFile
        : path.resolve(Global.getCwd(), outputFile));

    return {
      srcFile: testFilePath,
      bundle: outputFile,
      bundleFile: importPath,
      map: mapFile,
    };
  }

  private async runTestOnSubprocess(
    id: symbol,
    filepaths: TestFilepaths,
  ) {
    this.workerApi.setTracker(this.tracker);
    this.workerApi.setSuiteId(id);

    const worker = await Multiprocessing.getWorker(
      this.runnerID,
      this.workerApi.getApi(),
    );

    return new Promise<void>(async (resolve, reject) => {
      let complete = false;

      this.workerApi.onNextFinish = (e) => {
        complete = true;
        if (e) reject(e);
        else resolve();
      };

      worker.invoke
        .runSuite(
          filepaths,
          this.options,
          this.config.defaultTimeoutThreshold,
        )
        .catch(reject);

      worker.onExit((ecode, _, stderr) => {
        if (complete) return;

        readStream(stderr)
          .catch(() =>
            new TextEncoder().encode(
              "Unable to read the subprocess stderr stream",
            ),
          )
          .then((stderr) => {
            reject(
              new Error(
                "Test subprocess exites unexpectedly with: " +
                  new TextDecoder().decode(stderr),
              ),
            );
          });
      });
    });
  }

  private async runTestOnMainThread(
    id: symbol,
    filepaths: TestFilepaths,
  ) {
    const module = await import(filepaths.bundleFile);

    const test = module.default;

    const timeout =
      module.timeout && typeof module.timeout === "number"
        ? (module.timeout as number)
        : this.config.defaultTimeoutThreshold;

    if (isDescribe(test)) {
      const suiteRunner = new SuiteRunner(
        { ...this.options, timeout },
        this.tracker,
        id,
      );

      const start = currentMicrosecond();
      const passed = await suiteRunner.runSuite(test);
      const end = currentMicrosecond();

      if (!passed) this.success = false;

      this.tracker.finish(id, end - start);

      return;
    } else {
      const err = new GestError(
        `Not a test: ${filepaths.srcFile}\nMake sure the to add a default export to your test file.`,
      );

      this.tracker.suiteProgress({
        suite: id,
        error: {
          origin: "gest",
          thrown: err,
        },
      });
      this.tracker.finish(id);

      throw err;
    }
  }

  async nextSuite() {
    if (this.testFileQueue.length === 0) return false;

    const testUnit = this.testFileQueue.pop()!;

    const filepaths = this.resolvePaths(testUnit.testFile);

    const suiteID = this.tracker.createSuiteTracker({
      filepath: testUnit.testFile,
      bundle: filepaths.bundleFile,
      map: filepaths.map,
    });

    try {
      if (!this.testFileMatches(testUnit.testFile)) {
        this.tracker.suiteProgress({
          suite: suiteID,
          skipped: true,
        });
        this.tracker.finish(suiteID);

        return true;
      }

      await _buildFile({
        input: testUnit.testFile,
        output: filepaths.bundle,
        fileSetup: testUnit.setupFile,
        mainSetup: this.config.setup,
        globals: this.config.globals,
        projectSrcDir: path.resolve(
          Global.getCwd(),
          this.config.srcDir,
        ),
      });

      if (this.config.multiprocessing) {
        await this.runTestOnSubprocess(suiteID, filepaths);
      } else {
        await this.runTestOnMainThread(suiteID, filepaths);
      }
    } catch (e) {
      this.success = false;

      if (!GestError.isGestError(e)) {
        this.tracker.suiteProgress({
          suite: suiteID,
          error: {
            origin: "test",
            thrown: e,
          },
        });
        this.tracker.finish(suiteID);
      }
    }

    return true;
  }

  async start() {
    while (await this.nextSuite()) {
      //
    }

    await Multiprocessing.terminateWorker(this.runnerID);
  }
}
