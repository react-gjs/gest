import type { ExpectError } from "../../user-land";
import type { SourceMapReader } from "../sourcemaps/reader";

export function _isExpectError(e: any): e is ExpectError {
  return e && typeof e === "object" && e.name === "ExpectError";
}

export function _getErrorMessage(e: unknown) {
  if (typeof e === "string") return e;
  if (typeof e === "object" && !!e && e instanceof Error)
    return `${e.name || "Error"}: ${e.message}`;
  return String(e);
}

export function _getErrorStack(
  e: unknown,
  sourceMap?: SourceMapReader,
  relativeTo?: string
) {
  if (typeof e === "object" && !!e && e instanceof Error) {
    const stack = e.stack;
    if (stack) {
      if (!sourceMap) return stack;

      const lines = stack.split("\n");
      const result: string[] = [];

      for (const line of lines) {
        if (!line.includes("bundled.js")) {
          result.push(line);
          continue;
        }

        const match = line.match(/(.*):(\d+):(\d+)$/);

        if (match) {
          const [, , line, column] = match;
          if (line != null && column != null) {
            const mapped = sourceMap.getOriginalPosition(
              Number(line),
              Number(column)
            );

            if (mapped && mapped.file) {
              result.push(
                `@file://${mapped.file}:${mapped.line}:${mapped.column}`
              );
              continue;
            }
          }
        }

        result.push(line);
      }

      return result.join("\n");
    }
  }
  return "";
}
