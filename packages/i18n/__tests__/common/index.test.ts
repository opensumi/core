import { localize } from '../../src';

describe('localize placeholder test', () => {
  it('localize(\'a\', \'b\') ==> b ', () => {
    const str = localize('a', 'b');
    expect(str).toEqual('b');
  });
});
