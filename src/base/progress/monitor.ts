import { html, OutputBuffer, raw } from "termx-markup";
import type { ExpectError } from "../../user-land";
import { _leftPad } from "../utils/left-pad";
import type { ProgressTracker } from "./progress";
import type { SuiteFinishState } from "./progress-utils/suite-progress";
import type { UnitFinishState } from "./progress-utils/unit-progress";

class MonitorMessages {
  private static formatUnitName(unitName: string[]) {
    return raw(
      "<span>" +
        unitName.join(html`<pre bold color="cyan">${" > "}</pre>`) +
        "</span>"
    );
  }

  private static formatError(message: string, stack?: string) {
    const stackf = stack
      ? raw(html`
          <br />
          <line color="magenta" bold><pad size="2">Stack:</pad></line>
          <pad size="4">
            <pre>${stack.trim()}</pre>
          </pad>
        `)
      : "";

    return raw(html`
      <line color="magenta" bold>
        <pad size="2"> Message: </pad>
      </line>
      <pad size="4">
        <pre>${message}</pre>
      </pad>
      ${stackf}
      <br />
    `);
  }

  private static formatLink(link: string) {
    return raw(html`<line color="#91e5ff">${link}</line>`);
  }

  private static formatReceived(received?: string) {
    if (!received) return "";

    const label = "Received:";
    const text = _leftPad(received, label.length + 1).trimStart();

    return raw(
      html` <br />
        <pad size="6">
          <span bold>${label}</span>
          <pre color="lightRed"> ${text}</pre>
        </pad>`
    );
  }

  private static formatExpected(expected?: string) {
    if (!expected) return "";

    const label = "Expected:";
    const text = _leftPad(expected, label.length + 1).trimStart();

    return raw(
      html` <br />
        <pad size="6">
          <span bold>${label}</span>
          <pre color="lightGreen"> ${text}</pre>
        </pad>`
    );
  }

  static symbol = {
    /** Preview: [✓] */
    Success: raw(html`<span>[<span color="green">✓</span>]</span>`),
    /** Preview: [✗] */
    Failure: raw(html`<span>[<span color="red">✗</span>]</span>`),
    /** Preview: [-] */
    Skipped: raw(html`<span>[<span color="yellow">-</span>]</span>`),
    /** Preview: [!] */
    Timeout: raw(html`<span>[<span color="lightRed">!</span>]</span>`),
  };

  static info = {
    /**
     * @example
     *   [-] MonitorMessages > info > unitSkipped
     */
    unitSkipped(unitName: string[]): string {
      const symbol = MonitorMessages.symbol.Skipped;
      const name = MonitorMessages.formatUnitName(unitName);

      return html`<pad size="4">${symbol}<s />${name}</pad>`;
    },
    /**
     * @example
     *   [✓] MonitorMessages > info > unitPassed (123 microseconds)
     */
    unitPassed(unitName: string[], duration: number | string): string {
      const symbol = MonitorMessages.symbol.Success;
      const name = MonitorMessages.formatUnitName(unitName);

      return html`<pad size="4">
        ${symbol}<s />${name}<s />
        <span dim>${duration} microseconds</span>
      </pad>`;
    },
    /**
     * @example
     *   [✗] MonitorMessages > info > unitFailed (123 microseconds)
     */
    unitFailed(unitName: string[]): string {
      const symbol = MonitorMessages.symbol.Failure;
      const name = MonitorMessages.formatUnitName(unitName);

      return html`<pad size="4"> ${symbol}<s />${name}<s /> </pad>`;
    },
    /**
     * @example
     *   [!] MonitorMessages > info > unitTimedOut (timed-out)
     */
    unitTimedOut(unitName: string[]): string {
      const symbol = MonitorMessages.symbol.Timeout;
      const name = MonitorMessages.formatUnitName(unitName);

      return html`<pad size="4">
        ${symbol}<s />${name}<s />
        <span dim>(timed-out)</span>
      </pad>`;
    },
    /**
     * @example
     *   [-] __tests__/base/progress/monitor.test.ts SKIPPED
     */
    suiteSkipped(filepath: string): string {
      const symbol = MonitorMessages.symbol.Skipped;

      return html`<span>
        ${symbol}
        <s />
        <span bold color="yellow">${filepath}</span>
        <s />
        <span bold color="customGrey" bg="lightYellow">SKIPPED</span>
      </span>`;
    },
    /**
     * @example
     *   [✓] __tests__/base/progress/monitor.test.ts PASSED
     */
    suitePassed(filepath: string): string {
      const symbol = MonitorMessages.symbol.Success;

      return html`<span>
        ${symbol}
        <s />
        <span bold color="green">${filepath}</span>
        <s />
        <span bold color="customGrey" bg="lightGreen">PASSED</span>
      </span>`;
    },
    /**
     * @example
     *   [✗] __tests__/base/progress/monitor.test.ts FAILED
     */
    suiteFailed(filepath: string): string {
      const symbol = MonitorMessages.symbol.Failure;

      return html`<span>
        ${symbol}
        <s />
        <span bold color="red">${filepath}</span>
        <s />
        <span bold color="customGrey" bg="lightRed">FAILED</span>
      </span>`;
    },
  };

