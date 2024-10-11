import { InMemoryDataStore } from '../../../src/remote-service/data-store';

describe('InMemoryDataStore', () => {
  it('should work', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'pebbles', age: 1, active: true },
    ];

    const store = new InMemoryDataStore<(typeof users)[0], 'user'>({
      id: 'user',
    });

    let addCount = 0;
    store.on('created', () => {
      addCount++;
    });

    users.forEach((u) => {
      store.create(u);
    });

    const userBarney = store.get('barney');
    expect(userBarney).toEqual(users[0]);
    expect(store.count()).toBe(3);
    expect(addCount).toBe(3);

    const items = store.find({ active: true });
    expect(items).toEqual([users[0], users[2]]);
    expect(store.count({ active: true })).toBe(2);

    store.on('updated', (oldValue, newValue) => {
      expect(oldValue.user).toBe('barney');
      expect(oldValue.age).toBe(36);
      expect(newValue.age).toBe(37);
    });

    store.update('barney', { age: 37 });
  });
});

interface TestItem {
  id?: string;
  name: string;
}

describe('InMemoryDataStore2', () => {
  let store: InMemoryDataStore<TestItem, 'id'>;

  beforeEach(() => {
    store = new InMemoryDataStore<TestItem, 'id'>();
  });

  test('should initialize correctly', () => {
    expect(store).toBeInstanceOf(InMemoryDataStore);
  });

  test('should create and store item', () => {
    const item = { name: 'test' };
    const createdItem = store.create(item);

    expect(createdItem).toHaveProperty('id');
    expect(store.get(createdItem.id!)).toEqual(createdItem);
  });

  test('should emit created event on create', () => {
    const item = { name: 'test' };
    const spy = jest.spyOn(store, 'emit');

    store.create(item);

    expect(spy).toHaveBeenCalledWith('created', expect.any(Object));
  });

  test('should find items based on query', () => {
    store.create({ name: 'test1' });
    store.create({ name: 'test2' });

    const result = store.find({ name: 'test1' });

    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('test1');
  });

  test('should return correct size', () => {
    store.create({ name: 'test1' });
    store.create({ name: 'test2' });

    expect(store.count()).toBe(2);
    expect(store.count({ name: 'test1' })).toBe(1);
  });

  test('should get item by id', () => {
    const item = store.create({ name: 'test' });

    expect(store.get(item.id!)).toEqual(item);
  });

  test('should check if item exists by id', () => {
    const item = store.create({ name: 'test' });

    expect(store.has(item.id!)).toBe(true);
    expect(store.has('nonexistent')).toBe(false);
  });

  test('should update item', () => {
    const item = store.create({ name: 'test' });
    store.update(item.id!, { name: 'updated' });

    const updatedItem = store.get(item.id!);
    expect(updatedItem!.name).toBe('updated');
  });

  test('should emit updated event on update', () => {
    const item = store.create({ name: 'test' });
    const spy = jest.spyOn(store, 'emit');

    store.update(item.id!, { name: 'updated' });

    expect(spy).toHaveBeenCalledWith('updated', expect.any(Object), expect.any(Object));
  });

  test('should remove item', () => {
    const item = store.create({ name: 'test' });
    store.remove(item.id!);

    expect(store.get(item.id!)).toBeUndefined();
  });

  test('should emit removed event on remove', () => {
    const item = store.create({ name: 'test' });
    const spy = jest.spyOn(store, 'emit');

    store.remove(item.id!);

    expect(spy).toHaveBeenCalledWith('removed', expect.any(Object));
  });
});
