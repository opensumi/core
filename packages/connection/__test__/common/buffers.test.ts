import { Buffers } from '../../src/common/connection/buffers';

describe('Buffers', () => {
  it('can append and slice', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3]));
    list.push(new Uint8Array([4, 5, 6]));

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
    expect(list.byteLength).toEqual(6);
    expect(list.splice(0, 1)).toEqual({ buffers: [new Uint8Array([1])], size: 1 });
    expect(list.byteLength).toEqual(5);
    expect(list.splice(0, 2)).toEqual({ buffers: [new Uint8Array([2, 3])], size: 2 });
    expect(list.byteLength).toEqual(3);

    expect(list.splice(0, 0, new Uint8Array([1]))).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(4);
    expect(list.splice(0, 0, new Uint8Array([2, 3]))).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(6);
    expect(list.splice(0, 0, new Uint8Array([4, 5, 6]))).toEqual({ buffers: [], size: 0 });
    expect(list.byteLength).toEqual(9);

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
    expect(list.byteLength).toEqual(6);
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

  it.only('cursor should work', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3, 4]));
    list.push(new Uint8Array([4, 5, 6, 7, 8, 9]));
    list.push(new Uint8Array([7, 8, 9]));

    const cursor = list.cursor(0);
    let count = 0;
    for (const a of cursor.iterator()) {
      expect(a).toEqual(list.get(count));
      if (count === 4) {
        break;
      }

      count++;
    }
    expect(count).toEqual(4);
    expect(cursor.value).toEqual(list.get(5));
    expect(cursor.offset).toEqual(5);
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(1);
    expect(cursor.lineWidth).toEqual(6);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    count++;

    // reentrant
    for (const a of cursor.iterator()) {
      expect(a).toEqual(list.get(count));
      count++;
    }

    // because here we always let count plus 1
    expect(count).toEqual(list.byteLength);
    expect(cursor.offset).toEqual(list.byteLength);
    expect(cursor.line).toEqual(3);
    expect(cursor.lineOffset).toEqual(0);
  });

  it('cursor can break', () => {
    const list = new Buffers();
    list.push(new Uint8Array([1, 2, 3, 4]));
    list.push(new Uint8Array([4, 5, 6, 7, 8, 9]));
    list.push(new Uint8Array([7, 8, 9]));

    const cursor = list.cursor(0);
    let count = 0;
    const iter = cursor.iterator();
    for (const a of iter) {
      expect(a).toEqual(list.get(count));
      if (count === 4) {
        iter.return();
      } else {
        count++;
      }
    }

    expect(count).toEqual(4);
    expect(cursor.offset).toEqual(5);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(1);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    cursor.move(1);
    expect(cursor.offset).toEqual(6);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(2);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    cursor.move(2);
    expect(cursor.offset).toEqual(7);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(1);
    expect(cursor.lineOffset).toEqual(4);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });

    cursor.move(3);
    expect(cursor.offset).toEqual(10);
    expect(cursor.value).toEqual(list.get(cursor.offset));
    expect(cursor.line).toEqual(2);
    expect(cursor.lineOffset).toEqual(1);
    expect(list.pos(cursor.offset)).toEqual({ buf: cursor.line, offset: cursor.lineOffset });
  });
});