  static error = {
    expectError(
      unitName: string[],
      link: string,
      errMessage: string,
      expected?: string,
      received?: string,
      diff?: string
    ): string {
      const name = MonitorMessages.formatUnitName(unitName);

      return html`
        <br />
        <span>
          <line bold color="red">${name}</line>
          ${MonitorMessages.formatLink(link)}
          <pad size="4">
            <pre>${errMessage}</pre>
          </pad>
          ${MonitorMessages.formatExpected(expected)}
          ${MonitorMessages.formatReceived(received)}
          ${diff
            ? raw(html`
                <br />
                <pad size="8">
                  <pre>${diff}</pre>
                </pad>
              `)
            : ""}
        </span>
      `;
    },
    unableToStartSuite(
      filepath: string,
      errMessage: string,
      stack: string
    ): string {
      return html`
        <br />
        <span>
          <line color="red">Failed to start a test:</line>
          ${MonitorMessages.formatLink(filepath)}
          ${MonitorMessages.formatError(errMessage, stack)}
        </span>
      `;
    },
    lifecycleHook(link: string, errMessage: string, stack: string): string {
      return html`
        <br />
        <span>
          <line bold color="red">
            An error occurred when running a lifecycle hook:
          </line>
          ${MonitorMessages.formatLink(link)}
          ${MonitorMessages.formatError(errMessage, stack)}
        </span>
      `;
    },
    unknownUnitError(
      unitName: string[],
      link: string,
      errMessage: string,
      stack: string
    ): string {
      const name = MonitorMessages.formatUnitName(unitName);

      return html`
        <br />
        <span>
          <line bold color="red">${name}</line>
          ${MonitorMessages.formatLink(link)}
          ${MonitorMessages.formatError(errMessage, stack)}
        </span>
      `;
    },
    unknownSuiteError(
      filepath: string,
      errMessage: string,
      stack: string
    ): string {
      return html`
        <br />
        <span>
          <line bold color="red"> An error occurred when running a test: </line>
          ${MonitorMessages.formatLink(filepath)}
          ${MonitorMessages.formatError(errMessage, stack)}
        </span>
      `;
    },
  };
}

export class ProgressMonitor {
  private errorBuffer = new OutputBuffer();
  private hasErrors = false;

  constructor(tracker: ProgressTracker, private readonly verbose: boolean) {
    tracker.on("suiteAdded", (suiteID) => {
      const suiteEmitter = tracker.suiteEmitter(suiteID);

      suiteEmitter.on("finished", (suiteState, updates) => {
        this.process(suiteState, updates);
      });
    });
  }

  private printErr(...markup: string[]) {
    this.hasErrors = true;
    this.errorBuffer.print(...markup);
  }

  private process(suiteState: SuiteFinishState, updates: UnitFinishState[]) {
    const buffer = new OutputBuffer();

    const filepath = suiteState.testFilepath;
    const hasAnyUnitFailed =
      suiteState.errors.length > 0 ||
      updates.some((u) => u.error || u.timedOut);

    if (suiteState.skipped) {
      buffer.print(MonitorMessages.info.suiteSkipped(filepath));
    } else if (hasAnyUnitFailed) {
      buffer.print(MonitorMessages.info.suiteFailed(filepath));
    } else {
      buffer.print(MonitorMessages.info.suitePassed(filepath));
    }

    if (this.verbose) {
      for (const update of updates) {
        if (update.skipped) {
          buffer.print(MonitorMessages.info.unitSkipped(update.unitName));
        } else if (update.error) {
          buffer.print(MonitorMessages.info.unitFailed(update.unitName));
        } else {
          buffer.print(
            MonitorMessages.info.unitPassed(
              update.unitName,
              update.duration ?? "?"
            )
          );
        }
      }
    }

    buffer.flush();

    for (const update of updates) {
      if (update.error) {
        if (update.error.isExpectError) {
          const err = update.error.thrown as ExpectError;
          this.printErr(
            MonitorMessages.error.expectError(
              update.unitName,
              update.error.expectLink ?? "",
              update.error.message,
              err.expected,
              err.received,
              err.diff
            )
          );
        } else {
          this.printErr(
            MonitorMessages.error.unknownUnitError(
              update.unitName,
              update.unitLink ?? "",
              update.error.message,
              update.error.stack ?? ""
            )
          );
        }
      }
    }

    for (const error of suiteState.errors) {
      switch (error.origin) {
        case "gest":
          this.printErr(
            MonitorMessages.error.unableToStartSuite(
              suiteState.testFilepath,
              error.message,
              error.stack ?? ""
            )
          );
          break;
        case "lifecycleHook":
          this.printErr(
            MonitorMessages.error.lifecycleHook(
              error.link ?? suiteState.testFilepath,
              error.message,
              error.stack ?? ""
            )
          );
          break;
        case "test":
          this.printErr(
            MonitorMessages.error.unknownSuiteError(
              suiteState.testFilepath,
              error.message,
              error.stack ?? ""
            )
          );
          break;
      }
    }
  }

  flushErrorBuffer() {
    if (this.hasErrors) {
      this.errorBuffer.flush();
    }
  }
}
