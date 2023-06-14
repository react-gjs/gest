import GLib from "gi://GLib?version=2.0";
import { deepCopy } from "../deep-copy";
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
  ) {
    parent["_logs"].push(this);
  }

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
  private static init() {
    const interceptor = new ConsoleInterceptor();

    // @ts-ignore
    globalThis.__gest_console = interceptor;

    return interceptor;
  }

  static getInterceptor() {
    // @ts-ignore
    if (!globalThis.__gest_console) {
      return this.init();
    }

    // @ts-ignore
    return globalThis.__gest_console as ConsoleInterceptor;
  }

  static printCollectedLogs(ci: ConsoleInterceptor) {
    printInterceptedLogs(ci._logs);
  }

  private constructor() {}

  private _logs: Log[] = [];

  public print = (...data: any[]) => {
    new Log(this, "print", deepCopy(data));
  };

  public log = (...data: any[]) => {
    new Log(this, "log", deepCopy(data));
  };

  public error = (...data: any[]) => {
    new Log(this, "error", deepCopy(data));
  };

  public warn = (...data: any[]) => {
    new Log(this, "warn", deepCopy(data));
  };

  public info = (...data: any[]) => {
    new Log(this, "info", deepCopy(data));
  };

  public debug = (...data: any[]) => {
    new Log(this, "debug", deepCopy(data));
  };

  public table = (...data: any[]) => {
    new Log(this, "table", deepCopy(data));
  };

  public clear = () => {
    new Log(this, "clear", []);
  };

  public assert = (...data: any[]) => {
    new Log(this, "assert", deepCopy(data), new Error().stack);
  };

  public count = (label: string) => {
    new Log(this, "count", [label]);
  };

  public countReset = (label: string) => {
    new Log(this, "countReset", [label]);
  };

  public dir = (...data: any[]) => {
    new Log(this, "dir", deepCopy(data));
  };

  public dirxml = (...data: any[]) => {
    new Log(this, "dirxml", deepCopy(data));
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
    new Log(this, "timeLog", [label, ...deepCopy(data)]);
  };

  public trace = (...data: any[]) => {
    new Log(this, "trace", deepCopy(data), new Error().stack);
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
