/**
 * Contents of this file will be injected into each transformed
 * test file. Hence every variable defined here will be globally
 * available within the scope of the test file bundle.
 */

import type { FakeTimerRegistry } from "../utils/timers";

const __noop = (...args: any[]) => {};

const __gest_timers = {
  setTimeout: __noop as any as typeof setTimeout,
  setInterval: __noop as any as typeof setInterval,
  useFakeTimers: false,
  timeoutRegistry: null as FakeTimerRegistry | null,
  intervalRegistry: null as FakeTimerRegistry | null,
};

(() => {
  const global = globalThis;

  __gest_timers.setTimeout =
    typeof __gest_originalSetTimeout !== "undefined"
      ? __gest_originalSetTimeout
      : global.setTimeout.bind(null);

  __gest_timers.setInterval =
    typeof __gest_originalSetInterval !== "undefined"
      ? __gest_originalSetInterval
      : global.setInterval.bind(null);
})();

if (typeof __gest_getSetTimeout !== "undefined") {
  __gest_getSetTimeout(__gest_timers);
}

if (typeof __gest_getSetInterval !== "undefined") {
  __gest_getSetInterval(__gest_timers);
}

class FakeTimers {
  static get originalSetTimeout() {
    const global = globalThis;
    return (
      typeof __gest_originalSetTimeout !== "undefined"
        ? __gest_originalSetTimeout
        : global.setTimeout
    ).bind(null);
  }

  static enable() {
    __gest_timers.useFakeTimers = true;
  }

  static disable() {
    __gest_timers.useFakeTimers = false;
    __gest_timers.timeoutRegistry?.clear();
  }

  static runAll() {
    __gest_timers.timeoutRegistry?.runAll();
  }

  static runNext(args?: any[]): any {
    return __gest_timers.timeoutRegistry?.runNext(args);
  }

  /**
   * Check if any timeout is currently waiting to be started.
   * Optionally check if a specific number of timeouts are
   * waiting.
   */
  static isTimeoutStarted(times?: number) {
    const c = __gest_timers.timeoutRegistry?.count() ?? 0;

    if (times != null) {
      return c === times;
    } else {
      return c > 0;
    }
  }
}

// prevent bundler from removing unused variables
__noop(FakeTimers);

export type { FakeTimers };
export type GestTimers = typeof __gest_timers;
