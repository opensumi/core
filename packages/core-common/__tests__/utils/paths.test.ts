import { URI } from '../../src/uri';
import * as paths from '../../src/utils/paths';

describe('paths', () => {
  // 测试 uri#toString 传入 skipEncoding#true 时
  // path 部分和 `uri.path` 的 toString 结果是保持一致的
  describe('toString', () => {
    it('uri with path', () => {
      const uri1 = URI.file('test.ts');
      expect(uri1.withoutScheme().toString(true)).toBe(uri1.path.toString());

      const uri2 = URI.from({
        scheme: 'git',
        authority: 'github.com',
        path: '/test1.ts',
      });

      expect(uri2.withoutScheme().toString(true)).toContain(uri2.path.toString());
    });

    it('uri with path and query', () => {
      const uri1 = URI.from({
        scheme: 'file',
        authority: '',
        path: 'test.ts',
        query: 'a=1',
        fragment: 'hash',
      });

      expect(uri1.withoutScheme().toString(true)).toContain(uri1.path.toString());

      const uri2 = URI.from({
        scheme: 'git',
        authority: 'github.com',
        path: '/test1.ts',
        query: 'a=1',
        fragment: 'hash',
      });

      expect(uri2.withoutScheme().toString(true)).toContain(uri2.path.toString());
    });
  });
});
