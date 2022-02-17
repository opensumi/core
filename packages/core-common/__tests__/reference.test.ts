import { ReferenceManager } from '../src/reference';

describe('reference Manager Test', () => {
  let refManager: ReferenceManager<TestClass>;

  beforeAll(() => {
    refManager = new ReferenceManager<TestClass>(async (id: string) => new TestClass(id));
  });

  it('can create ref', async () => {
    const ref1 = await refManager.getReference('test1', 'ref1');
    const ref2 = await refManager.getReference('test1', 'ref2');

    expect(ref1.instance).toBeDefined();
    expect(ref1.instance).toBeInstanceOf(TestClass);
    expect(ref1.reason).toBe('ref1');

    expect(ref2.instance).toBeDefined();
    expect(ref2.instance).toBeInstanceOf(TestClass);
    expect(ref2.reason).toBe('ref2');

    expect(ref1.instance).toBe(ref2.instance);

    ref2.dispose();

    expect(() => ref2.instance).toThrowError();
    expect(ref1.instance).toBeDefined();

    const ref3 = ref1.hold('ref3');
    expect(ref3.instance).toBe(ref1.instance);
    expect(ref3.reason).toBe('ref3');

    ref1.dispose();
    ref3.dispose();

    expect(refManager.getReferenceIfHasInstance('tes1')).toBeNull();
  });

  it('events', async () => {
    const createdListener = jest.fn();
    const disposedListener = jest.fn();

    const d1 = refManager.onInstanceCreated(createdListener);
    const d2 = refManager.onReferenceAllDisposed(disposedListener);

    const ref1 = await refManager.getReference('test1', 'ref1');
    expect(createdListener).toBeCalledTimes(1);
    const ref2 = await refManager.getReference('test1', 'ref2');
    expect(createdListener).toBeCalledTimes(1);

    ref1.dispose();
    expect(disposedListener).toBeCalledTimes(0);
    ref2.dispose();
    expect(disposedListener).toBeCalledTimes(1);

    d1.dispose();
    d2.dispose();
  });

  it('edge cases', async () => {
    // 创建时回调获取并销毁ref
    const d1 = refManager.onInstanceCreated((testClass) => {
      const tempRef = refManager.getReferenceIfHasInstance(testClass.id);
      tempRef!.dispose();
    });

    const disposedListener = jest.fn();
    const d2 = refManager.onReferenceAllDisposed(disposedListener);

    const ref1 = await refManager.getReference('test1', 'ref1');

    expect(ref1.instance).toBeDefined();
    expect(ref1.instance).toBeInstanceOf(TestClass);
    expect(ref1.instance!.id).toBe('test1');

    ref1.dispose();
    expect(disposedListener).toBeCalledTimes(1);

    d1.dispose();
    d2.dispose();
  });
});

class TestClass {
  public data = '';

  constructor(public readonly id: string) {}
}
