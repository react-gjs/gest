export class GestError extends Error {
  static isGestError(err: any): err is GestError {
    return isError(err) && err.name === "GestError";
  }

  constructor(message: string) {
    super(message);
    this.name = "GestError";
  }
}

export function isError(err: unknown): err is Error {
  return typeof err === "object" && !!err && err instanceof Error;
}
