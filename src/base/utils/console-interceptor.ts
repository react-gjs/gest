import GLib from "gi://GLib";

type Console = Omit<typeof console, "Console">;

class Log {
  private index: number;
  private timestamp: number =
    GLib.DateTime.new_now_local()?.get_microsecond() ?? 0;

  constructor(
    private parent: ConsoleInterceptor,
    private type: keyof Console | "print",
    private data: any[]
  ) {
    const log = this.parent["_logs"];

    this.index = log.push(this) - 1;
  }

  public toString() {
    return `console.${this.type}:\n${this.data
      .map((d) => String(d))
      .join(" ")}`;
  }
}

export class ConsoleInterceptor implements Console {
  static init() {
    const interceptor = new ConsoleInterceptor();

    // @ts-ignore
    globalThis.__gest_console = interceptor;

    return interceptor;
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

  public table = (tabularData?: any, properties?: string[]) => {
    new Log(this, "table", [tabularData, properties]);
  };

  public clear = () => {
    new Log(this, "clear", []);
  };

  public assert = (...data: any[]) => {
    new Log(this, "assert", data);
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

  public group = (...data: any[]) => {
    new Log(this, "group", data);
  };

  public groupCollapsed = (...data: any[]) => {
    new Log(this, "groupCollapsed", data);
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
    new Log(this, "timeLog", [label, data]);
  };

  public trace = (...data: any[]) => {
    new Log(this, "trace", data);
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

  public toString() {
    return this._logs.map((l) => l.toString()).join("\n");
  }
}
