import { html, OutputBuffer, raw } from "termx-markup";
import type { It, Test, TestHook } from "../user-land/test-collector";
import { _buildFile } from "./builder/build-file";
import { SourceMapReader } from "./sourcemaps/reader";
import { _async } from "./utils/async";
import { getCwd } from "./utils/cwd";
import {
  _getErrorMessage,
  _getErrorStack,
  _isExpectError,
} from "./utils/error-handling";
import { _deleteFile, _readFile } from "./utils/filesystem";
import { _leftPad } from "./utils/left-pad";
import { NoLogError } from "./utils/no-log-err";
import path from "./utils/path";

export type TestUnit = {
  dirname: string;
  basename: string;
  filename: string;
  testFile: string;
  setupFile?: string;
};

export type TestUnitInfo = {
  sourceFile: string;
  bundleFile: string;
  mapFile: string;
};

export type RunnerTestOutputs = {
  err: OutputBuffer;
  info: OutputBuffer;
};

export type TestRunnerOptions = {
  verbose?: boolean;
  testNamePattern?: string;
  testFilePattern?: string;
};

function _isTest(t: any): t is Test {
  return t && typeof t === "object" && t.name && t.line !== undefined;
}

export class TestRunner {
  private options: TestRunnerOptions = {};

  private get verbose() {
    return this.options.verbose ?? false;
  }

  success = true;
  mainOutput = new OutputBuffer();
  testErrorOutputs: OutputBuffer[] = [];

  constructor(private testFileQueue: TestUnit[], private mainSetup?: string) {}

  makePath(parentList: string[]) {
    return parentList
      .map((n) => `"${n}"`)
      .join(html`<pre bold color="white">${" > "}</pre>`);
  }

  private testNameMatches(name: string) {
    const { testNamePattern } = this.options;
    if (!testNamePattern) return true;
    return name.match(testNamePattern) !== null;
  }

  private testFileMatches(name: string) {
    const { testFilePattern } = this.options;
    if (!testFilePattern) return true;
    return name.match(testFilePattern) !== null;
  }

  private async getSourceMapFileContent(filePath: string) {
    try {
      const fileContent = await _readFile(filePath);
      return JSON.parse(fileContent);
    } catch {
      return undefined;
    }
  }

  async getLocationFromMap(info: TestUnitInfo, line: number, column: number) {
    try {
      const fileContent = await _readFile(info.mapFile);
      const map = JSON.parse(fileContent);
      const sourceReader = new SourceMapReader(map);
      return sourceReader.getOriginalPosition(line, column);
    } catch (e) {
      return null;
    }
  }

  async runHook(hook: TestHook, info: TestUnitInfo, output: RunnerTestOutputs) {
    try {
      await hook.callback();
    } catch (e) {
      const location = await this.getLocationFromMap(
        info,
        hook.line,
        hook.column
      );
      const link =
        info.sourceFile +
        (location ? `:${location?.line}:${location?.column}` : "");

      // prettier-ignore
      output.err.println(html`
        <line bold bg="customBlack" color="red">An error occurred when running a lifecycle hook:</line>
        <pre>${_getErrorMessage(e)}</pre><br />
        <span color="#FFFFFF">${link}</span>`
      );

      throw new NoLogError(e, "Hook error");
    }
  }

  async runTestCase(
    testCase: It,
    info: TestUnitInfo,
    parentList: string[],
    output: RunnerTestOutputs
  ) {
    const testPath = this.makePath([...parentList, testCase.name]);
    try {
      if (!this.testNameMatches(testPath)) {
        if (this.verbose) {
          output.info.println(
            html`<pre>    [-] <span color="yellow">${raw(
              testPath
            )}</span></pre>`
          );
        }
        return true;
      }
      await testCase.callback();
      output.info.print(
        html`<pre>    [✓] <span color="green">${raw(testPath)}</span></pre>`
      );
      return true;
    } catch (e) {
      output.info.print(
        html`<pre>    [✘] <span color="lightRed">${raw(testPath)}</span></pre>`
      );
      if (_isExpectError(e)) {
        e.handle();
        const location = await this.getLocationFromMap(info, e.line, e.column);
        const link =
          info.sourceFile +
          (location ? `:${location?.line}:${location?.column}` : "");

        // prettier-ignore
        output.err.print(html`
          <line bold bg="customBlack" color="red">${raw(testPath)}</line>
          <pre>${_leftPad(e.message, 4)}</pre><br />
          <span color="#FFFFFF">${link}</span>
        `);

        this.success = false;
      } else {
        const location = await this.getLocationFromMap(
          info,
          testCase.line,
          testCase.column
        );
        const link =
          info.sourceFile +
          (location ? `:${location?.line}:${location?.column}` : "");

        output.err.println(
          html`
            <line bold bg="customBlack" color="red">${raw(testPath)}</line>
            <pre>${_leftPad(_getErrorMessage(e), 4)}</pre>
            <br />
            <pre>
              ${_leftPad(
                _getErrorStack(
                  e,
                  await this.getSourceMapFileContent(info.mapFile)
                ),
                6
              )}
            </pre
            >
            <br />
            <span color="#FFFFFF">${link}</span>
          `
        );

        this.success = false;
      }
      return false;
    }
  }

