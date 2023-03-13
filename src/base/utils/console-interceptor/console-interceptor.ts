import GLib from "gi://GLib?version=2.0";
import { printInterceptedLogs } from "./printer";

type Console = Omit<typeof console, "Console">;

class Log {
  private timestamp: number =
    GLib.DateTime.new_now_local()?.get_microsecond() ?? 0;

  constructor(
    protected parent: ConsoleInterceptor,
    readonly type: keyof Console | "print",
    readonly data: ReadonlyArray<any>,
    readonly stack?: string
  ) {}

  getTime() {
    return Math.round(this.timestamp / 1000);
  }

  public toString() {
    return `console.${this.type}:\n${this.data
      .map((d) => String(d))
      .join(" ")}`;
  }
}

export type { Log };

export class ConsoleInterceptor implements Console {
  static init() {
    const interceptor = new ConsoleInterceptor();

    // @ts-ignore
    globalThis.__gest_console = interceptor;

    return interceptor;
  }

  static printCollectedLogs(ci: ConsoleInterceptor) {
    printInterceptedLogs(ci._logs);
  }

  private constructor() {}

  private _logs: Log[] = [];

  public print = (...data: any[]) => {
    new Log(this, "print", data);
  };

  public log = (...data: any[]) => {
    new Log(this, "log", data);
  };

  public error = (...data: any[]) => {
    new Log(this, "error", data);
  };

  public warn = (...data: any[]) => {
    new Log(this, "warn", data);
  };

  public info = (...data: any[]) => {
    new Log(this, "info", data);
  };

  public debug = (...data: any[]) => {
    new Log(this, "debug", data);
  };

  public table = (...data: any[]) => {
    new Log(this, "table", data);
  };

  public clear = () => {
    new Log(this, "clear", []);
  };

  public assert = (...data: any[]) => {
    new Log(this, "assert", data, new Error().stack);
  };

  public count = (label: string) => {
    new Log(this, "count", [label]);
  };

  public countReset = (label: string) => {
    new Log(this, "countReset", [label]);
  };

  public dir = (...data: any[]) => {
    new Log(this, "dir", data);
  };

  public dirxml = (...data: any[]) => {
    new Log(this, "dirxml", data);
  };

  public group = (label: string) => {
    new Log(this, "group", [label]);
  };

  public groupCollapsed = (label: string) => {
    new Log(this, "groupCollapsed", [label]);
  };

  public groupEnd = () => {
    new Log(this, "groupEnd", []);
  };

  public time = (label: string) => {
    new Log(this, "time", [label]);
  };

  public timeEnd = (label: string) => {
    new Log(this, "timeEnd", [label]);
  };

  public timeLog = (label: string, ...data: any[]) => {
    new Log(this, "timeLog", [label, ...data]);
  };

  public trace = (...data: any[]) => {
    new Log(this, "trace", data, new Error().stack);
  };

  public profile = (label: string) => {
    new Log(this, "profile", [label]);
  };

  public profileEnd = (label: string) => {
    new Log(this, "profileEnd", [label]);
  };

  public timeStamp = (label: string) => {
    // no-op
  };
}
