type Compare<T> = (a: T, b: T) => number;

/**
 * Like `Array#sort` but always stable. Usually runs a little slower `than Array#sort`
 * so only use this when actually needing stable sort.
 */
export function mergeSort<T>(data: T[], compare: Compare<T>): T[] {
  _sort(data, compare, 0, data.length - 1, []);
  return data;
}

function _merge<T>(a: T[], compare: Compare<T>, lo: number, mid: number, hi: number, aux: T[]): void {
  let leftIdx = lo;
  let rightIdx = mid + 1;
  for (let i = lo; i <= hi; i++) {
    aux[i] = a[i];
  }
  for (let i = lo; i <= hi; i++) {
    if (leftIdx > mid) {
      // left side consumed
      a[i] = aux[rightIdx++];
    } else if (rightIdx > hi) {
      // right side consumed
      a[i] = aux[leftIdx++];
    } else if (compare(aux[rightIdx], aux[leftIdx]) < 0) {
      // right element is less -> comes first
      a[i] = aux[rightIdx++];
    } else {
      // left element comes first (less or equal)
      a[i] = aux[leftIdx++];
    }
  }
}

function _sort<T>(a: T[], compare: Compare<T>, lo: number, hi: number, aux: T[]) {
  if (hi <= lo) {
    return;
  }
  // tslint:disable-next-line: no-bitwise
  const mid = lo + ((hi - lo) / 2) | 0;
  _sort(a, compare, lo, mid, aux);
  _sort(a, compare, mid + 1, hi, aux);
  if (compare(a[mid], a[mid + 1]) <= 0) {
    // left and right are sorted and if the last-left element is less
    // or equals than the first-right element there is nothing else
    // to do
    return;
  }
  _merge(a, compare, lo, mid, hi, aux);
}

/**
 * @returns false if the provided object is an array and not empty.
 */
export function isFalsyOrEmpty(obj: any): boolean {
  return !Array.isArray(obj) || obj.length === 0;
}

/**
 * @returns True if the provided object is an array and has at least one element.
 */
export function isNonEmptyArray<T>(obj: T[] | undefined | null): obj is T[];
export function isNonEmptyArray<T>(obj: readonly T[] | undefined | null): obj is readonly T[];
export function isNonEmptyArray<T>(obj: T[] | readonly T[] | undefined | null): obj is T[] | readonly T[] {
  return Array.isArray(obj) && obj.length > 0;
}
