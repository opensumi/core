import { IConnectionPair } from './utils';

export const test = (
  name: string,
  options: {
    pairFactory: () => IConnectionPair;
    factory: (pair: IConnectionPair) => any;
  },
) => {
  const { factory, pairFactory } = options;
  describe(name, () => {
    let pair: IConnectionPair;
    beforeEach(() => {
      pair = pairFactory();
    });

    afterEach(() => {
      pair && pair.close();
    });

    it('can call method', async () => {
      const { invoker1, invoker2 } = factory(pair);

      const result = await invoker1.add(1, 2);
      expect(result).toBe(3);

      const result2 = await invoker2.shortUrl('1234567890abcdefg');
      expect(result2).toBe('1234567890');

      const result3 = await invoker2.returnUndefined();
      // sumi rpc current behavior is to return null
      expect(result3).toBeFalsy();
    });
  });
};