  async runTest(
    test: Test,
    info: TestUnitInfo,
    parentList: string[] = [],
    output: RunnerTestOutputs
  ): Promise<boolean> {
    let passed = true;

    try {
      for (const hook of test.beforeAll) {
        await this.runHook(hook, info, output);
      }

      for (const testCase of test.its) {
        for (const hook of test.beforeEach) {
          await this.runHook(hook, info, output);
        }

        const result = await this.runTestCase(
          testCase,
          info,
          parentList.concat(test.name),
          output
        );

        passed &&= result;

        for (const hook of test.afterEach) {
          await this.runHook(hook, info, output);
        }
      }

      for (const subTest of test.subTests) {
        const result = await this.runTest(
          {
            ...subTest,
            beforeEach: [...test.beforeEach, ...subTest.beforeEach],
            afterEach: [...test.afterEach, ...subTest.afterEach],
          },
          info,
          parentList.concat(test.name),
          output
        );
        passed &&= result;
      }

      for (const hook of test.afterAll) {
        await this.runHook(hook, info, output);
      }
    } catch (e) {
      this.success = false;

      if (NoLogError.isError(e) && e instanceof NoLogError) {
        return false;
      }

      const testPath = this.makePath(parentList.concat(test.name));

      // prettier-ignore
      output.err.println(html`
        <line bold color="green">${raw(testPath)}</line>
        <line color="red">Test failed due to an error:</line>
        <pre color="rgb(180, 180, 180)">${_leftPad(_getErrorMessage(e), 4)}</pre>
      `);

      return false;
    }

    return passed;
  }

  async nextUnit() {
    if (this.testFileQueue.length === 0) return false;

    const testUnit = this.testFileQueue.pop() as TestUnit;
    const outputFile = testUnit.testFile + ".bundled.js";

    const mapFile = outputFile + ".map";
    const isOutputAbsolute = outputFile.startsWith("/");
    const importPath =
      "file://" +
      (isOutputAbsolute ? outputFile : path.resolve(getCwd(), outputFile));

    const relativePath =
      "." +
      importPath
        .replace("file://" + getCwd(), "")
        .replace(/\.bundled\.js$/, "");

    try {
      if (!this.testFileMatches(testUnit.testFile)) {
        if (this.verbose) {
          this.mainOutput.println(
            html`<pre>  [-] <span bold color="yellow">${relativePath}</span><span bold color="white" bg="lightYellow">SKIPPED</span></pre>`
          );
        }
        return true;
      }

      await _buildFile({
        input: testUnit.testFile,
        output: outputFile,
        fileSetup: testUnit.setupFile,
        mainSetup: this.mainSetup,
      });

      await _async((p) => {
        import(importPath)
          .then(async (module) => {
            const test = module.default;

            if (_isTest(test)) {
              const errTestOutput = new OutputBuffer();
              const infoTestOutput = new OutputBuffer();

              this.testErrorOutputs.push(errTestOutput);

              const passed = await this.runTest(
                test,
                {
                  sourceFile: testUnit.testFile,
                  bundleFile: outputFile,
                  mapFile: mapFile,
                },
                undefined,
                {
                  err: errTestOutput,
                  info: infoTestOutput,
                }
              );

              await _deleteFile(outputFile);
              await _deleteFile(mapFile);

              if (passed) {
                this.mainOutput.print(
                  // prettier-ignore
                  html`<pre>[✓] <pre bold color="green">${relativePath} </pre><span bold color="white" bg="lightGreen">PASSED</span></pre>`
                );
              } else {
                this.mainOutput.print(
                  // prettier-ignore
                  html`<pre>[✘] <pre bold color="red">${relativePath} </pre><span bold color="white" bg="lightRed">FAILED</span></pre>`
                );
              }

              if (this.verbose) infoTestOutput.pipe(this.mainOutput);

              p.resolve();
            } else {
              await _deleteFile(outputFile);
              await _deleteFile(mapFile);

              p.reject(new Error(`Not a test: ${testUnit.testFile}`));
            }
          })
          .catch(p.reject);
      });
    } catch (e) {
      this.success = false;
      // prettier-ignore
      this.mainOutput.println(html`
          <line color="red">Failed to start a test:</line>
          <span>"${testUnit.testFile}"</span>
      `);
      this.mainOutput.println(_getErrorMessage(e));
    } finally {
      this.mainOutput.flush();
    }

    return true;
  }

  async start() {
    while (await this.nextUnit()) {
      //
    }
  }

  setOptions(options: TestRunnerOptions) {
    Object.assign(this.options, options);
    return this;
  }
}
