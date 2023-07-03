import GLib from "gi://GLib?version=2.0";
import { padLeftLines } from "../../user-land/utils/pad-left-lines";
import type { GestTimers } from "../builder/injects";
import type { ConsoleInterceptor } from "./console-interceptor/console-interceptor";

class Timer {
  constructor(
    protected register: FakeTimerRegistry,
    protected id: number,
    protected callback: (...args: any[]) => any,
    protected targetTime: number,
    protected defaultArgs: any[]
  ) {}

  changeTargetTime(targetTime: number) {
    this.targetTime = targetTime;
  }

  getTargetTime() {
    return this.targetTime;
  }

  is(id: number) {
    return this.id === id;
  }

  getID() {
    return this.id;
  }

  run(args?: any[]) {
    return this.callback(...(args ?? this.defaultArgs));
  }

  valueOf() {
    return this.targetTime;
  }
}

class Interval extends Timer {
  constructor(
    register: FakeTimerRegistry,
    id: number,
    callback: (...args: any[]) => any,
    protected ms: number,
    defaultArgs: any[]
  ) {
    super(register, id, callback, register.now() + ms, defaultArgs);
  }

  run(...args: any[]) {
    this.changeTargetTime(this.targetTime + this.ms);
    this.register["sortIntervals"]();
    return super.run(...args);
  }
}

const compareTimers = (a: Timer, b: Timer) => {
  return a > b ? 1 : -1;
};

const attempt = (fn: () => any) => {
  try {
    return fn();
  } catch (e) {
    //
  }
};

export class FakeTimerRegistry {
  private nextId = 1;
  private timers: Array<Timer> = [];
  private intervals: Array<Interval> = [];
  private currentFakeTime: null | number = null;
  private lastGivenMillisecond = 0;
  public isUsingFakeTime = false;

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
    this.timers.sort(compareTimers);
  }

  /** Sorts timer by the target time in descending order. */
  private sortIntervals() {
    this.intervals.sort(compareTimers);
  }

  private getNext() {
    const nextTimer = this.timers[0];
    const nextInterval = this.intervals[0];

    if (!nextTimer) {
      return {
        next: nextInterval,
        remove: () => {},
      };
    }

    if (!nextInterval) {
      return {
        next: nextTimer,
        remove: () => {
          this.timers.shift();
        },
      };
    }

    if (this.timers[0]! > this.intervals[0]!) {
      return {
        next: nextInterval,
        remove: () => {},
      };
    } else {
      return {
        next: nextTimer,
        remove: () => {
          this.timers.shift();
        },
      };
    }
  }

  public now() {
    if (this.currentFakeTime != null) {
      return this.currentFakeTime;
    } else {
      return this.getMillisecond();
    }
  }

  public enable() {
    this.currentFakeTime = this.getMillisecond();
    this.isUsingFakeTime = true;
  }

  public disable() {
    this.currentFakeTime = null;
    this.isUsingFakeTime = false;
  }

  public clear() {
    this.timers = [];
    this.intervals = [];
  }

  public count() {
    return this.timers.length + this.intervals.length;
  }

  public addTimeout(
    callback: (...args: any[]) => any,
    ms: number | undefined,
    args: any[]
  ) {
    const currentMillisecond = this.now();
    const targetTime = currentMillisecond + (ms ?? 0);

    const timer = new Timer(
      this,
      this.generateID(),
      callback,
      targetTime,
      args
    );
    this.timers.push(timer);
    this.sortTimers();
    return timer;
  }

  public cancelTimeout(id: number) {
    this.timers = this.timers.filter((t) => !t.is(id));
  }

  public addInterval(
    callback: (...args: any[]) => any,
    ms: number | undefined,
    args: any[]
  ) {
    const interval = new Interval(
      this,
      this.generateID(),
      callback,
      ms ?? 0,
      args
    );
    this.intervals.push(interval);
    this.sortIntervals();
    return interval;
  }

  public cancelInterval(id: number) {
    this.intervals = this.intervals.filter((t) => !t.is(id));
  }

  public runAll() {
    const toRun = this.timers.concat(this.intervals).sort(compareTimers);
    this.timers = [];

    for (const timer of toRun) {
      attempt(() => timer.run());
    }
  }

  public runNext(args?: any[]) {
    const timer = this.getNext();

    if (timer) {
      timer.remove();
      return timer.next?.run(args);
    }
  }

  public advanceBy(ms: number) {
    if (this.currentFakeTime === null) {
      return;
    }

    const currentMillisecond = this.currentFakeTime;
    const targetTime = currentMillisecond + ms;
    this.currentFakeTime = targetTime;

    while (true) {
      const timer = this.getNext();

      if (!timer.next || timer.next.getTargetTime() > targetTime) {
        break;
      }

      timer.remove();
      attempt(() => timer.next!.run());
    }
  }
}

export const initFakeTimers = (
  console: ConsoleInterceptor,
  setGlobalValues = true
) => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  const setupFakeTimers = (container: GestTimers) => {
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

        if (fakeTimerRegistry.isUsingFakeTime) {
          return fakeTimerRegistry.addTimeout(fn, ms, args).getID();
        } else {
          return originalSetTimeout(fn, ms, ...args);
        }
      },
      clearTimeout(id: number) {
        if (fakeTimerRegistry.isUsingFakeTime) {
          fakeTimerRegistry.cancelTimeout(id);
        } else {
          originalClearTimeout(id);
        }
      },
      setInterval(
        callback: (...args: any[]) => any,
        ms?: number,
        ...args: any[]
      ) {
        const error = new Error();

        const handleError = (err: any) => {
          console.error(
            "Exception raised in a interval callback:",
            err,
            "\nThe above error was raised in this 'setInterval':",
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

        if (fakeTimerRegistry.isUsingFakeTime) {
          return fakeTimerRegistry.addInterval(fn, ms, args).getID();
        } else {
          return originalSetInterval(fn, ms, ...args);
        }
      },
      clearInterval(id: number) {
        if (fakeTimerRegistry.isUsingFakeTime) {
          fakeTimerRegistry.cancelInterval(id);
        } else {
          originalClearInterval(id);
        }
      },
    });
  };

  if (setGlobalValues) {
    Object.defineProperty(globalThis, "__gest_setupFakeTimers", {
      value: setupFakeTimers,
    });

    Object.defineProperty(globalThis, "__gest_originalSetTimeout", {
      value: originalSetTimeout,
    });

    Object.defineProperty(globalThis, "__gest_originalClearTimeout", {
      value: originalClearTimeout,
    });

    Object.defineProperty(globalThis, "__gest_originalSetInterval", {
      value: originalSetInterval,
    });

    Object.defineProperty(globalThis, "__gest_originalClearInterval", {
      value: originalClearInterval,
    });
  }

  return setupFakeTimers;
};

declare global {
  const __gest_setupFakeTimers:
    | undefined
    | ((container: {
        setTimeout: typeof setTimeout;
        setInterval: typeof setInterval;
      }) => void);

  const __gest_originalSetTimeout: typeof setTimeout | undefined;
  const __gest_originalClearTimeout: typeof clearTimeout | undefined;
  const __gest_originalSetInterval: typeof setInterval | undefined;
  const __gest_originalClearInterval: typeof clearInterval | undefined;
}
