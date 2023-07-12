export type InternalTestContext = {
  fullTitle: string;
  reportError: (err: any) => void;
};

export type Test = {
  name: string;
  line: number;
  column: number;
  skip?: boolean;
  callback: (info: InternalTestContext) => any;
};

export type TestHook = {
  callback: () => any;
  line: number;
  column: number;
};

export type Describe = {
  name: string;
  line: number;
  column: number;
  beforeAll: Array<TestHook>;
  beforeEach: Array<TestHook>;
  afterEach: Array<TestHook>;
  afterAll: Array<TestHook>;
  children: Describe[];
  tests: Array<Test>;
};

export class TestCollector {
  private static current: Describe;

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

  static addIt(test: Test) {
    TestCollector.current.tests.push(test);
  }

  static collectDescribes(
    name: string,
    line: number,
    column: number,
    fn: () => void,
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
      tests: [],
      children: [],
    });

    const r = fn();

    if (r != null && (r as any) instanceof Promise) {
      throw new Error("`describe` cannot be asynchronous");
    }

    if (parentTest) {
      parentTest.children.push(TestCollector.current);
      TestCollector.current = parentTest;
    }

    return test;
  }
}
