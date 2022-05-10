// 用来 debug 某个 packages 的测试有问题
// 该模块会一个个的跑每个 package 下的测试
// 可以手动设置 skipList 来跳过某个包

import { join } from 'path';
import * as jest from 'jest';
import { readdirSync } from 'fs-extra';

const packagesDir = join(__dirname, '../packages');
const packagesDirNames = readdirSync(packagesDir);

/*
 * serial executes Promises sequentially.
 * @param {funcs} An array of funcs that return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log.bind(console))
 */
const serial = (funcs) =>
  funcs.reduce(
    (promise, func) => promise.then((result) => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]),
  );

const skipList = ['addons', 'comments', 'components'] as string[];

const funcs = packagesDirNames.map((target) => {
  return async () => {
    console.log(`current jest module:`, target);
    if (skipList.includes(target)) {
      console.log(`${target} is in skip list`);
      return;
    }
    await jest.run([
      '--testPathPattern',
      `packages/${target}(/__tests?__/.*|(\\.|/)(test|spec))\\.[jt]sx?$`,
      '--runInBand',
      '--bail',
      '--selectProjects',
      'jsdom',
    ]);
    console.log(`end module:`, target);
  };
});

// execute them serially
serial(funcs).then(console.log.bind(console));
