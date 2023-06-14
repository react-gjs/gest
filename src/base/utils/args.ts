export function _getArgValue(args: string[], ...argNames: string[]) {
  for (const argName of argNames) {
    const argIndex = args.indexOf(argName);
    if (argIndex === -1) {
      continue;
    }

    const argValue = args[argIndex + 1];
    if (argValue === undefined) {
      return "";
    }

    return argValue;
  }

  return undefined;
}
