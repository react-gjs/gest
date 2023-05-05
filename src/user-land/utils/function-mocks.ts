import { insertSort } from "./insert-sort";

type IsAny<T> = 0 extends 1 & T ? true : false;

export type Fn<A extends any[] = any[], R = any> = (...args: A) => R;
type Ret<F extends Fn> = F extends Fn<any[], infer R> ? R : never;

type CanBeAPromise<T> = Promise<any> extends T ? true : false;
type CanBeAValue<T> = IsAny<T> extends true
  ? true
  : Exclude<T, Promise<any>> extends never
  ? false
  : true;

type IfAsync<F extends Fn, V> = F extends Fn<any[], infer R>
  ? CanBeAPromise<R> extends true
    ? V
    : never
  : never;
type IfSync<F extends Fn, V> = F extends Fn<any[], infer R>
  ? CanBeAValue<R> extends true
    ? V
    : never
  : never;

type OmitPromises<T> = Exclude<T, Promise<any>>;
type OmitValues<T> = IsAny<T> extends true
  ? T
  : Exclude<T, Exclude<T, Promise<any>>>;

export class CallEntry {
  constructor(
    readonly id: number,
    /**
     * If the returned value was a promise, this will be true,
     * and false otherwise.
     */
    readonly isAsync: boolean,
    /** List of arguments that the mock function was invoked with. */
    readonly args: ReadonlyArray<any>,
    /**
     * The result of this mocked function call, if the function
     * returned a promise, this will be the resolved value of
     * that promise.
     */
    readonly result?: any,
    /**
     * If the function threw an error or the returned promise was
     * rejected, this will be the throw/rejected value. Or
     * `undefined` if the function call was successful.
     */
    readonly error?: any
  ) {}
}

const NIL = Symbol("NIL");
export class PendingCall<R> {
  private isCancelled = false;
  private onResolveCallbacks: Array<(v: R) => void> = [];
  private onRejectCallbacks: Array<(e: any) => void> = [];
  private result = {
    resolved: NIL as typeof NIL | R,
    rejected: NIL as any,
  };

  constructor(promise: Promise<R>) {
    promise.then(this.successHandler).catch(this.errorHandler);
  }

  private successHandler = (v: R) => {
    if (this.isCancelled) {
      return;
    }

    this.result.resolved = v;

    this.onResolveCallbacks.forEach((cb) => {
      try {
        cb(v);
      } catch (err) {
        console.error(err);
      }
    });
  };

  private errorHandler = (err: any) => {
    if (this.isCancelled) {
      return;
    }

    this.result.rejected = err;

    this.onRejectCallbacks.forEach((cb) => {
      try {
        cb(err);
      } catch (err) {
        console.error(err);
      }
    });
  };

  public cancel() {
    this.isCancelled = true;
  }

  public onResolve(cb: (v: R) => void) {
    if (this.result.resolved !== NIL) {
      cb(this.result.resolved);
      return;
    } else if (this.result.rejected !== NIL) {
      return;
    }

    this.onResolveCallbacks.push(cb);
  }

  public onReject(cb: (e: any) => void) {
    if (this.result.rejected !== NIL) {
      cb(this.result.rejected);
      return;
    } else if (this.result.resolved !== NIL) {
      return;
    }

    this.onRejectCallbacks.push(cb);
  }

  public onFinish(cb: () => void) {
    if (this.result.resolved !== NIL || this.result.rejected !== NIL) {
      cb();
      return;
    }

    this.onResolveCallbacks.push(cb);
    this.onRejectCallbacks.push(cb);
  }
}

export class FmTracker {
  private callCount = 0;
  private pendingCalls: PendingCall<any>[] = [];
  private calls: CallEntry[] = [];

  public clear() {
    this.pendingCalls.forEach((pc) => pc.cancel());

    this.callCount = 0;
    this.calls = [];
    this.pendingCalls = [];
  }

  public getPending() {
    return this.pendingCalls.slice();
  }

  public addPendingCall<R>(p: Promise<R>) {
    const pc = new PendingCall(p);
    this.pendingCalls.push(pc);
    pc.onFinish(() => this.removePendingCall(pc));
    return pc;
  }

  public removePendingCall(pc: PendingCall<any>) {
    this.pendingCalls.splice(this.pendingCalls.indexOf(pc), 1);
  }

  public addEntry(entry: CallEntry) {
    this.callCount++;
    insertSort(this.calls, entry, (a, b) => a.id - b.id);
  }

  public public() {
    const tracker = this;

    return {
      get pendingCalls() {
        return tracker.pendingCalls.length;
      },
      get callCount() {
        return tracker.callCount;
      },
      get calls() {
        return tracker.calls.slice();
      },
      get latestCall() {
        return tracker.calls[tracker.calls.length - 1];
      },
      get firstCall() {
        return tracker.calls[0];
      },
    };
  }
}

export class FunctionMock<F extends Fn> {
  private defaultImpl: F;
  private implHistory: Array<{ impl: F; once?: boolean }> = [];
  private callTracker = new FmTracker();

