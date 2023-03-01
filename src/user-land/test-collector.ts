export type It = {
  name: string;
  line: number;
  column: number;
  callback: () => any;
};

export type TestHook = {
  callback: () => any;
  line: number;
  column: number;
};

export type Test = {
  name: string;
  line: number;
  column: number;
  beforeAll: Array<TestHook>;
  beforeEach: Array<TestHook>;
  afterEach: Array<TestHook>;
  afterAll: Array<TestHook>;
  subTests: Test[];
  its: Array<It>;
};

export class TestCollector {
  private static current: Test;

  static addBeforeAll(hook: TestHook) {
    TestCollector.current.beforeAll.push(hook);
  }

  static addBeforeEach(hook: TestHook) {
    TestCollector.current.beforeEach.push(hook);
  }

  static addAfterEach(hook: TestHook) {
    TestCollector.current.afterEach.push(hook);
  }

  static addAfterAll(hook: TestHook) {
    TestCollector.current.afterAll.push(hook);
  }

  static addIt(it: It) {
    TestCollector.current.its.push(it);
  }

  static collectSubTest(
    name: string,
    line: number,
    column: number,
    fn: () => void
  ) {
    const parentTest = TestCollector.current;

    const test = (TestCollector.current = {
      name,
      line,
      column,
      afterAll: [],
      afterEach: [],
      beforeAll: [],
      beforeEach: [],
      its: [],
      subTests: [],
    });

    fn();

    if (parentTest) {
      parentTest.subTests.push(TestCollector.current);
      TestCollector.current = parentTest;
    }

    return test;
  }
}
