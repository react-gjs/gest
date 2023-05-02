import GLib from "gi://GLib?version=2.0";
import Gtk from "gi://Gtk?version=3.0";
import system from "system";
import { html, MarkupFormatter, Output } from "termx-markup";
import { Global } from "./globals";
import { ProgressTracker } from "./progress/progress";
import { ProgressReporter } from "./progress/reporter";
import type { TestRunnerOptions, TestSuite } from "./test-runner";
import { TestRunner } from "./test-runner";
import { _getArgValue } from "./utils/args";
import { loadConfig } from "./utils/config";
import { ConsoleInterceptor } from "./utils/console-interceptor/console-interceptor";
import { _getErrorMessage, _getErrorStack } from "./utils/error-handling";
import { _fileExists, _mkdir, _walkFiles } from "./utils/filesystem";
import { getDirname } from "./utils/get-dirname";
import path from "./utils/path";

declare global {
  function print(text: string): void;
}

// @ts-ignore
globalThis.__gest_ = {
  get imports() {
    throw new Error(
      "Usage of `imports` in tests is not allowed, please use ECMAScript modules import instead."
    );
  },
};

let exitCode = 0;

async function main() {
  try {
    // @ts-expect-error
    const pargs: string[] = imports.system.programArgs;

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
          <line>-h, --help</line>
          <line>-v, --verbose</line>
          <line>-f, --file [path]</line>
          <line>-t, --testNamePattern [regex]</line>
          <line>-p, --testPathPattern [regex]</line>
        </pad>
      `);

      return;
    }

    const fileArg = _getArgValue(pargs, "-f", "--file");
    const testNamePattern = _getArgValue(pargs, "-t", "--testNamePattern");
    const testFilePattern = _getArgValue(pargs, "-p", "--testPathPattern");

    const options: TestRunnerOptions = {
      verbose: pargs.includes("--verbose") || pargs.includes("-v"),
      testNamePattern,
      testFilePattern,
    };

    const tmpDir = path.join(getDirname(import.meta.url), "_tmp");
    Global.setTmpDir(tmpDir);

    try {
      await _mkdir(tmpDir);
    } catch {
      //
    }

    const config = await loadConfig(pargs, options);

    if (!config) {
      exitCode = 1;
      return;
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
          basename: filename.replace(/\.test\.(m|c){0,1}(ts|js|tsx|jsx)$/, ""),
          testFile: fullPath,
        });
      }
    } else {
      if (!(await _fileExists(testsDir))) {
        Output.print(
          html`
            <span color="yellow">
              Given test directory does not exist (
              <span color="white"> ${testsDir} </span>
              )
            </span>
          `
        );
        return;
      }

      await _walkFiles(testsDir, (root, name) => {
        if (testFileMatcher.test(name)) {
          testFiles.push({
            dirname: root,
            filename: name,
            basename: name.replace(/\.test\.(m|c){0,1}(ts|js|tsx|jsx)$/, ""),
            testFile: path.join(root, name),
          });
        }
      });
    }

    if (testFiles.length === 0) {
      Output.print(html`<span color="yellow">No test files found.</span>`);
      return;
    }

    await _walkFiles(testsDir, (root, name) => {
      if (setupFileMatcher.test(name)) {
        const basename = name.replace(
          /\.setup\.(m|c){0,1}(ts|js|tsx|jsx)$/,
          ""
        );
        const unit = testFiles.find(
          (unit) => unit.basename === basename && unit.dirname === root
        );

        if (unit) {
          unit.setupFile = path.join(root, name);
        }
      }
    });

    const consoleInterceptor = ConsoleInterceptor.init();

    const progressTracker = new ProgressTracker();

    const monitor = new ProgressReporter(
      progressTracker,
      !!options.verbose,
      config
    );

    const testRunners = Array.from(
      { length: parallel },
      () => new TestRunner(testFiles, config, progressTracker, options)
    );

    await Promise.all(testRunners.map((runner) => runner.start()));

    await progressTracker.flush();

    ConsoleInterceptor.printCollectedLogs(consoleInterceptor);

    monitor.flushErrorBuffer();

    if (testRunners.some((runner) => !runner.success)) {
      exitCode = 1;
      Output.println(
        html`<br /><br /><span color="red">Tests have failed.</span>`
      );
    } else {
      Output.println(
        html`<br /><br /><span color="green">All tests have passed.</span>`
      );
    }
  } catch (e) {
    Output.print(
      html`<pre color="red">${_getErrorMessage(e)}</pre>
        <br /><br />
        <pre>${_getErrorStack(e)}</pre>`
    );
    exitCode = 1;
  } finally {
    Gtk.main_quit();
  }
}

try {
  Global.setCwd(GLib.get_current_dir());

  Output.setDefaultPrintMethod(print);
  MarkupFormatter.defineColor("customBlack", "#1b1c26");
  MarkupFormatter.defineColor("customGrey", "#3d3d3d");

  setTimeout(() => main());

  Gtk.main();

  system.exit(exitCode);
} catch (e) {
  print(String(e));
  system.exit(1);
}
