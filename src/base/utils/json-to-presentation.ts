export const jsonToPresentation = (
  value: any,
  maxDepth: number,
  currentDepth = 0
) => {
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
      return String(value);
    case "function":
      return value.name ? `[Function: ${value.name}]` : "[Function]";
    case "object": {
      if (value === null) {
        return "null";
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return "[]";
        }

        if (nextDepth >= maxDepth) {
          return "[...]";
        }

        result += "[\n";

        for (let i = 0; i < value.length; i++) {
          result += `${currentIndent}  ${jsonToPresentation(
            value[i],
            maxDepth,
            nextDepth
          )},\n`;
        }

        result += `${currentIndent}]`;
      } else if (value instanceof Map) {
        if (value.size === 0) {
          return "Map[]";
        }

        if (nextDepth >= maxDepth) {
          return "Map[...]";
        }

        result += "Map[\n";

        for (const [key, elem] of value) {
          result += `${currentIndent}  ${jsonToPresentation(
            key,
            maxDepth,
            nextDepth
          )}: ${jsonToPresentation(elem, maxDepth, nextDepth)},\n`;
        }

        result += `${currentIndent}]`;

        return result;
      } else if (value instanceof Set) {
        if (value.size === 0) {
          return "Set[]";
        }

        if (nextDepth >= maxDepth) {
          return "Set[...]";
        }

        result += "Set[\n";

        for (const elem of value) {
          result += `${currentIndent}  ${jsonToPresentation(
            elem,
            maxDepth,
            nextDepth
          )},\n`;
        }

        result += `${currentIndent}]`;

        return result;
      } else if (value instanceof Date) {
        return `Date[${value.toISOString()}]`;
      } else if (value instanceof RegExp) {
        return `RegExp[${value.toString()}]`;
      } else if (value instanceof Error) {
        return `Error[${value.toString()}]`;
      } else {
        const keys = Object.keys(value);

        if (keys.length === 0) {
          return "{}";
        }

        if (nextDepth >= maxDepth) {
          return "{...}";
        }

        result += "{\n";

        for (const key of keys) {
          result += `${currentIndent}  ${key}: ${jsonToPresentation(
            value[key],
            maxDepth,
            nextDepth
          )},\n`;
        }

        result += `${currentIndent}}`;
      }
    }
  }

  return result;
};
