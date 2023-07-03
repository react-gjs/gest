import { afterEach, beforeAll, describe, it, Mock } from "@reactgjs/gest";
import { expect } from "gest";
import { FakeTimerRegistry, initFakeTimers } from "../../src/base/utils/timers";

const noop = (...args: any[]) => {};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default describe("FakeTimers", () => {
  const timers = {
    setTimeout: noop as any as typeof setTimeout,
    clearTimeout: noop as any as typeof clearTimeout,
    setInterval: noop as any as typeof setInterval,
    clearInterval: noop as any as typeof clearInterval,
    timeoutRegistry: null as FakeTimerRegistry | null,
  };

  class FakeTimersTest {
    static enable() {
      timers.timeoutRegistry?.enable();
    }

    static disable() {
      timers.timeoutRegistry?.clear();
      timers.timeoutRegistry?.disable();
    }

    static runAll() {
      timers.timeoutRegistry?.runAll();
    }

    static runNext(args?: any[]): any {
      return timers.timeoutRegistry?.runNext(args);
    }

    static advance(ms: number) {
      timers.timeoutRegistry?.advanceBy(ms);
    }

    static isTimeoutStarted(times?: number) {
      const c = timers.timeoutRegistry?.count() ?? 0;

      if (times != null) {
        return c === times;
      } else {
        return c > 0;
      }
    }
  }

  beforeAll(() => {
    const setup = initFakeTimers(console as any, false);
    setup(timers);
    FakeTimersTest.enable();
  });

  afterEach(() => {
    timers.timeoutRegistry?.clear();
  });

  describe("setTimeout", () => {
    describe("with a single timeout", () => {
      it("should not execute", async () => {
        const mock = Mock.create(() => {});

        timers.setTimeout(mock.fn, 100);

        await sleep(500);

        expect(mock).not.toHaveBeenCalled();
      });

      it("should execute after runNext", () => {
        const mock = Mock.create(() => {});

        timers.setTimeout(mock.fn, 100);

        FakeTimersTest.runNext();

        expect(mock).toHaveBeenCalled(1);
      });

      it("should execute after runAll", async () => {
        const mock = Mock.create(() => {});

        timers.setTimeout(mock.fn, 100);

        FakeTimersTest.runAll();

        expect(mock).toHaveBeenCalled(1);
      });

      it("should execute after advance", async () => {
        const mock = Mock.create(() => {});

        timers.setTimeout(mock.fn, 100);

        FakeTimersTest.advance(25);

        expect(mock).not.toHaveBeenCalled();

        FakeTimersTest.advance(50);

        expect(mock).not.toHaveBeenCalled();

        FakeTimersTest.advance(24);

        expect(mock).not.toHaveBeenCalled();

        FakeTimersTest.advance(1);

        expect(mock).toHaveBeenCalled(1);
      });
    });

    describe("with multiple timeouts", () => {
      it("should respect the ms values", async () => {
        const mock1 = Mock.create(() => {});
        const mock2 = Mock.create(() => {});
        const mock3 = Mock.create(() => {});

        timers.setTimeout(mock1.fn, 100);
        timers.setTimeout(mock2.fn, 200);
        timers.setTimeout(mock3.fn, 300);

        FakeTimersTest.advance(150);

        expect(mock1).toHaveBeenCalled(1);
        expect(mock2).not.toHaveBeenCalled();
        expect(mock3).not.toHaveBeenCalled();

        FakeTimersTest.advance(100);

        expect(mock1).toHaveBeenCalled(1);
        expect(mock2).toHaveBeenCalled(1);
        expect(mock3).not.toHaveBeenCalled();

        FakeTimersTest.advance(100);

        expect(mock1).toHaveBeenCalled(1);
        expect(mock2).toHaveBeenCalled(1);
        expect(mock3).toHaveBeenCalled(1);
      });

      it("should execute in the correct order", async () => {
        const mock1 = Mock.create(() => {});
        const mock2 = Mock.create(() => {});
        const mock3 = Mock.create(() => {});
        const mock4 = Mock.create(() => {});

        timers.setTimeout(mock1.fn, 100);
        timers.setTimeout(mock2.fn, 50);
        timers.setTimeout(mock3.fn, 20);
        timers.setTimeout(mock4.fn, 70);

        FakeTimersTest.advance(25);

        expect(mock1).not.toHaveBeenCalled();
        expect(mock2).not.toHaveBeenCalled();
        expect(mock3).toHaveBeenCalled(1);
        expect(mock4).not.toHaveBeenCalled();

        FakeTimersTest.advance(25);

        expect(mock1).not.toHaveBeenCalled();
        expect(mock2).toHaveBeenCalled(1);
        expect(mock3).toHaveBeenCalled(1);
        expect(mock4).not.toHaveBeenCalled();

        FakeTimersTest.advance(25);

        expect(mock1).not.toHaveBeenCalled();
        expect(mock2).toHaveBeenCalled(1);
        expect(mock3).toHaveBeenCalled(1);
        expect(mock4).toHaveBeenCalled(1);

        FakeTimersTest.advance(25);

        expect(mock1).toHaveBeenCalled(1);
        expect(mock2).toHaveBeenCalled(1);
        expect(mock3).toHaveBeenCalled(1);
        expect(mock4).toHaveBeenCalled(1);
      });

      it("should execute in the correct order when many are ran at once", () => {
        const order: number[] = [];

        const mock1 = Mock.create(() => {
          order.push(1);
        });
        const mock2 = Mock.create(() => {
          order.push(2);
        });
        const mock3 = Mock.create(() => {
          order.push(3);
        });
        const mock4 = Mock.create(() => {
          order.push(4);
        });

        timers.setTimeout(mock1.fn, 100);
        timers.setTimeout(mock2.fn, 50);
        timers.setTimeout(mock3.fn, 20);
        timers.setTimeout(mock4.fn, 70);

        FakeTimersTest.advance(100);

        expect(order).toEqual([3, 2, 4, 1]);
      });
    });
  });

  describe("clearTimeout", () => {
    it("should clear the timeout", async () => {
      const mock = Mock.create(() => {});

      const id = timers.setTimeout(mock.fn, 100);

      timers.clearTimeout(id);

      FakeTimersTest.advance(100);

      expect(mock).not.toHaveBeenCalled();
    });

    it("should clear the timeout when multiple are set", async () => {
      const mock1 = Mock.create(() => {});
      const mock2 = Mock.create(() => {});
      const mock3 = Mock.create(() => {});

      timers.setTimeout(mock1.fn, 100);
      const id2 = timers.setTimeout(mock2.fn, 200);
      timers.setTimeout(mock3.fn, 300);

      timers.clearTimeout(id2);

      FakeTimersTest.advance(1000);

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).not.toHaveBeenCalled();
      expect(mock3).toHaveBeenCalled(1);
    });
  });

  describe("setInterval", () => {
    it("should not execute", async () => {
      const mock = Mock.create(() => {});

      timers.setInterval(mock.fn, 100);

      await sleep(500);

      expect(mock).not.toHaveBeenCalled();
    });

    it("should execute after each runNext", () => {
      const mock = Mock.create(() => {});

      timers.setInterval(mock.fn, 100);

      FakeTimersTest.runNext();
      expect(mock).toHaveBeenCalled(1);

      FakeTimersTest.runNext();
      expect(mock).toHaveBeenCalled(2);

      FakeTimersTest.runNext();
      expect(mock).toHaveBeenCalled(3);
    });

    it("should execute after each runAll", async () => {
      const mock = Mock.create(() => {});

      timers.setInterval(mock.fn, 100);

      FakeTimersTest.runAll();
      expect(mock).toHaveBeenCalled(1);

      FakeTimersTest.runAll();
      expect(mock).toHaveBeenCalled(2);

      FakeTimersTest.runAll();
      expect(mock).toHaveBeenCalled(3);
    });

    it("should execute after each fitting advance", async () => {
      const mock = Mock.create(() => {});

      timers.setInterval(mock.fn, 100);

      FakeTimersTest.advance(25);
      expect(mock).not.toHaveBeenCalled();

      FakeTimersTest.advance(50);
      expect(mock).not.toHaveBeenCalled();

      FakeTimersTest.advance(24);
      expect(mock).not.toHaveBeenCalled();

      FakeTimersTest.advance(1);
      expect(mock).toHaveBeenCalled(1);

      FakeTimersTest.advance(25);
      expect(mock).toHaveBeenCalled(1);

      FakeTimersTest.advance(75);
      expect(mock).toHaveBeenCalled(2);

      FakeTimersTest.advance(100);
      expect(mock).toHaveBeenCalled(3);
    });

    it("should execute the interval multiple times when advancing by a large amount", async () => {
      const mock = Mock.create(() => {});

      timers.setInterval(mock.fn, 100);

      FakeTimersTest.advance(1000);

      expect(mock).toHaveBeenCalled(10);
    });
  });

  describe("clearInterval", () => {
    it("should clear the interval", async () => {
      const mock = Mock.create(() => {});

      const id = timers.setInterval(mock.fn, 100);

      timers.clearInterval(id);

      FakeTimersTest.advance(100);

      expect(mock).not.toHaveBeenCalled();
    });

    it("should clear the interval when multiple are set", async () => {
      const mock1 = Mock.create(() => {});
      const mock2 = Mock.create(() => {});
      const mock3 = Mock.create(() => {});

      timers.setInterval(mock1.fn, 100);
      const id2 = timers.setInterval(mock2.fn, 200);
      timers.setInterval(mock3.fn, 300);

      timers.clearInterval(id2);

      FakeTimersTest.advance(1000);

      expect(mock1).toHaveBeenCalled(10);
      expect(mock2).not.toHaveBeenCalled();
      expect(mock3).toHaveBeenCalled(3);
    });
  });

  describe("mixing many different scenarios", () => {
    it("should work correctly when advancing one by one", () => {
      const mock1 = Mock.create(() => {});
      const mock2 = Mock.create(() => {});
      const mock3 = Mock.create(() => {});
      const mock4 = Mock.create(() => {});
      const mock5 = Mock.create(() => {});
      const mock6 = Mock.create(() => {});
      const mock7 = Mock.create(() => {});
      const mock8 = Mock.create(() => {});

      timers.setTimeout(mock1.fn, 100);
      timers.setInterval(mock2.fn, 100);
      const t3id = timers.setTimeout(mock3.fn, 200);
      const t4id = timers.setInterval(mock4.fn, 200);
      timers.setTimeout(mock5.fn, 300);
      timers.setInterval(mock6.fn, 350);
      timers.setTimeout(mock7.fn, 400);
      timers.setInterval(mock8.fn, 500);

      FakeTimersTest.advance(99);

      expect(mock1).not.toHaveBeenCalled();
      expect(mock2).not.toHaveBeenCalled();
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).not.toHaveBeenCalled();
      expect(mock6).not.toHaveBeenCalled();
      expect(mock7).not.toHaveBeenCalled();
      expect(mock8).not.toHaveBeenCalled();

      FakeTimersTest.advance(51); // 151

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(1);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).not.toHaveBeenCalled();
      expect(mock6).not.toHaveBeenCalled();
      expect(mock7).not.toHaveBeenCalled();
      expect(mock8).not.toHaveBeenCalled();

      timers.clearTimeout(t3id);
      timers.clearInterval(t4id);

      FakeTimersTest.advance(100); // 251

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(2);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).not.toHaveBeenCalled();
      expect(mock6).not.toHaveBeenCalled();
      expect(mock7).not.toHaveBeenCalled();
      expect(mock8).not.toHaveBeenCalled();

      FakeTimersTest.advance(50); // 301

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(3);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).not.toHaveBeenCalled();
      expect(mock7).not.toHaveBeenCalled();
      expect(mock8).not.toHaveBeenCalled();

      FakeTimersTest.advance(50); // 350

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(3);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).toHaveBeenCalled(1);
      expect(mock7).not.toHaveBeenCalled();
      expect(mock8).not.toHaveBeenCalled();

      FakeTimersTest.advance(50); // 400

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(4);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).toHaveBeenCalled(1);
      expect(mock7).toHaveBeenCalled(1);
      expect(mock8).not.toHaveBeenCalled();

      FakeTimersTest.advance(150); // 550

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(5);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).toHaveBeenCalled(1);
      expect(mock7).toHaveBeenCalled(1);
      expect(mock8).toHaveBeenCalled(1);

      FakeTimersTest.advance(150); // 700

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(7);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).toHaveBeenCalled(2);
      expect(mock7).toHaveBeenCalled(1);
      expect(mock8).toHaveBeenCalled(1);

      FakeTimersTest.advance(300); // 1000

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(10);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).toHaveBeenCalled(2);
      expect(mock7).toHaveBeenCalled(1);
      expect(mock8).toHaveBeenCalled(2);
    });

    it("should work correctly when advancing by a large amount", () => {
      const order: number[] = [];

      const mock1 = Mock.create(() => order.push(1));
      const mock2 = Mock.create(() => order.push(2));
      const mock3 = Mock.create(() => order.push(3));
      const mock4 = Mock.create(() => order.push(4));
      const mock5 = Mock.create(() => order.push(5));
      const mock6 = Mock.create(() => order.push(6));
      const mock7 = Mock.create(() => order.push(7));
      const mock8 = Mock.create(() => order.push(8));

      timers.setTimeout(mock1.fn, 100);
      timers.setInterval(mock2.fn, 100);
      const t3id = timers.setTimeout(mock3.fn, 200);
      const t4id = timers.setInterval(mock4.fn, 200);
      timers.setTimeout(mock5.fn, 300);
      timers.setInterval(mock6.fn, 350);
      timers.setTimeout(mock7.fn, 400);
      timers.setInterval(mock8.fn, 500);

      timers.clearTimeout(t3id);
      timers.clearInterval(t4id);

      FakeTimersTest.advance(700);

      expect(mock1).toHaveBeenCalled(1);
      expect(mock2).toHaveBeenCalled(7);
      expect(mock3).not.toHaveBeenCalled();
      expect(mock4).not.toHaveBeenCalled();
      expect(mock5).toHaveBeenCalled(1);
      expect(mock6).toHaveBeenCalled(2);
      expect(mock7).toHaveBeenCalled(1);
      expect(mock8).toHaveBeenCalled(1);

      expect(order).toEqual([1, 2, 2, 5, 2, 6, 7, 2, 2, 8, 2, 2, 6]);
    });
  });
});