  private invoke!: F;

  constructor(private impl: F) {
    this.defaultImpl = impl;
    this.implHistory.push({ impl, once: false });
    FunctionMockRegistry.registerMock(this);

    let nextId = 0;
    const fm = this;
    this.invoke = function (this: any, ...args: any) {
      const id = nextId++;
      try {
        const result = fm.impl.apply(this, args);

        if (result != null && result instanceof Promise) {
          const pending = fm.callTracker.addPendingCall(result);

          pending.onResolve((r) => {
            fm.callTracker.addEntry(new CallEntry(id, true, args, r));
            return r;
          });

          pending.onReject((err) => {
            fm.callTracker.addEntry(
              new CallEntry(id, true, args, undefined, err)
            );
          });

          return result;
        }

        fm.callTracker.addEntry(new CallEntry(id, false, args, result));
        return result;
      } catch (err) {
        fm.callTracker.addEntry(new CallEntry(id, false, args, undefined, err));
        throw err;
      }
    } as any;
  }

  private removeSingleUseImplementations() {
    this.implHistory = this.implHistory.filter((e) => !e.once);
    this.impl = this.implHistory[this.implHistory.length - 1]!.impl;
  }

  public get tracker() {
    return this.callTracker.public();
  }

  public get fn(): F {
    return this.invoke as any;
  }

  /**
   * Returns a promise that resolves when all currently
   * unresolved calls to this mock resolve.
   */
  public waitForUnresolved() {
    return Promise.all(
      this.callTracker
        .getPending()
        .map(
          (pending) => new Promise<void>((resolve) => pending.onFinish(resolve))
        )
    );
  }

  /**
   * Discards the currently set implementation and restores the
   * one that was set before it.
   */
  public restorePreviousImplementation() {
    if (this.implHistory.length === 1) {
      return;
    }

    this.implHistory.pop();
    this.impl = this.implHistory[this.implHistory.length - 1]!.impl;
  }

  /** Replaces the mock implementation. */
  public setImplementation(impl: F) {
    this.removeSingleUseImplementations();
    this.impl = impl;
    this.implHistory.push({ impl, once: false });
  }

  /**
   * Replaces the implementation for a single time use, this
   * given implementation will be completely discarded once it's
   * invoked for the first time or if another implementation is
   * set.
   */
  public setImplementationOnce(impl: F) {
    const fm = this;
    const wrapper = function (this: any, ...args: any) {
      fm.removeSingleUseImplementations();
      return impl.apply(this, args);
    };
    this.impl = wrapper as any;
    this.implHistory.push({ impl, once: true });
  }

  /** Replaces the implementation to return with the given value. */
  public setReturn(value: IfSync<F, OmitPromises<Ret<F>>>) {
    this.setImplementation(function () {
      return value;
    } as any);
  }

  /** Replaces the implementation to throw with the given value. */
  public setThrow(exception: IfSync<F, any>) {
    this.setImplementation(function () {
      throw exception;
    } as any);
  }

  /** Replaces the implementation to resolve with the given value. */
  public setResolve(value: Awaited<OmitValues<Ret<F>>>) {
    this.setImplementation(async function () {
      return value;
    } as any);
  }

  /** Replaces the implementation to reject with the given value. */
  public setReject(exception: IfAsync<F, any>) {
    this.setImplementation(async function () {
      throw exception;
    } as any);
  }

  /**
   * Clears the mock and resets it's implementation to the
   * original one.
   */
  public reset() {
    this.clear();
    this.implHistory = [];

    this.setImplementation(this.defaultImpl);
  }

  /**
   * Clears the information's about this mock previous function
   * calls.
   */
  public clear() {
    this.callTracker.clear();
  }
}

interface FunctionMockRegistryPublicInterface {
  /**
   * Clears the information's about all existing Function Mock's
   * previous function calls.
   */
  clearAllMocks: () => void;
  /**
   * Clears all the existing Function Mock's and resets the
   * implementations to the original one.
   */
  resetAllMocks: () => void;
}

export class FunctionMockRegistry {
  private static allMocks: FunctionMock<Fn>[] = [];

  public static registerMock(mock: FunctionMock<Fn>) {
    FunctionMockRegistry.allMocks.push(mock);
  }

  public static clearAllMocks() {
    FunctionMockRegistry.allMocks.forEach((mock) => {
      mock.clear();
    });
  }

  public static resetAllMocks() {
    FunctionMockRegistry.allMocks.forEach((mock) => {
      mock.reset();
    });
  }

  public static public(): FunctionMockRegistryPublicInterface {
    return {
      clearAllMocks: FunctionMockRegistry.clearAllMocks,
      resetAllMocks: FunctionMockRegistry.resetAllMocks,
    };
  }
}

export const createMock = <F extends Fn = Fn<any[], any>>(fn?: F) => {
  return new FunctionMock<F>(fn ?? ((() => {}) as any));
};
