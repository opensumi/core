import { LRUMap } from "../src/utils"

describe(' LRU Map tests', () => {

  it('LRUMap should shrink', () => {

    const map = new LRUMap<number, number>(20, 10);

    for (let i = 0; i < 20; i ++) {
      map.set(i, i);
    }


    expect(map.size).toBe(20);
    expect(map.get(1)).toBe(1);

    map.set(21, 21);

    expect(map.size).toBe(10);
    expect(map.get(12)).toBe(12);
    expect(map.get(2)).toBe(undefined);
    
  })

})