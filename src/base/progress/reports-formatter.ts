import { MarkupFormatter, html, raw } from "termx-markup";
import { _leftPad } from "../utils/left-pad";

export type SummaryInfo = {
  failedSuites: number;
  failedUnits: number;
  skippedSuites: number;
  skippedUnits: number;
  passedSuites: number;
  passedUnits: number;
};

MarkupFormatter.defineColor("customBlack", "#1b1c26");
MarkupFormatter.defineColor("customGrey", "#3d3d3d");

export class ReportsFormatter {
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
      const symbol = ReportsFormatter.symbol.Skipped;
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`<pad size="4">${symbol}<s />${name}</pad>`;
    },
    /**
     * @example
     *   [✓] MonitorMessages > info > unitPassed (123 microseconds)
     */
    unitPassed(unitName: string[], duration: number | string): string {
      const symbol = ReportsFormatter.symbol.Success;
      const name = ReportsFormatter.formatUnitName(unitName);

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
      const symbol = ReportsFormatter.symbol.Failure;
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`<pad size="4"> ${symbol}<s />${name}<s /> </pad>`;
    },
    /**
     * @example
     *   [!] MonitorMessages > info > unitTimedOut (timed-out)
     */
    unitTimedOut(unitName: string[]): string {
      const symbol = ReportsFormatter.symbol.Timeout;
      const name = ReportsFormatter.formatUnitName(unitName);

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
      const symbol = ReportsFormatter.symbol.Skipped;

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
      const symbol = ReportsFormatter.symbol.Success;

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
      const symbol = ReportsFormatter.symbol.Failure;

      return html`<span>
        ${symbol}
        <s />
        <span bold color="red">${filepath}</span>
        <s />
        <span bold color="customGrey" bg="lightRed">FAILED</span>
      </span>`;
    },
    summary(info: SummaryInfo): string {
      return html`
        <span>
          <line bold>Test Suites:</line>
          <pad size="3">
            <line>
              Passed:
              <s /><s />
              <span
                bold
                color="${info.passedSuites > 0 ? "lightGreen" : "white"}"
              >
                ${info.passedSuites}
              </span>
            </line>
            <line>
              Failed:
              <s /><s />
              <span
                bold
                color="${info.failedSuites > 0 ? "lightRed" : "white"}"
              >
                ${info.failedSuites}
              </span>
            </line>
            <span>
              Skipped:
              <s />
              <span
                bold
                color="${info.skippedSuites > 0 ? "lightYellow" : "white"}"
              >
                ${info.skippedSuites}
              </span>
            </span>
          </pad>
          <br />
          <line bold>Test Units: </line>
          <pad size="3">
            <line>
              Passed:
              <s /><s />
              <span
                bold
                color="${info.passedUnits > 0 ? "lightGreen" : "white"}"
              >
                ${info.passedUnits}
              </span>
            </line>
            <line>
              Failed:
              <s /><s />
              <span bold color="${info.failedUnits > 0 ? "lightRed" : "white"}">
                ${info.failedUnits}
              </span>
            </line>
            <span>
              Skipped:
              <s />
              <span
                bold
                color="${info.skippedUnits > 0 ? "lightYellow" : "white"}"
              >
                ${info.skippedUnits}
              </span>
            </span>
          </pad>
          <br /><br />
          ${info.failedSuites === 0 && info.failedUnits === 0
            ? raw(
                html`
                  <span bold color="lightGreen">All tests have passed.</span>
                `
              )
            : raw(
                html`
                  <span bold color="lightRed">Some tests have failed.</span>
                `
              )}
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
      diff?: string
    ): string {
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`
        <br />
        <span>
          <line bold color="red">${name}</line>
          ${ReportsFormatter.formatLink(link)}
          <pad size="4">
            <pre>${errMessage}</pre>
          </pad>
          ${ReportsFormatter.formatExpected(expected)}
          ${ReportsFormatter.formatReceived(received)}
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
          ${ReportsFormatter.formatLink(filepath)}
          ${ReportsFormatter.formatError(errMessage, stack)}
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
          ${ReportsFormatter.formatLink(link)}
          ${ReportsFormatter.formatError(errMessage, stack)}
        </span>
      `;
    },
    unknownUnitError(
      unitName: string[],
      link: string,
      errMessage: string,
      stack: string
    ): string {
      const name = ReportsFormatter.formatUnitName(unitName);

      return html`
        <br />
        <span>
          <line bold color="red">${name}</line>
          ${ReportsFormatter.formatLink(link)}
          ${ReportsFormatter.formatError(errMessage, stack)}
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
          ${ReportsFormatter.formatLink(filepath)}
          ${ReportsFormatter.formatError(errMessage, stack)}
        </span>
      `;
    },
  };
}
