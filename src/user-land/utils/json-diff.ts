import { CustomMatch } from "../matchers";
import { stringifyJson } from "./stringify-json";

const isObject = (value: any): value is object => {
  return typeof value === "object" && value !== null;
};

const areOfSameInstance = (a: object, b: object) => {
  return Object.getPrototypeOf(a) === Object.getPrototypeOf(b);
};

const diffSets = (a: Set<any>, b: Set<any>) => {
  const result: Record<string, any> = {
    _gest_meta: "Set",
  };
  let hasDiffs = false;

  const avalues = [...a.values()];

  let i = 0;
  for (const bval of b) {
    const aval = CustomMatch.isCustomMatch(bval)
      ? avalues.find((av) => bval.check(av))
      : avalues.find((av) => bval === av);

    if (aval) continue;

    Object.assign(result, {
      [`+${i}`]: bval,
      [`-${i}`]: undefined,
    });
    i++;
    hasDiffs = true;
  }

  return { result, hasDiffs };
};

const diffMaps = (a: Map<any, any>, b: Map<any, any>) => {
  const result: Record<string, any> = {
    _gest_meta: "Map",
  };
  let hasDiffs = false;

  for (const [bkey, bval] of b) {
    const aval = a.get(bkey);

    if (isObject(bval) && isObject(aval) && areOfSameInstance(aval, bval)) {
      const subDiff = diffObj(aval, bval);
      if (subDiff.hasDiffs) {
        Object.assign(result, { [bkey]: subDiff.result });
        hasDiffs = true;
      }
      continue;
    }

    if (CustomMatch.isCustomMatch(bval)) {
      if (bval.check(aval)) continue;
    }

    if (aval === bval) continue;

    Object.assign(result, {
      [`+${bkey}`]: bval,
      [`-${bkey}`]: aval,
    });
    hasDiffs = true;
  }

  return { result, hasDiffs };
};

const diffObj = (
  a: Record<string, any>,
  b: Record<string, any>
): { result: Record<string, any>; hasDiffs: boolean } => {
  if (a instanceof Set && b instanceof Set) return diffSets(a, b);
  if (a instanceof Map && b instanceof Map) return diffMaps(a, b);

  const result: Record<string, any> = {};
  let hasDiffs = false;

  if (Array.isArray(b)) {
    Object.assign(result, {
      _gest_meta: "Array",
    });
  }

  const bKeys = Object.keys(b);

  for (const bkey of bKeys) {
    const bval = b[bkey];
    const aval = a[bkey];

    if (isObject(bval) && isObject(aval) && areOfSameInstance(aval, bval)) {
      const subDiff = diffObj(aval, bval);
      if (subDiff.hasDiffs) {
        Object.assign(result, { [bkey]: subDiff.result });
        hasDiffs = true;
      }
      continue;
    }

    if (CustomMatch.isCustomMatch(bval)) {
      if (bval.check(aval)) continue;
    }

    if (aval === bval) continue;

    Object.assign(result, {
      [`+${bkey}`]: bval,
      [`-${bkey}`]: aval,
    });
    hasDiffs = true;
  }

  return { result, hasDiffs };
};

class Diff {
  constructor(private diffStruct: Record<string, any>) {}

  private getMeta(org: any): string | undefined {
    if (isObject(org)) {
      // @ts-ignore
      return org._gest_meta;
    }
  }

  stringify() {
    const red = "\x1b[31m";
    const green = "\x1b[32m";
    const reset = "\x1b[0m";

    return stringifyJson(this.diffStruct, (key, value, original) => {
      if (key === "_gest_meta") {
        return [null, null];
      }

      const meta = this.getMeta(original);
      const name = meta ? `${meta}` : "";

      if (typeof key === "string") {
        if (key.startsWith("-")) {
          return [red + key, name + value + reset];
        }
        if (key.startsWith("+")) {
          return [green + key, name + value + reset];
        }
      }

      return [key, name + value];
    });
  }
}

export const diff = (a: any, b: any) => {
  if (typeof a === "object" && typeof b === "object") {
    if (isObject(a) && isObject(b) && areOfSameInstance(a, b)) {
      const d = diffObj(a, b);
      return new Diff(d.hasDiffs ? d.result : {});
    } else {
      return new Diff({ "+$": b, "-$": a });
    }
  }

  return new Diff({});
};
