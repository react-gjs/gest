import Fs from "fs-gjs";
import GLib from "gi://GLib?version=2.0";
import path from "path-gjsify";
import system from "system";
import { html, Output } from "termx-markup";
import { Global } from "./globals";
import { Mainloop } from "./mainloop";
import { ProgressTracker } from "./progress/progress";
import { ProgressReporter } from "./progress/reporter";
import { MainRunner } from "./runner/main-runner";
import { Multiprocessing } from "./runner/subprocess/server";
import type { TestRunnerOptions, TestSuite } from "./runner/types";
import { _getArgValue } from "./utils/args";
import { loadConfig } from "./utils/config";
import { ConsoleInterceptor } from "./utils/console-interceptor/console-interceptor";
import { currentMicrosecond } from "./utils/current-microsecond";
import {
  _getErrorMessage,
  _getErrorStack,
} from "./utils/errors/error-handling";
import { walkFiles } from "./utils/filesystem";
import { getDirname } from "./utils/get-dirname";
import { preloadGiLibs } from "./utils/preload-gi-libs";
import { initFakeTimers } from "./utils/timers";

declare global {
  function print(text: string): void;
}

// @ts-ignore
globalThis.__gest_ = {
  get imports() {
    throw new Error(
      "Usage of `imports` in tests is not allowed, please use ECMAScript modules import instead.",
    );
  },
};

async function main() {
  let failed = false;
  try {
    const startTime = currentMicrosecond();

    const pargs = imports.system.programArgs;

    if (pargs.includes("--help") || pargs.includes("-h")) {
      // prettier-ignore
      Output.print(html`
        <line bold>gest</line>
        <line>A simple test runner for Gnome JavaScript</line>
        <br />
        <line>Usage: gest [options]</line>
        <br />
        <line>Options:</line>
        <pad size="2">
          <line>-h, --help                    Show this message.</line>
          <line>-v, --verbose                 Show detailed info on each test pass.</line>
          <line>-f, --file [path]             Provide a specific test file to run.</line>
          <line>-t, --testNamePattern [regex] Pattern to match test names.</line>
          <line>-p, --testPathPattern [regex] Pattern to match test file names.</line>
          <line>-s, --silenceLogs             Silence all logs from within tests.</line>
          <line>-m, --multiprocessing         Disable or enable multiprocessing.</line>
        </pad>
      `);

      return Mainloop.exit();
    }

    const fileArg = _getArgValue(pargs, "-f", "--file");
    const testNamePattern = _getArgValue(
      pargs,
      "-t",
      "--testNamePattern",
    );
    const testFilePattern = _getArgValue(
      pargs,
      "-p",
      "--testPathPattern",
    );
    const silenceLogs =
      pargs.includes("-s") || pargs.includes("--silenceLogs");
    const multiprocessing = _getArgValue(
      pargs,
      "-m",
      "--multiprocessing",
    );

    const options: TestRunnerOptions = {
      verbose: pargs.includes("--verbose") || pargs.includes("-v"),
      testNamePattern,
      testFilePattern,
    };

    const _dirname = getDirname(import.meta.url);

    let tmpDir = path.join(_dirname, "_tmp");
    if (tmpDir.includes("/node_modules/")) {
      while (true) {
        if (path.parse(tmpDir).name === "node_modules") {
          break;
        }

        tmpDir = path.dirname(tmpDir);

        if (tmpDir.length === 1) {
          throw new Error("Could not find node_modules directory.");
        }
      }

      tmpDir = path.join(tmpDir, ".cache/gest");
    }
    Global.setTmpDir(tmpDir);

    try {
      await Fs.makeDir(tmpDir);
    } catch {
      //
    }

    const config = await loadConfig(pargs, options);

    if (!config) {
      return Mainloop.exit(1);
    }

    await preloadGiLibs(config);

    if (multiprocessing != null) {
      config.override(
        "multiprocessing",
        ["false", "0"].includes(multiprocessing) ? false : true,
      );
    }

    const testsDir = path.resolve(Global.getCwd(), config.testDir);
    const parallel = config.parallel;

    const testFileMatcher = /.*\.test\.(m|c){0,1}(ts|js|tsx|jsx)$/;
    const setupFileMatcher = /.*\.setup\.(m|c){0,1}js$/;

    const testFiles: TestSuite[] = [];

    if (fileArg) {
      const fullPath = path.resolve(Global.getCwd(), fileArg);
      const filename = path.basename(fullPath);
      if (testFileMatcher.test(filename)) {
        testFiles.push({
          dirname: path.dirname(fullPath),
          filename: filename,
          basename: filename.replace(
            /\.test\.(m|c){0,1}(ts|js|tsx|jsx)$/,
            "",
          ),
          testFile: fullPath,
        });
      }
    } else {
      if (!(await Fs.fileExists(testsDir))) {
        Output.print(html`
          <span color="yellow">
            Given test directory does not exist (
            <span color="white"> ${testsDir} </span>
            )
          </span>
        `);
        return Mainloop.exit(1);
      }

      await walkFiles(testsDir, (root, name) => {
        if (testFileMatcher.test(name)) {
          testFiles.push({
            dirname: root,
            filename: name,
            basename: name.replace(
              /\.test\.(m|c){0,1}(ts|js|tsx|jsx)$/,
              "",
            ),
            testFile: path.join(root, name),
          });
        }
      });
    }

    if (testFiles.length === 0) {
      Output.print(
        html`<span color="yellow">No test files found.</span>`,
      );
      return Mainloop.exit(1);
    }

    await walkFiles(testsDir, (root, name) => {
      if (setupFileMatcher.test(name)) {
        const basename = name.replace(
          /\.setup\.(m|c){0,1}(ts|js|tsx|jsx)$/,
          "",
        );
        const unit = testFiles.find(
          (unit) =>
            unit.basename === basename && unit.dirname === root,
        );

        if (unit) {
          unit.setupFile = path.join(root, name);
        }
      }
    });

    const consoleInterceptor = ConsoleInterceptor.getInterceptor();

    const progressTracker = new ProgressTracker(config);

    const monitor = new ProgressReporter(
      progressTracker,
      !!options.verbose,
      config,
    );

    initFakeTimers(consoleInterceptor);

    const testRunners = Array.from(
      { length: parallel },
      () =>
        new MainRunner(testFiles, config, progressTracker, options),
    );

    await Promise.all(testRunners.map((runner) => runner.start()));

    await progressTracker.flush();

    const endTime = currentMicrosecond();
    const totalDuration = endTime - startTime; // in microseconds

    if (!silenceLogs) {
      ConsoleInterceptor.printCollectedLogs(consoleInterceptor);
    }

    Output.print("");

    monitor.flushErrorBuffer();
    monitor.printSummary(totalDuration);

    if (testRunners.some((runner) => !runner.success)) {
      return Mainloop.exit(1);
    }

    Mainloop.exit();
  } catch (e) {
    Output.print(
      html`<pre color="red">${_getErrorMessage(e)}</pre>
        <br /><br />
        <pre>${_getErrorStack(e, undefined)}</pre>`,
    );
    failed = true;
  } finally {
    await Multiprocessing.close().catch(() => {});
    Mainloop.exit(failed ? 1 : undefined);
  }
}

try {
  Global.setCwd(GLib.get_current_dir());

  Output.setDefaultPrintMethod(print);

  Mainloop.start()
    .then((exitCode) => {
      system.exit(exitCode);
    })
    .catch((e) => {
      print(String(e));
      system.exit(1);
    });

  main();
} catch (e) {
  print(String(e));
  system.exit(1);
}
