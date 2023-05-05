export const deepCopy = <T>(obj: T, visited = new Map<any, any>()): T => {
  const type = typeof obj;

  if (type !== "object" || obj == null) {
    return obj;
  }

  // If we've already visited this object, return reference to the copy
  if (visited.has(obj)) {
    return visited.get(obj);
  }

  if (Array.isArray(obj)) {
    const copy = obj.map((item) => deepCopy(item, visited)) as unknown as T;
    visited.set(obj, copy);
    return copy;
  }

  const keys = Object.keys(obj);

  const copy: Record<any, any> = {};

  Object.setPrototypeOf(copy, Object.getPrototypeOf(obj));

  visited.set(obj, copy);

  for (const key of keys) {
    copy[key] = deepCopy(obj[key as keyof T], visited);
  }

  const orgProto = Object.getPrototypeOf(obj);

  if (orgProto != null) {
    Object.setPrototypeOf(copy, orgProto);
  }

  if (obj instanceof Error) {
    copy.stack = obj.stack;
    copy.message = obj.message;
  }

  return copy as T;
};
