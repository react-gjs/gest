import type { ExpectError } from "../../user-land";
import type { SourceMap } from "../sourcemaps/reader";
import { SourceMapReader } from "../sourcemaps/reader";

export function _isExpectError(e: any): e is ExpectError {
  return e && typeof e === "object" && e.name === "ExpectError";
}

export function _getErrorMessage(e: unknown) {
  if (typeof e === "string") return e;
  if (typeof e === "object" && !!e && e instanceof Error) return e.message;
  return String(e);
}

export function _getErrorStack(e: unknown, sourceMap?: SourceMap) {
  if (typeof e === "object" && !!e && e instanceof Error) {
    const stack = e.stack;
    if (stack) {
      if (!sourceMap) return stack;

      const lines = stack.split("\n");
      const result: string[] = [];

      const sourceMapReader = new SourceMapReader(sourceMap);

      for (const line of lines) {
        if (!line.includes("bundled.js")) {
          result.push(line);
          continue;
        }

        const match = line.match(/(.*):(\d+):(\d+)$/);

        if (match) {
          const [, , line, column] = match;
          const mapped = sourceMapReader.getOriginalPosition(+line!, +column!);
          if (mapped) {
            result.push(`${mapped.file}:${mapped.line}:${mapped.column}`);
          } else {
            result.push(line!);
          }
        } else {
          result.push(line);
        }
      }

      return result.join("\n");
    }
  }
  return "";
}
