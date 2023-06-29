import { _getLineFromError } from "./parse-error";

export type FileLocation = {
  line: number;
  column: number;
};

export class GestTestError extends Error {
  static from(err: unknown, location?: FileLocation) {
    let msg = "Unknown error";
    let stack: string | undefined = undefined;

    if (err instanceof Error) {
      msg = err.message;
      stack = err.stack;
    }

    const gestError = new GestTestError(msg, location);

    if (stack) {
      gestError.stack = stack;
    }

    return gestError;
  }

  public _isGestError = true;
  public line: number;
  public column: number;

  constructor(message: string, location?: FileLocation) {
    super(message);
    this.name = "GestError";

    if (location) {
      this.line = location.line;
      this.column = location.column;
    } else {
      const { column, line } = _getLineFromError(this);
      this.line = line;
      this.column = column;
    }
  }
}

export class ExpectError extends GestTestError {
  private timeoutId?: NodeJS.Timeout;

  constructor(
    message: string,
    public readonly expected: string | undefined,
    public readonly received: string | undefined,
    public readonly diff: string | undefined,
    location: FileLocation
  ) {
    super(message, location);
    this.name = "ExpectError";
    this.detectUnhandled();
  }

  private detectUnhandled() {
    this.timeoutId = FakeTimers.originalSetTimeout(() => {
      // TODO: communicate with the monitor
      console.error(
        `An expect error was not handled. This is most likely due to an async matcher not being awaited.\n\nError: ${this.message}`
      );
    }, 100);
  }

  handle() {
    clearTimeout(this.timeoutId);
  }
}

type DeferredErrorInfo = {
  line: number;
  column: number;
  thrown: any;
};

export class DeferedTaskError extends GestTestError {
  constructor(public errors: DeferredErrorInfo[]) {
    super("Deferred task(s) has failed.");
    this.name = "DeferedTaskError";
  }
}
