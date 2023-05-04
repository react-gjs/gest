import { isError } from "./errors/gest-error";

class UnknowError extends Error {
  constructor(public data: any) {
    super("unknown error", { cause: data });
    this.name = "UnknowError";
  }
}

export function _async<T = void>(
  callback: (promise: { resolve(v: T): void; reject(e: any): void }) => void
) {
  return new Promise<T>(async (resolve, _reject) => {
    const reject = (err: any) => {
      if (isError(err)) {
        _reject(err);
      } else {
        _reject(new UnknowError(err));
      }
    };

    try {
      await callback({ resolve, reject });
    } catch (err) {
      reject(err);
    }
  });
}
