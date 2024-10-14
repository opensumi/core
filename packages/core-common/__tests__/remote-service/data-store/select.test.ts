import _ from 'lodash';

import { select } from '../../../src/remote-service/data-store/select';

describe('select', () => {
  it('should work', () => {
    const users = [
      { user: 'barney', age: 36, active: true },
      { user: 'fred', age: 40, active: false },
      { user: 'pebbles', age: 1, active: true },
    ];

    const result = select(users, { age: 1, active: true });
    expect(result).toEqual([{ user: 'pebbles', age: 1, active: true }]);

    const userObj = _.keyBy(users, 'user');
    const result2 = select(userObj, { age: 1, active: true });
    expect(result2).toEqual([{ user: 'pebbles', age: 1, active: true }]);
  });
});
