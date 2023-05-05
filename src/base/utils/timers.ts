import GLib from "gi://GLib?version=2.0";
import { padLeftLines } from "../../user-land/utils/pad-left-lines";
import type { GestTimers } from "../builder/injects";
import type { ConsoleInterceptor } from "./console-interceptor/console-interceptor";

class Timer {
  constructor(
    private id: number,
    private callback: (...args: any[]) => any,
    public readonly targetTime: number,
    private defaultArgs: any[]
  ) {}

  is(id: number) {
    return this.id === id;
  }

  getID() {
    return this.id;
  }

  run(args?: any[]) {
    return this.callback(...(args ?? this.defaultArgs));
  }
}

export class FakeTimerRegistry {
  private nextId = 1;
  private timers: Array<Timer> = [];

  private lastGivenMillisecond = 0;
  private getMillisecond() {
    let result = GLib.get_monotonic_time() / 1000;

    if (result <= this.lastGivenMillisecond) {
      result = this.lastGivenMillisecond + 1;
    }

    this.lastGivenMillisecond = result;

    return result;
  }

  private generateID() {
    return this.nextId++;
  }

  /** Sorts timer by the target time in descending order. */
  private sortTimers() {
    const sortFn = (a: Timer, b: Timer) => {
      return a.targetTime - b.targetTime;
    };
    this.timers.sort(sortFn);
  }

  public clear() {
    this.timers = [];
  }

  public count() {
    return this.timers.length;
  }

  public addTimeout(
    callback: (...args: any[]) => any,
    ms: number | undefined,
    args: any[]
  ) {
    const currentMillisecond = this.getMillisecond();
    const targetTime = currentMillisecond + (ms ?? 0);

    const timer = new Timer(this.generateID(), callback, targetTime, args);
    this.timers.push(timer);
    this.sortTimers();
    return timer;
  }

  public cancelTimeout(id: number) {
    this.timers = this.timers.filter((t) => !t.is(id));
  }

  public runAll() {
    const allTimers = this.timers;
    this.timers = [];

    for (const timer of allTimers) {
      try {
        timer.run();
      } catch (e) {
        //
      }
    }
  }

  public runNext(args?: any[]) {
    const timer = this.timers.shift();

    if (timer) {
      return timer.run(args);
    }
  }
}

export const initFakeTimers = (console: ConsoleInterceptor) => {
  const originalSetTimeout = setTimeout;
  const originalSetInterval = setInterval;

  const __gest_getSetTimeout = (container: GestTimers) => {
    const fakeTimerRegistry = new FakeTimerRegistry();

    Object.assign(container, {
      timeoutRegistry: fakeTimerRegistry,
      setTimeout(
        callback: (...args: any[]) => any,
        ms?: number,
        ...args: any[]
      ) {
        const error = new Error();

        const handleError = (err: any) => {
          console.error(
            "Exception raised in a timeout callback:",
            err,
            "\nThe above error was raised in this 'setTimeout':",
            error.stack && "\n  " + padLeftLines(error.stack, " ", 2)
          );
        };

        const fn = (...fnArgs: any[]) => {
          try {
            const result = callback.apply(null, fnArgs);

            if (result && result instanceof Promise) {
              return result.catch(handleError);
            }
            return result;
          } catch (err) {
            handleError(err);
          }
        };

        if (container.useFakeTimers) {
          return fakeTimerRegistry.addTimeout(fn, ms, args).getID();
        } else {
          const id = setTimeout(fn, ms, ...args);
          return id;
        }
      },
    });
  };

  Object.defineProperty(globalThis, "__gest_getSetTimeout", {
    value: __gest_getSetTimeout,
  });

  Object.defineProperty(globalThis, "__gest_originalSetTimeout", {
    value: originalSetTimeout,
  });

  Object.defineProperty(globalThis, "__gest_originalSetInterval", {
    value: originalSetInterval,
  });
};

declare global {
  const __gest_getSetTimeout:
    | undefined
    | ((container: { setTimeout: typeof setTimeout }) => void);

  const __gest_getSetInterval:
    | undefined
    | ((container: { setInterval: typeof setInterval }) => void);

  const __gest_originalSetTimeout: typeof setTimeout | undefined;
  const __gest_originalSetInterval: typeof setInterval | undefined;
}
