/**
 * Contents of this file will be injected into each transformed
 * test file. Hence every variable defined here will be globally
 * available within the scope of the test file bundle.
 */

import type { FakeTimerRegistry } from "../utils/timers";

const __noop = (...args: any[]) => {};

const __gest_timers = {
  setTimeout: __noop as any as typeof setTimeout,
  clearTimeout: __noop as any as typeof clearTimeout,
  setInterval: __noop as any as typeof setInterval,
  clearInterval: __noop as any as typeof clearInterval,
  timeoutRegistry: null as FakeTimerRegistry | null,
};

(() => {
  const global = globalThis;

  __gest_timers.setTimeout =
    typeof __gest_originalSetTimeout !== "undefined"
      ? __gest_originalSetTimeout
      : global.setTimeout.bind(null);

  __gest_timers.clearTimeout =
    typeof __gest_originalClearTimeout !== "undefined"
      ? __gest_originalClearTimeout
      : global.clearTimeout.bind(null);

  __gest_timers.setInterval =
    typeof __gest_originalSetInterval !== "undefined"
      ? __gest_originalSetInterval
      : global.setInterval.bind(null);

  __gest_timers.clearInterval =
    typeof __gest_originalClearInterval !== "undefined"
      ? __gest_originalClearInterval
      : global.clearInterval.bind(null);
})();

if (typeof __gest_setupFakeTimers !== "undefined") {
  __gest_setupFakeTimers(__gest_timers);
}

class FakeTimers {
  /**
   * Returns the original setTimeout function. Fake timers will
   * not affect this function.
   */
  static get originalSetTimeout() {
    const global = globalThis;
    return (
      typeof __gest_originalSetTimeout !== "undefined"
        ? __gest_originalSetTimeout
        : global.setTimeout
    ).bind(null);
  }

  /**
   * Returns the original clearTimeout function. Fake timers will
   * not affect this function.
   */
  static get originalClearTimeout() {
    const global = globalThis;
    return (
      typeof __gest_originalClearTimeout !== "undefined"
        ? __gest_originalClearTimeout
        : global.clearTimeout
    ).bind(null);
  }

  /**
   * Returns the original setInterval function. Fake timers will
   * not affect this function.
   */
  static get originalSetInterval() {
    const global = globalThis;
    return (
      typeof __gest_originalSetInterval !== "undefined"
        ? __gest_originalSetInterval
        : global.setInterval
    ).bind(null);
  }

  /**
   * Returns the original clearInterval function. Fake timers
   * will not affect this function.
   */
  static get originalClearInterval() {
    const global = globalThis;
    return (
      typeof __gest_originalClearInterval !== "undefined"
        ? __gest_originalClearInterval
        : global.clearInterval
    ).bind(null);
  }

  /**
   * Enables fake timers. After this method is called, all calls
   * to the global setTimeout, clearTimeout, setInterval,
   * clearInterval will be intercepted by the fake timers.
   */
  static enable() {
    __gest_timers.timeoutRegistry?.enable();
  }

  /**
   * Disables fake timers. After this method is called, all calls
   * to the global setTimeout, clearTimeout, setInterval,
   * clearInterval will be passed through to the original
   * functions.
   */
  static disable() {
    __gest_timers.timeoutRegistry?.clear();
    __gest_timers.timeoutRegistry?.disable();
  }

  /** Run all pending timeouts and intervals. */
  static runAll() {
    __gest_timers.timeoutRegistry?.runAll();
  }

  /**
   * Run the next pending timeout or interval. Optionally pass
   * arguments to the callback function.
   */
  static runNext(args?: any[]): any {
    return __gest_timers.timeoutRegistry?.runNext(args);
  }

  /**
   * Advance the fake timers by the specified number of
   * milliseconds.
   */
  static advance(ms: number) {
    __gest_timers.timeoutRegistry?.advanceBy(ms);
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
