import { MarkupFormatter, html, raw } from "termx-markup";
import { strForPresentation } from "../utils/json-to-presentation";
import { _leftPad } from "../utils/left-pad";

export type SummaryInfo = {
  failedSuites: number;
  failedUnits: number;
  skippedSuites: number;
  skippedUnits: number;
  passedSuites: number;
  passedUnits: number;
  totalDuration: number;
};

MarkupFormatter.defineColor("customBlack", "#1b1c26");
MarkupFormatter.defineColor("customGrey", "#3d3d3d");

const time = {
  hour: 3600000000n,
  minute: 60000000n,
  second: 1000000n,
  millisecond: 1000n,
} as const;

export class ReportsFormatter {
  private static formatUnitName(unitName: string[]) {
    return raw(html`
      <span>
        ${raw(
          unitName
            .map(strForPresentation)
            .map((n) => html` <span>${n}</span> `)
            .join(html`
              <span
                color="cyan"
                bold
              >
                ${">"}
              </span>
            `),
        )}
      </span>
    `);
  }

  private static formatError(message: string, stack?: string) {
    const stackf = stack
      ? raw(html`
          <line
            color="magenta"
            bold
            ><pad size="2">Stack:</pad></line
          >
          <pad size="4">
            <pre>${strForPresentation(stack.trim())}</pre>
          </pad>
        `)
      : "";

    return raw(html`
      <line
        color="magenta"
        bold
      >
        <pad size="2"> Message: </pad>
      </line>
      <pad size="4">
        <pre>${strForPresentation(message)}</pre>
      </pad>
      ${stackf}
      <br />
    `);
  }

  private static formatLink(link: string) {
    return raw(
      html`<line color="#91e5ff">${strForPresentation(link)}</line>`,
    );
  }

  private static formatReceived(received?: string) {
    if (!received) return "";

    const label = "Received:";
    const text = received;

    return raw(html`
      <pad size="6">
        <span bold>${label}</span>
        <pre color="lightRed">${text}</pre>
      </pad>
    `);
  }

  private static formatExpected(expected?: string) {
    if (!expected) return "";

    const label = "Expected:";
    const text = expected;

    return raw(html`
      <pad size="6">
        <span bold>${label}</span>
        <pre color="lightGreen">${text}</pre>
      </pad>
    `);
  }

  private static formatDuration(_microseconds: number) {
    const microseconds = BigInt(Math.round(_microseconds));

    const hours = Number(microseconds / time.hour);
    const minutes = Number((microseconds % time.hour) / time.minute);
    const seconds = Number(
      (microseconds % time.minute) / time.second,
    );
    const milliseconds = Number(
      (microseconds % time.second) / time.millisecond,
    );

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else if (seconds > 0) {
      return `${seconds}s ${milliseconds}ms`;
    } else if (milliseconds > 0) {
      return `${milliseconds}ms`;
    } else {
      return `${microseconds}μs`;
    }
  }

  static symbol = {
    /**
     * Preview: [✓]
     */
    Success: raw(html`<span>[<span color="green">✓</span>]</span>`),
    /**
     * Preview: [✗]
     */
    Failure: raw(html`<span>[<span color="red">✗</span>]</span>`),
    /**
     * Preview: [-]
     */
    Skipped: raw(html`<span>[<span color="yellow">-</span>]</span>`),
    /**
     * Preview: [!]
     */
    Timeout: raw(
      html`<span>[<span color="lightRed">!</span>]</span>`,
    ),
  };

