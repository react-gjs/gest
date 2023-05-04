import type { ParsedStack } from "../error-stack-parser-type";

function toNumber(v: string | undefined, defaultValue: number | null) {
  const n = Number(v);
  return isNaN(n) ? defaultValue : n;
}

function parseSymbolName(sym?: string): string | undefined {
  if (!sym) return undefined;

  let [fname] = sym.split("/");

  fname = fname!.replace(/<+$/, "").replace(/^async\*/, "async ");

  return fname;
}

const stackLineRegex = /(.*?)@(.*?):(\d+):(\d+)/;

export function parseErrorStack(err: Error): ParsedStack {
  const lines = err.stack?.split("\n") ?? [];

  const parsedStack: ParsedStack = [];

  for (const line of lines) {
    const l = line.trim();
    if (l.length === 0) continue;

    const match = l.match(stackLineRegex);

    if (match) {
      const [, symbolName, filepath, lineNumber, columnNumber] = match;

      if (filepath?.startsWith("file://")) {
        parsedStack.push({
          filepath: filepath.slice(7),
          line: toNumber(lineNumber, null),
          column: toNumber(columnNumber, null),
          symbolName: parseSymbolName(symbolName),
        });
      } else {
        parsedStack.push({
          filepath: filepath!,
          line: toNumber(lineNumber, null),
          column: toNumber(columnNumber, null),
          symbolName: parseSymbolName(symbolName),
        });
      }
    } else {
      parsedStack.push({
        internal: l,
      });
    }
  }

  return parsedStack;
}
