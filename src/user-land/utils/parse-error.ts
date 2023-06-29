import type { FileLocation } from "./errors";

export const _toNumber = (value: string | number | undefined, def: number) => {
  if (value === undefined) {
    return def;
  }

  try {
    const n = Number(value);
    if (isNaN(n)) {
      return def;
    }
    return n;
  } catch (e) {
    return def;
  }
};

export const _getLineFromError = (error: Error): FileLocation => {
  const stack = error.stack;
  const secondLine = stack?.split("\n")[1];
  const [line, column] = secondLine?.split(":").splice(-2) ?? [];
  return {
    line: _toNumber(line, 0),
    column: _toNumber(column, 0),
  };
};
