import { Buffers } from '../../src/common/connection/buffers';

describe('Buffers', () => {
  it('can append and slice', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));

    expect(() => {
      list.slice(-1, 1);
    }).toThrow();

    expect(list.slice(0, 0)).toEqual(new Uint8Array(0));
    expect(list.slice(0, 2)).toEqual(new Uint8Array([1, 2]));
    expect(list.slice(0, 7)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));

    expect(list.slice(1, 1)).toEqual(new Uint8Array(0));
    expect(list.slice(1, 5)).toEqual(new Uint8Array([2, 3, 4, 5]));
    expect(list.slice(1, 7)).toEqual(new Uint8Array([2, 3, 4, 5, 6]));

    expect(list.slice(2, 2)).toEqual(new Uint8Array(0));
    expect(list.slice(2, 6)).toEqual(new Uint8Array([3, 4, 5, 6]));
  });

  it('can splice', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));

    expect(list.splice(0, 0)).toEqual({ buffers: [], size: 0 });
    expect(list.splice(0, 1)).toEqual({ buffers: [new Uint8Array([1])], size: 1 });
    expect(list.splice(0, 2)).toEqual({ buffers: [new Uint8Array([2, 3])], size: 2 });

    expect(list.splice(0, 0, new Uint8Array([1]))).toEqual({ buffers: [], size: 0 });
    expect(list.splice(0, 0, new Uint8Array([2, 3]))).toEqual({ buffers: [], size: 0 });
    expect(list.splice(0, 0, new Uint8Array([4, 5, 6]))).toEqual({ buffers: [], size: 0 });
    expect(list.buffers).toEqual([
      new Uint8Array([4, 5, 6]),
      new Uint8Array([2, 3]),
      new Uint8Array([1]),
      new Uint8Array([4, 5, 6]),
    ]);
  });
  it('can copy', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));

    list.push(new Uint8Array([4, 5, 6]));

    const target = new Uint8Array(7);

    list.copy(target, 0);

    expect(target).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 0]));
  });

  it('other', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));
    expect(list.length).toEqual(6);
    expect(list.pos(0)).toEqual({ buf: 0, offset: 0 });
    expect(list.pos(1)).toEqual({ buf: 0, offset: 1 });
    expect(list.pos(2)).toEqual({ buf: 0, offset: 2 });
    expect(list.get(0)).toEqual(1);
    expect(list.get(1)).toEqual(2);

    list.set(0, 9);
    list.set(1, 10);
    expect(list.get(0)).toEqual(9);
    expect(list.get(1)).toEqual(10);
  });
});
