import { treePath } from '@opensumi/ide-components/lib/recycle-tree/path';
import { Path, findCommonRoot } from '@opensumi/ide-utils/lib/path';

function getCommonPathsLegacy(paths: string[]) {
  if (!paths.length) {
    return '';
  }
  // 根据路径层级深度进行排序
  paths = paths.sort((a, b) => {
    const depthA = Path.pathDepth(a);
    const depthB = Path.pathDepth(b);
    return depthA - depthB;
  });
  if (paths.length === 1 || Path.pathDepth(paths[0]) === 1) {
    // 说明刷新队列中包含根节点，直接返回根节点进行刷新
    return paths[0];
  }

  const sortedPaths = paths.map((p) => new Path(p));
  let rootPath = sortedPaths[0];
  for (let i = 1, len = sortedPaths.length; i < len; i++) {
    if (rootPath.isEqualOrParent(sortedPaths[i])) {
      continue;
    } else {
      while (!rootPath.isRoot) {
        rootPath = rootPath.dir;
        if (!rootPath || rootPath.isEqualOrParent(sortedPaths[i])) {
          break;
        }
      }
    }
  }
  if (rootPath) {
    return rootPath.toString();
  }

  return '';
}

function relativeLegacy(parent: string, child: string) {
  return new Path(parent).relative(new Path(child))?.toString() as string;
}

function parseLegacy(path: string) {
  const _path = new Path(path);
  return {
    basename: _path.base,
    dirname: _path.dir.toString(),
  };
}

describe('tree path', () => {
  it('get common paths', () => {
    const paths = ['/a/b/c', '/a/b/d', '/a/b/e', '/a/b/f'];

    expect(getCommonPathsLegacy(paths)).toBe('/a/b');
    expect(findCommonRoot(paths)).toBe('/a/b');

    const testcases = [
      {
        paths: ['/a/b/c', '/a/b/d', '/a/b/e', '/a/b/f'],
        result: '/a/b',
      },
      {
        paths: ['/a/b/c', '/a/b/d', '/a/b/e', '/a/b/f', '/a/b', '/a/c'],
        result: '/a',
      },
    ];

    for (const testcase of testcases) {
      expect(getCommonPathsLegacy(testcase.paths)).toBe(testcase.result);
      expect(findCommonRoot(testcase.paths)).toBe(testcase.result);
    }
  });
  it('get common paths only root', () => {
    const paths = ['/a', '/b'];
    expect(getCommonPathsLegacy(paths)).toBe('/');
    expect(findCommonRoot(paths)).toBe('');
  });

  it('relative path', () => {
    const testcases = [
      ['/a/b/c', '/a/b/d', undefined],
      ['/a/b/c', '/a/b', undefined],
      ['/a/b/c', '/a/b/c', ''],
      ['/a/b', '/a/b/c', 'c'],
      ['/a/b/', '/a/b/c', 'c'],
      ['/a/b', '/a/b/c/d', 'c/d'],
      ['/a/b/', '/a/b/c/d', 'c/d'],
    ] as [string, string, string | undefined][];

    for (const testcase of testcases) {
      const result0 = relativeLegacy(testcase[0], testcase[1]);
      const result1 = treePath.relative(testcase[0], testcase[1]);
      expect(result0).toBe(testcase[2]);
      expect(result1).toBe(testcase[2]);
    }
  });

  it('can parse path', () => {
    const testcases = [
      {
        source: '/a/b/c',
        result: {
          basename: 'c',
          dirname: '/a/b',
        },
      },
      {
        source: '/a/b/c/',
        result: {
          basename: '',
          dirname: '/a/b/c',
        },
      },
      {
        source: 'asfd/w2er/23r.txt',
        result: {
          basename: '23r.txt',
          dirname: 'asfd/w2er',
        },
      },
    ];

    for (const testcase of testcases) {
      const result = treePath.parse(testcase.source);
      const resultLegacy = parseLegacy(testcase.source);
      expect(result).toEqual(resultLegacy);
      expect(result).toEqual(testcase.result);
    }
  });
});
