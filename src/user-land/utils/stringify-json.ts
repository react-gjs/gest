type JsonStrigifyMiddleware = (
  key: string | number,
  parsedValue: string,
  originalValue: any
) => [string | number, string] | [null, null];

export function stringifyJson(
  value: any,
  middleware: JsonStrigifyMiddleware = (key, value) => [key, value],
  currentDepth = 0
) {
  const nextDepth = currentDepth + 1;

  let result = "";
  const currentIndent = Array.from({ length: currentDepth }, () => "  ").join(
    ""
  );

  switch (typeof value) {
    case "string":
      return `"${value}"`;
    case "number":
    case "boolean":
    case "undefined":
    case "bigint":
    case "symbol":
      return JSON.stringify(value);
    case "function":
      return "Function";
    case "object": {
      if (value === null) {
        return "null";
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          return "[]";
        }

        result += "[\n";

        for (let i = 0; i < value.length; i++) {
          const parsedContent = stringifyJson(value[i], middleware, nextDepth);

          const [, content] = middleware(i.toString(), parsedContent, value[i]);
          if (content === null) {
            continue;
          }
          result += `${currentIndent}  ${content},\n`;
        }

        result += `${currentIndent}]`;
      } else if (value instanceof Map) {
        if (value.size === 0) {
          return "Map{}";
        }

        result += "Map{\n";

        for (const [key, elem] of value) {
          const parsedKey = stringifyJson(key, middleware, nextDepth);
          const parsedContent = stringifyJson(elem, middleware, nextDepth);

          const [fk, fc] = middleware(parsedKey, parsedContent, elem);

          if (fk === null) {
            continue;
          }

          result += `${currentIndent}  ${fk}: ${fc},\n`;
        }

        result += `${currentIndent}}`;

        return result;
      } else if (value instanceof Set) {
        if (value.size === 0) {
          return "Set{}";
        }

        result += "Set{\n";

        for (const elem of value) {
          const parsedContent = stringifyJson(elem, middleware, nextDepth);

          const [, content] = middleware("", parsedContent, elem);

          if (content === null) {
            continue;
          }

          result += `${currentIndent}  ${content},\n`;
        }

        result += `${currentIndent}}`;

        return result;
      } else if (value instanceof Date) {
        return `Date{${value.toISOString()}}`;
      } else if (value instanceof RegExp) {
        return `RegExp{${value.toString()}}`;
      } else if (value instanceof Error) {
        return `Error{${value.toString()}}`;
      } else {
        const keys = Object.keys(value);

        if (keys.length === 0) {
          return "{}";
        }

        result += "{\n";

        for (const key of keys) {
          const parsedContent = stringifyJson(
            value[key],
            middleware,
            nextDepth
          );

          const [fk, fc] = middleware(key, parsedContent, value[key]);

          if (fk === null) {
            continue;
          }

          result += `${currentIndent}  ${fk}: ${fc},\n`;
        }

        result += `${currentIndent}}`;
      }
    }
  }

  return result;
}
