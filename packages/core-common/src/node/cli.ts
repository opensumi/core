/**
 * 一个方便使用的 argv 提取工具
 * > mri("node index.js -a -b=1 -c 2".split())
 *
 * {
 *   _: [
 *     'node',
 *     'index.js'
 *   ],
 *   a: true,
 *   b: 1,
 *   c: 2
 * }
 */

import mri from 'mri';

const argv = mri(process.argv);

export { argv };
