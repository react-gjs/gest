export const insertSort = <T>(
  sortedArray: T[],
  newElem: T,
  compare: (a: T, b: T) => number
) => {
  const len = sortedArray.length;
  let i = 0;

  while (i < len && compare(newElem, sortedArray[i]!) > 0) {
    i++;
  }

  sortedArray.splice(i, 0, newElem);
};
