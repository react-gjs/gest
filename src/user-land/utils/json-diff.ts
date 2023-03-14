import { CustomMatcher, deepEqual, matchValues } from "../matchers";
import { stringifyJson } from "./stringify-json";

const isObject = (value: any): value is object => {
  return typeof value === "object" && value !== null;
};

const areOfSameInstance = (a: object, b: object) => {
  return Object.getPrototypeOf(a) === Object.getPrototypeOf(b);
};

const diffSets = (a: Set<any>, b: Set<any>, mode: "equal" | "match") => {
  const result: Record<string, any> = {
    _gest_meta: "Set",
  };
  let hasDiffs = false;

  const avalues = [...a.values()];

  const popMatching = (bval: any) => {
    if (CustomMatcher.isCustomMatch(bval)) {
      const index = avalues.findIndex((av) => bval.check(av));
      if (index === -1) return;
      const elem = avalues[index];
      avalues.splice(index, 1);
      return elem;
    } else if (mode === "equal") {
      const index = avalues.findIndex((av) => deepEqual(av, bval));
      if (index === -1) return;
      const elem = avalues[index];
      avalues.splice(index, 1);
      return elem;
    } else {
      const index = avalues.findIndex((av) => matchValues(av, bval));
      if (index === -1) return;
      const elem = avalues[index];
      avalues.splice(index, 1);
      return elem;
    }
  };

  let i = 0;
  for (const bval of b) {
    const aval = popMatching(bval);

    if (aval) continue;

    Object.assign(result, {
      [`+${i}`]: bval,
      [`-${i}`]: undefined,
    });
    i++;
    hasDiffs = true;
  }

  if (mode === "equal") {
    for (const aval of avalues) {
      Object.assign(result, {
        [`+${i}`]: undefined,
        [`-${i}`]: aval,
      });
      i++;
      hasDiffs = true;
    }
  }

  return { result, hasDiffs };
};

const diffMaps = (
  a: Map<any, any>,
  b: Map<any, any>,
  mode: "equal" | "match"
) => {
  const result: Record<string, any> = {
    _gest_meta: "Map",
  };
  let hasDiffs = false;

  for (const [bkey, bval] of b) {
    const aval = a.get(bkey);

    if (isObject(bval) && isObject(aval) && areOfSameInstance(aval, bval)) {
      const subDiff = diffObj(aval, bval, mode);
      if (subDiff.hasDiffs) {
        Object.assign(result, { [bkey]: subDiff.result });
        hasDiffs = true;
      }
      continue;
    }

    if (CustomMatcher.isCustomMatch(bval)) {
      Object.assign(result, bval.diffAgainst(bkey, aval));
      hasDiffs = true;
      continue;
    }

    if (aval === bval) continue;

    Object.assign(result, {
      [`+${bkey}`]: bval,
      [`-${bkey}`]: aval,
    });
    hasDiffs = true;
  }

  const aKeys = [...a.keys()];

  for (const akey of aKeys) {
    if (b.has(akey)) continue;

    Object.assign(result, {
      [`+${akey}`]: undefined,
      [`-${akey}`]: a.get(akey),
    });
    hasDiffs = true;
  }

  return { result, hasDiffs };
};

const diffObj = (
  a: Record<string, any>,
  b: Record<string, any>,
  mode: "equal" | "match"
): { result: Record<string, any>; hasDiffs: boolean } => {
  if (a instanceof Set && b instanceof Set) return diffSets(a, b, mode);
  if (a instanceof Map && b instanceof Map) return diffMaps(a, b, mode);

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
      const subDiff = diffObj(aval, bval, mode);
      if (subDiff.hasDiffs) {
        Object.assign(result, { [bkey]: subDiff.result });
        hasDiffs = true;
      }
      continue;
    }

    if (CustomMatcher.isCustomMatch(bval)) {
      Object.assign(result, bval.diffAgainst(bkey, aval));
      hasDiffs = true;
      continue;
    }

    if (aval === bval) continue;

    Object.assign(result, {
      [`+${bkey}`]: bval,
      [`-${bkey}`]: aval,
    });
    hasDiffs = true;
  }

  if (mode === "equal") {
    const aKeys = Object.keys(a);

    const missingKeys = aKeys.filter((akey) => !bKeys.includes(akey));

    for (const mkey of missingKeys) {
      Object.assign(result, {
        [`+${mkey}`]: undefined,
        [`-${mkey}`]: a[mkey],
      });
      hasDiffs = true;
    }
  }

  return { result, hasDiffs };
};

class Diff {
  constructor(public diffStruct: Record<string, any>) {}

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

    const topLevelMeta = this.getMeta(this.diffStruct);
    const topLevelName = topLevelMeta ? `${topLevelMeta}` : "";

    return (
      topLevelName +
      stringifyJson(this.diffStruct, (key, value, original) => {
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
      })
    );
  }
}

export const diff = (a: any, b: any, mode: "equal" | "match") => {
  if (typeof a === "object" && typeof b === "object") {
    if (isObject(a) && isObject(b) && areOfSameInstance(a, b)) {
      const d = diffObj(a, b, mode);
      return new Diff(d.hasDiffs ? d.result : {});
    }
  }

  if (mode === "equal" && deepEqual(a, b)) {
    return new Diff({});
  } else if (matchValues(a, b)) {
    return new Diff({});
  } else {
    return new Diff({ "+$": b, "-$": a });
  }
};
