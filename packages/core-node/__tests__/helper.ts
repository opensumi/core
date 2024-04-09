export async function expectThrowsAsync(
  actual: Promise<any>,
  expected?: string | RegExp,
  message?: string,
): Promise<void>;
export async function expectThrowsAsync(
  actual: Promise<any>,
  constructor: Error | Function,
  expected?: string | RegExp,
  message?: string,
): Promise<void>;
export async function expectThrowsAsync(promise: Promise<any>, ...args: any[]): Promise<void> {
  let synchronous = () => {};
  try {
    await promise;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('expectThrowsAsync', e);
    synchronous = () => {
      throw e;
    };
  } finally {
    expect(synchronous).toThrow(...args);
  }
}
