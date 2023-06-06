import { html, Output, raw } from "termx-markup";
import { findLastIndex } from "../find-last-index";
import {
  jsonToPresentation,
  strForPresentation,
} from "../json-to-presentation";
import type { Log } from "./console-interceptor";

const DEFAULT_COUNTER = Symbol("DEFAULT_COUNTER");

class Printer {
  private counters = new Map<any, number>();
  private timers = new Map<any, Log>();
  private currentGroup: string[] = [];

  constructor() {}

  private formatLogArgs(data: any[] | ReadonlyArray<any>) {
    const p: string[] = [];

    for (const d of data) {
      if (typeof d === "string") {
        p.push(html`<pre>${strForPresentation(d)}</pre>`);
      } else if (typeof d === "object" && d != null && d instanceof Error) {
        p.push(
          html`
            <pre>${strForPresentation(d.message)}</pre>
            <br />
            <pad size="2">
              <pre>${strForPresentation(d.stack ?? "")}</pre>
            </pad>
            <br />
          `
        );
      } else {
        p.push(html`<pre>${jsonToPresentation(d, 5)}</pre>`);
      }
    }

    const content = p.reduce(
      (c, elem) =>
        c.endsWith("\n</pre>") || elem.startsWith("<pre>\n")
          ? c + elem
          : c + "<s />" + elem,
      ""
    );

    return raw("<span>" + content + "</span>");
  }

  public printAssert(log: Log) {
    if (!log.data[0]) {
      Output.print(html`
        <span>
          <span color="lightRed">ASSERTION FAILED:<s /></span>
          ${this.formatLogArgs(log.data.slice(1))}
        </span>
      `);
    }
  }

  public printClear(log: Log) {
    // no-op
  }

  public printCount(log: Log, noPrint = false) {
    const label = log.data[0] ?? DEFAULT_COUNTER;
    const count = (this.counters.get(label) ?? 0) + 1;
    this.counters.set(label, count);

    if (!noPrint) {
      Output.print(html`
        <span>
          <span color="green">COUNT<s /></span>
          ${this.formatLogArgs([label])}
          <span>: ${count}</span>
        </span>
      `);
    }
  }

  public printCountReset(log: Log, noPrint = false) {
    const label = log.data[0] ?? DEFAULT_COUNTER;
    this.counters.set(label, 0);

    if (!noPrint) {
      Output.print(html`
        <span>
          <span color="green">COUNT<s /></span>
          ${this.formatLogArgs([label])}
          <span>: 0</span>
        </span>
      `);
    }
  }

