import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=3.0";
import system from "system";
import { html, MarkupFormatter, Output } from "termx-markup";
import { Global } from "./globals";
import { ProgressMonitor } from "./progress/monitor";
import { ProgressTracker } from "./progress/progress";
import type { TestRunnerOptions, TestSuite } from "./test-runner";
import { TestRunner } from "./test-runner";
import { _getArgValue } from "./utils/args";
import { ConsoleInterceptor } from "./utils/console-interceptor";
import { getCwd, setCwd } from "./utils/cwd";
import { _getErrorMessage, _getErrorStack } from "./utils/error-handling";
import { _mkdir, _readdir, _readFile, _walkFiles } from "./utils/filesystem";
import { getDirname } from "./utils/get-dirname";
import { _hasProperties } from "./utils/has-properties";
import path from "./utils/path";

declare global {
  function print(text: string): void;
}

type GestConfig = {
  testDirectory: string;
  parallel: number;
  setup?: string;
};

let exitCode = 0;

async function loadConfig() {
  const files = await _readdir(getCwd());

  if (files.includes("gest.config.json")) {
    const configText = await _readFile(path.join(getCwd(), "gest.config.json"));
    const config = JSON.parse(configText);

    let isValid = false;

    if (typeof config === "object") {
      if (_hasProperties(config, "testDirectory", "parallel")) {
        if (
          typeof config.testDirectory === "string" &&
          typeof config.parallel === "number"
        ) {
          isValid = true;
        }
      }

      if (_hasProperties(config, "setup")) {
        if (typeof config.setup !== "string") {
          isValid = false;
        }
      }
    }

    if (isValid) {
      return config as GestConfig;
    } else {
      Output.print(
        // prettier-ignore
        html`<span color="yellow">Invalid config file. Using default config instead.</span>`
      );
    }
  }
}

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
        <line>  -h, --help</line>
        <line>  -v, --verbose</line>
        <line>  -t, --testNamePattern [regex]</line>
        <line>  -p, --testPathPattern [regex]</line>
      `);

      return;
    }

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

    const config = await loadConfig();

    const testsDir = config?.testDirectory ?? "./__tests__";
    const parallel = config?.parallel ?? 4;

    const testFileMatcher = /.*\.test\.(m|c){0,1}(ts|js|tsx|jsx)$/;
    const setupFileMatcher = /.*\.setup\.(m|c){0,1}js$/;

    const testFiles: TestSuite[] = [];

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

    const monitor = new ProgressMonitor(progressTracker, !!options.verbose);

    const testRunners = Array.from(
      { length: parallel },
      () => new TestRunner(testFiles, progressTracker, config?.setup, options)
    );

    await Promise.all(testRunners.map((runner) => runner.start()));

    await progressTracker.flush();

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

    print(consoleInterceptor.toString());
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
  setCwd(GLib.get_current_dir());

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
