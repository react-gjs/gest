import { describe, expect, it } from "gest";
import { insertSort } from "../../src/user-land/utils/insert-sort";

export default describe("insertSort", () => {
  it("should correctly sort in the ASC order", () => {
    const arr: number[] = [];

    const compareFn = (a: number, b: number) => a - b;

    insertSort(arr, 1, compareFn);
    insertSort(arr, 3, compareFn);
    insertSort(arr, 2, compareFn);
    insertSort(arr, 5, compareFn);
    insertSort(arr, 4, compareFn);

    expect(arr).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5].sort(compareFn));
  });

  it("should correctly sort in the DESC order", () => {
    const arr: number[] = [];

    const compareFn = (a: number, b: number) => b - a;

    insertSort(arr, 1, compareFn);
    insertSort(arr, 3, compareFn);
    insertSort(arr, 2, compareFn);
    insertSort(arr, 5, compareFn);
    insertSort(arr, 4, compareFn);

    expect(arr).toEqual([5, 4, 3, 2, 1]);
    expect(arr).toEqual([1, 2, 3, 4, 5].sort(compareFn));
  });
});