  static info = {
    /**
     * @example
     *   [-] MonitorMessages > info > unitSkipped
     */
    unitSkipped(unitName: string[]): string {
      const symbol = ReportsFormatter.symbol.Skipped;
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`<pad size="4">${symbol} ${name}</pad>`;
    },
    /**
     * @example
     *   [✓] MonitorMessages > info > unitPassed (123 microseconds)
     */
    unitPassed(unitName: string[], duration: number): string {
      const symbol = ReportsFormatter.symbol.Success;
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`<pad size="4">
        ${symbol} ${name}
        <span dim>${ReportsFormatter.formatDuration(duration)}</span>
      </pad>`;
    },
    /**
     * @example
     *   [✗] MonitorMessages > info > unitFailed (123 microseconds)
     */
    unitFailed(unitName: string[]): string {
      const symbol = ReportsFormatter.symbol.Failure;
      const name = ReportsFormatter.formatUnitName(unitName);

      return html` <pad size="4"> ${symbol} ${name} </pad> `;
    },
    /**
     * @example
     *   [!] MonitorMessages > info > unitTimedOut (timed-out)
     */
    unitTimedOut(unitName: string[]): string {
      const symbol = ReportsFormatter.symbol.Timeout;
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`<pad size="4">
        ${symbol} ${name}
        <span dim>(timed-out)</span>
      </pad>`;
    },
    /**
     * @example
     *   [-] __tests__/base/progress/monitor.test.ts SKIPPED
     */
    suiteSkipped(filepath: string): string {
      const symbol = ReportsFormatter.symbol.Skipped;

      return html`<span>
        ${symbol}
        <span
          bold
          color="yellow"
        >
          ${strForPresentation(filepath)}
        </span>
      </span>`;
    },
    /**
     * @example
     *   [✓] __tests__/base/progress/monitor.test.ts PASSED
     */
    suitePassed(filepath: string, duration: number): string {
      const symbol = ReportsFormatter.symbol.Success;

      return html`<span>
        ${symbol}
        <span
          bold
          color="green"
          >${strForPresentation(filepath)}</span
        >
        <span>(${ReportsFormatter.formatDuration(duration)})</span>
      </span>`;
    },
    /**
     * @example
     *   [✗] __tests__/base/progress/monitor.test.ts FAILED
     */
    suiteFailed(filepath: string): string {
      const symbol = ReportsFormatter.symbol.Failure;

      return html`<span>
        ${symbol}
        <span
          bold
          color="red"
          >${strForPresentation(filepath)}</span
        >
      </span>`;
    },
    summary(info: SummaryInfo): string {
      return html`
        <span>
          <line bold>Test Suites:</line>
          <pad size="3">
            <line>
              <pre>Passed: </pre>
              <span
                bold
                color="${info.passedSuites > 0
                  ? "lightGreen"
                  : "white"}"
              >
                ${info.passedSuites}
              </span>
            </line>
            <line>
              <pre>Failed: </pre>
              <span
                bold
                color="${info.failedSuites > 0
                  ? "lightRed"
                  : "white"}"
              >
                ${info.failedSuites}
              </span>
            </line>
            <span>
              Skipped:
              <span
                bold
                color="${info.skippedSuites > 0
                  ? "lightYellow"
                  : "white"}"
              >
                ${info.skippedSuites}
              </span>
            </span>
          </pad>
          <br />
          <line bold>Test Units: </line>
          <pad size="3">
            <line>
              <pre>Passed: </pre>
              <span
                bold
                color="${info.passedUnits > 0
                  ? "lightGreen"
                  : "white"}"
              >
                ${info.passedUnits}
              </span>
            </line>
            <line>
              <pre>Failed: </pre>
              <span
                bold
                color="${info.failedUnits > 0 ? "lightRed" : "white"}"
              >
                ${info.failedUnits}
              </span>
            </line>
            <span>
              Skipped:
              <span
                bold
                color="${info.skippedUnits > 0
                  ? "lightYellow"
                  : "white"}"
              >
                ${info.skippedUnits}
              </span>
            </span>
          </pad>
          <br />
          ${info.failedSuites === 0 && info.failedUnits === 0
            ? raw(html`
                <line
                  bold
                  color="lightGreen"
                  >All tests have passed.</line
                >
              `)
            : raw(html`
                <line
                  bold
                  color="lightRed"
                  >Some tests have failed.</line
                >
              `)}
          <span dim>
            <span>Done in</span>
            ${ReportsFormatter.formatDuration(info.totalDuration)}
          </span>
        </span>
      `;
    },
  };

  static error = {
    expectError(
      unitName: string[],
      link: string,
      errMessage: string,
      expected?: string,
      received?: string,
      diff?: string,
    ): string {
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`
        <br />
        <span>
          <line
            bold
            color="red"
          >
            ${name}
          </line>
          ${ReportsFormatter.formatLink(link)}
          <pad size="4">
            <pre>${strForPresentation(errMessage)}</pre>
          </pad>
          ${ReportsFormatter.formatExpected(expected)}
          ${ReportsFormatter.formatReceived(received)}
          ${diff
            ? raw(html`
                <br />
                <pad size="6">
                  <span bold>Diff:</span>
                  <br />
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
      stack: string,
    ): string {
      return html`
        <br />
        <span>
          <line color="red">Failed to start a test:</line>
          ${ReportsFormatter.formatLink(filepath)}
          ${ReportsFormatter.formatError(errMessage, stack)}
        </span>
      `;
    },
    lifecycleHook(
      link: string,
      errMessage: string,
      stack: string,
    ): string {
      return html`
        <br />
        <span>
          <line
            bold
            color="red"
          >
            An error occurred when running a lifecycle hook:
          </line>
          ${ReportsFormatter.formatLink(link)}
          ${ReportsFormatter.formatError(errMessage, stack)}
        </span>
      `;
    },
    unknownUnitError(
      unitName: string[],
      link: string,
      errMessage: string,
      stack: string,
    ): string {
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`
        <br />
        <span>
          <line
            bold
            color="red"
            >${name}</line
          >
          ${ReportsFormatter.formatLink(link)}
          ${ReportsFormatter.formatError(errMessage, stack)}
        </span>
      `;
    },
    unknownSuiteError(
      filepath: string,
      errMessage: string,
      stack: string,
    ): string {
      return html`
        <br />
        <span>
          <line
            bold
            color="red"
          >
            An error occurred when running a test:
          </line>
          ${ReportsFormatter.formatLink(filepath)}
          ${ReportsFormatter.formatError(errMessage, stack)}
        </span>
      `;
    },
  };
}
