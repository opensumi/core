import { LRUMap } from '../src/lru-map';

describe('lru map', () => {
  it('should work', () => {
    expect.assertions(13);
    const map = new LRUMap<string, number>(3, 3);
    map.set('a', 1);
    map.set('b', 2);
    map.set('c', 3);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
    expect(map.get('c')).toBe(3);
    const dispose = map.onKeyDidDelete('a', ({ key, value }) => {
      expect(key).toBe('a');
      expect(value).toBe(1);
    });

    map.set('d', 4);
    expect(map.get('a')).toBe(undefined);
    expect(map.get('b')).toBe(2);
    expect(map.get('c')).toBe(3);
    expect(map.get('d')).toBe(4);
    map.set('e', 5);
    expect(map.get('b')).toBe(undefined);
    expect(map.get('c')).toBe(3);
    expect(map.get('d')).toBe(4);
    expect(map.get('e')).toBe(5);

    dispose.dispose();
  });
});
