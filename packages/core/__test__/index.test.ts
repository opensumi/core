import { Adder, greet } from '../src';

describe('greeter module', () => {
  it('should add', () => {
    const adder = new Adder();
    expect(adder.add(2, 3)).toEqual(5);
  });
  it('should greet', () => {
    expect(greet('world')).toEqual('greeter says: hello to world');
  });
});
