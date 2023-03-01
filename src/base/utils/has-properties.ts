export function _hasProperties<K extends string>(
  o: object,
  ...p: K[]
): o is Record<K, unknown> {
  for (const key of p) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) return false;
  }
  return true;
}
