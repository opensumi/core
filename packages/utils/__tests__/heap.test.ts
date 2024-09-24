import { Heap } from '../src/heap';

describe('heap', () => {
  test('min heap should work', () => {
    const minHeap = new Heap<number>({
      comparator: (a, b) => a - b,
    });
    minHeap.add(1);
    minHeap.add(6);
    minHeap.add(2);
    minHeap.add(0);
    minHeap.add(5);
    minHeap.add(9);

    expect(minHeap.peek()).toBe(0);

    expect(minHeap.pop()).toBe(0);
    expect(minHeap.pop()).toBe(1);
    expect(minHeap.pop()).toBe(2);
    expect(minHeap.pop()).toBe(5);
    expect(minHeap.pop()).toBe(6);
    expect(minHeap.pop()).toBe(9);
  });

  test('max heap should work', () => {
    const maxHeap = new Heap<number>({
      comparator: (a, b) => b - a,
    });
    maxHeap.add(1);
    maxHeap.add(6);
    maxHeap.add(2);
    maxHeap.add(0);
    maxHeap.add(5);
    maxHeap.add(9);

    expect(maxHeap.peek()).toBe(9);

    expect(maxHeap.pop()).toBe(9);

    expect(maxHeap.size).toBe(5);

    expect(maxHeap.pop()).toBe(6);
    expect(maxHeap.pop()).toBe(5);
    expect(maxHeap.pop()).toBe(2);
    expect(maxHeap.pop()).toBe(1);
    expect(maxHeap.pop()).toBe(0);
  });
});