  public printDebug(log: Log) {
    Output.print(html`
      <span>
        <span color="magenta">DEBUG:<s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printDir(log: Log) {
    Output.print(html`
      <span>
        <span color="white">DIR:<s /><s /><s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printDirxml(log: Log) {
    Output.print(html`
      <span>
        <span color="white">DIRXML:<s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printError(log: Log) {
    Output.print(html`
      <span>
        <span color="lightRed">ERROR:<s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printGroup(log: Log, noPrint = false) {
    const label = log.data[0] ?? "";

    this.currentGroup.push(label);

    Output.print(html`
      <span color="white">-------- GROUP ${label} --------</span>
    `);
  }

  public printGroupCollapsed(log: Log, noPrint = false) {
    const label = log.data[0] ?? "";

    this.currentGroup.push(label);

    Output.print(html`
      <span color="white">-------- GROUP ${label} --------</span>
    `);
  }

  public printGroupEnd(log: Log, noPrint = false) {
    const label = this.currentGroup.pop();

    if (label == null) {
      return;
    }

    Output.print(html`
      <span color="white">-------- GROUP END ${label} --------</span>
    `);
  }

  public printInfo(log: Log) {
    Output.print(html`
      <span>
        <span color="yellow">INFO:<s /><s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printLog(log: Log) {
    Output.print(html`
      <span>
        <span color="lightCyan">LOG:<s /><s /><s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printPrint(log: Log) {
    Output.print(html`
      <span>
        <span color="lightCyan">PRINT:<s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printProfile(log: Log) {
    // no-op
  }

  public printProfileEnd(log: Log) {
    // no-op
  }

  public printTable(log: Log) {
    Output.print(html`
      <span>
        <span color="white">TABLE:<s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }

  public printTime(log: Log) {
    const label = log.data[0];

    if (label == null) {
      return;
    }

    this.timers.set(label, log);
  }

  public printTimeEnd(log: Log) {
    const label = log.data[0];
    const timer = this.timers.get(label);
    this.timers.delete(label);

    if (timer == null) {
      Output.print(html`
        <span>
          <span color="white">TIMER<s /></span>
          ${this.formatLogArgs([label])}
          <span>: undefined</span>
        </span>
      `);

      return;
    }

    const duration = log.getTime() - timer.getTime();

    Output.print(html`
      <span>
        <span color="white">TIMER<s /></span>
        ${this.formatLogArgs([label])}
        <span>: ${duration}ms - timer ended</span>
      </span>
    `);
  }

  public printTimeLog(log: Log) {
    const label = log.data[0];
    const timer = this.timers.get(label);

    if (timer == null) {
      Output.print(html`
        <span>
          <span color="white">TIMER<s /></span>
          ${this.formatLogArgs([label])}
          <span>: undefined</span>
        </span>
      `);

      return;
    }

    const duration = log.getTime() - timer.getTime();

    Output.print(html`
      <span>
        <span color="white">TIMER<s /></span>
        ${this.formatLogArgs([label])}
        <span>: ${duration}ms - timer ended</span>
      </span>
    `);
  }

  public printTimeStamp(log: Log) {
    // no-op
  }

  public printTrace(log: Log) {
    Output.print(html`
      <span>
        <span color="white">TRACE:<s /></span>
        ${this.formatLogArgs(log.data)}
        <br />
        <pad size="2">
          <pre>${log.stack}</pre>
        </pad>
      </span>
    `);
  }

  public printWarn(log: Log) {
    Output.print(html`
      <span>
        <span color="#db8814">WARN:<s /><s /></span>
        ${this.formatLogArgs(log.data)}
      </span>
    `);
  }
}

export function printInterceptedLogs(logs: Log[]) {
  if (logs.length === 0) return;

  Output.print("");

  const printer = new Printer();

  const lastClear = findLastIndex(logs, (l) => l.type === "clear");

  const clearedLogs = lastClear !== -1 ? logs.slice(0, lastClear) : [];
  const printedLogs = lastClear !== -1 ? logs.slice(lastClear + 1) : logs;

  for (const log of clearedLogs) {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (log.type) {
      case "count":
        printer.printCount(log, true);
        break;
      case "countReset":
        printer.printCountReset(log, true);
        break;
      case "group":
        printer.printGroup(log, true);
        break;
      case "groupCollapsed":
        printer.printGroupCollapsed(log, true);
        break;
      case "groupEnd":
        printer.printGroupEnd(log, true);
        break;
      case "time":
        printer.printTime(log);
        break;
    }
  }

  for (const log of printedLogs) {
    switch (log.type) {
      case "assert":
        printer.printAssert(log);
        break;
      case "clear":
        printer.printClear(log);
        break;
      case "count":
        printer.printCount(log);
        break;
      case "countReset":
        printer.printCountReset(log);
        break;
      case "debug":
        printer.printDebug(log);
        break;
      case "dir":
        printer.printDir(log);
        break;
      case "dirxml":
        printer.printDirxml(log);
        break;
      case "error":
        printer.printError(log);
        break;
      case "group":
        printer.printGroup(log);
        break;
      case "groupCollapsed":
        printer.printGroupCollapsed(log);
        break;
      case "groupEnd":
        printer.printGroupEnd(log);
        break;
      case "info":
        printer.printInfo(log);
        break;
      case "log":
        printer.printLog(log);
        break;
      case "print":
        printer.printPrint(log);
        break;
      case "profile":
        printer.printProfile(log);
        break;
      case "profileEnd":
        printer.printProfileEnd(log);
        break;
      case "table":
        printer.printTable(log);
        break;
      case "time":
        printer.printTime(log);
        break;
      case "timeEnd":
        printer.printTimeEnd(log);
        break;
      case "timeLog":
        printer.printTimeLog(log);
        break;
      case "timeStamp":
        printer.printTimeStamp(log);
        break;
      case "trace":
        printer.printTrace(log);
        break;
      case "warn":
        printer.printWarn(log);
        break;
    }
  }
}
