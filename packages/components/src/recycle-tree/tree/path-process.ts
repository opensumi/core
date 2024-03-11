import { Path } from '@opensumi/ide-utils/lib/path';

export function basename(path: string) {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i] === Path.separator) {
      return path.substring(i + 1);
    }
  }

  return path;
}

export function dirname(path: string) {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i] === Path.separator) {
      return path.substring(0, i);
    }
  }

  return path;
}

export function parse(path: string) {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i] === Path.separator) {
      return {
        basename: path.substring(i + 1),
        dirname: path.substring(0, i),
      };
    }
  }

  return {
    basename: path,
    dirname: '',
  };
}

export function relative(a: string, b: string): string | undefined {
  if (a === b) {
    return '';
  }
  if (!a || !b) {
    return undefined;
  }

  const base = basename(a);
  const raw = base ? a + Path.separator : a;
  if (!b.startsWith(raw)) {
    return undefined;
  }
  const relativePath = b.substr(raw.length);
  return relativePath;
}
