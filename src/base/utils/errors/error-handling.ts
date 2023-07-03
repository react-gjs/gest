import type {
  DeferedTaskError,
  ExpectError,
  GestTestError,
} from "../../../user-land/utils/errors";
import type { SourceMapReader } from "../../sourcemaps/reader";
import type { ConfigFacade } from "../config";
import type { ParsedStack } from "../error-stack-parser-type";
import { parseErrorStack } from "./stack-parser";

export function _isGestTestError(e: any): e is GestTestError {
  return e && typeof e === "object" && "_isGestError" in e;
}

export function _isExpectError(e: any): e is ExpectError {
  return e && typeof e === "object" && e.name === "ExpectError";
}

export function _isDeferedError(e: any): e is DeferedTaskError {
  return e && typeof e === "object" && e.name === "DeferedTaskError";
}

export function _getErrorMessage(e: unknown) {
  if (typeof e === "string") return e;
  if (typeof e === "object" && !!e && e instanceof Error)
    return `${e.name || "Error"}: ${e.message}`;
  return String(e);
}

function stackToString(stack: ParsedStack) {
  const result: string[] = [];

  for (const stackItem of stack) {
    if (stackItem.filepath) {
      const link = stackItem.line
        ? `${stackItem.filepath}:${stackItem.line}:${stackItem.column ?? 0}`
        : stackItem.filepath;

      if (stackItem.symbolName) {
        result.push(`at ${stackItem.symbolName} (${link})`);
      } else {
        result.push(`at ${link}`);
      }
    } else {
      result.push("at " + stackItem.internal!);
    }
  }

  return result.join("\n");
}

export function _getErrorStack(
  e: unknown,
  sourceMap: SourceMapReader | undefined,
  config?: ConfigFacade
) {
  const parseStack = config?.errorStackParser ?? parseErrorStack;

  if (typeof e === "object" && !!e && e instanceof Error) {
    const stack = parseStack(e);
    if (stack.length > 0) {
      if (!sourceMap) return stackToString(stack);

      for (const stackItem of stack) {
        if (!stackItem.filepath?.includes("bundled.js")) {
          continue;
        }

        if (stackItem.line != null && stackItem.column != null) {
          const mapped = sourceMap.getOriginalPosition(
            Number(stackItem.line),
            Number(stackItem.column)
          );

          if (mapped && mapped.file) {
            stackItem.filepath = mapped.file;
            stackItem.line = mapped.line;
            stackItem.column = mapped.column;

            if (mapped.symbolName) {
              stackItem.symbolName = mapped.symbolName;
            }

            continue;
          }
        }
      }
    }
    return stackToString(stack);
  }
  return "<unable to generate a stack trace>";
}
