import { CustomMatcher } from "../matchers";

export type EqualityCheck = {
  isEqual: boolean;
  expected?: any;
  received?: any;
};

export function deepEqual(a: any, b: any): EqualityCheck {
  if (a === b) {
    return {
      isEqual: true,
    };
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return {
      isEqual: false,
      expected: b,
      received: a,
    };
  }

  if (a === null || b === null) {
    return {
      isEqual: false,
      expected: b,
      received: a,
    };
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const lastAIndex = a.length - 1;
    for (const bIndex of b.keys()) {
      if (bIndex > lastAIndex) {
        return {
          isEqual: false,
          expected: b[bIndex],
          received: undefined,
        };
      }

      const aItem = a[bIndex];
      const bItem = b[bIndex];

      const result = deepEqual(aItem, bItem);

      if (!result.isEqual) {
        return result;
      }
    }

    return {
      isEqual: true,
    };
  }

  if (a instanceof Date && b instanceof Date) {
    return {
      isEqual: a.valueOf() === b.valueOf(),
      expected: b,
      received: a,
    };
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return {
        isEqual: false,
        expected: b,
        received: a,
      };
    }

    for (const v of a) {
      if (!b.has(v)) {
        return {
          isEqual: false,
          expected: b,
          received: v,
        };
      }
    }

    for (const v of b) {
      if (!a.has(v)) {
        return {
          isEqual: false,
          expected: v,
          received: a,
        };
      }
    }

    return {
      isEqual: true,
    };
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return {
        isEqual: false,
        expected: b,
        received: a,
      };
    }

    for (const [k, v] of a) {
      if (!b.has(k)) {
        return {
          isEqual: false,
          expected: b,
          received: a,
        };
      }

      const result = deepEqual(v, b.get(k));
      if (!result.isEqual) {
        return result;
      }
    }

    return {
      isEqual: true,
    };
  }

  if (!a || !b || (typeof a !== "object" && typeof b !== "object")) {
    return { isEqual: a === b, expected: b, received: a };
  }

  if (a.prototype !== b.prototype) {
    return {
      isEqual: false,
      expected: b,
      received: a,
    };
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  for (const key of bKeys) {
    const bv = b[key];
    const av = a[key];

    const result = deepEqual(av, bv);
    if (!result.isEqual) {
      return result;
    }
  }

  for (const key of aKeys) {
    const bv = b[key];
    const av = a[key];

    const result = deepEqual(av, bv);
    if (!result.isEqual) {
      return result;
    }
  }

  return {
    isEqual: true,
  };
}

const setHasMatch = (set: Set<any>, value: any) => {
  if (CustomMatcher.isCustomMatch(value)) {
    for (const v of set) {
      if (value.check(v)) {
        return true;
      }
    }
    return false;
  } else {
    if (set.has(value)) {
      return true;
    }

    for (const v of set) {
      if (CustomMatcher.isCustomMatch(v) && v.check(value)) {
        return true;
      }
    }

    return false;
  }
};

export function matchValues(a: any, b: any): EqualityCheck {
  if (CustomMatcher.isCustomMatch(b)) {
    return {
      isEqual: b.check(a),
      expected: b,
      received: a,
    };
  }

  if (a === b) {
    return {
      isEqual: true,
    };
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return {
      isEqual: false,
      expected: b,
      received: a,
    };
  }

  if (a === null || b === null) {
    return {
      isEqual: false,
      expected: b,
      received: a,
    };
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const lastAIndex = a.length - 1;
    for (const bIndex of b.keys()) {
      if (bIndex > lastAIndex) {
        return {
          isEqual: false,
          expected: b[bIndex],
          received: undefined,
        };
      }

      const aItem = a[bIndex];
      const bItem = b[bIndex];

      const result = matchValues(aItem, bItem);

      if (!result.isEqual) {
        return result;
      }
    }

    return {
      isEqual: true,
    };
  }

  if (a instanceof Date && b instanceof Date) {
    return {
      isEqual: a.valueOf() === b.valueOf(),
      expected: b,
      received: a,
    };
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return {
        isEqual: false,
        expected: b,
        received: a,
      };
    }

    for (const v of a) {
      if (!setHasMatch(b, v)) {
        return {
          isEqual: false,
          expected: b,
          received: v,
        };
      }
    }

    for (const v of b) {
      if (!setHasMatch(a, v)) {
        return {
          isEqual: false,
          expected: v,
          received: a,
        };
      }
    }

    return {
      isEqual: true,
    };
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return {
        isEqual: false,
        expected: b,
        received: a,
      };
    }

    for (const [k, v] of a) {
      if (!b.has(k)) {
        return {
          isEqual: false,
          expected: b,
          received: v,
        };
      }

      const result = matchValues(v, b.get(k));
      if (!result.isEqual) {
        return result;
      }
    }

    return {
      isEqual: true,
    };
  }

  if (!a || !b || (typeof a !== "object" && typeof b !== "object")) {
    return {
      isEqual: a === b,
      expected: b,
      received: a,
    };
  }

  const bKeys = Object.keys(b);

  for (const key of bKeys) {
    const bv = b[key];
    const av = a[key];

    const result = matchValues(av, bv);
    if (!result.isEqual) {
      return result;
    }
  }

  return {
    isEqual: true,
  };
}
