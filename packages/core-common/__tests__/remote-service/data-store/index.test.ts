import { InMemoryDataStore } from '../../../src/remote-service/data-store';

describe('InMemoryDataStore', () => {
  it('should work', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'pebbles', age: 1, active: true },
    ];

    const store = new InMemoryDataStore<(typeof users)[0]>({
      id: 'user',
    });

    let addCount = 0;
    store.on('created', (i) => {
      addCount++;
    });

    users.forEach((u) => {
      store.create(u);
    });

    const userBarney = store.get('barney');
    expect(userBarney).toEqual(users[0]);
    expect(store.size()).toBe(3);
    expect(addCount).toBe(3);

    const items = store.find({ active: true });
    expect(items).toEqual([users[0], users[2]]);
    expect(store.size({ active: true })).toBe(2);

    store.on('updated', (oldValue, newValue) => {
      expect(oldValue.user).toBe('barney');
      expect(oldValue.age).toBe(36);
      expect(newValue.age).toBe(37);
    });

    store.update('barney', { age: 37 });
  });
});
