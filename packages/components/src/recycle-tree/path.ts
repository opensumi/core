import { Path } from '@opensumi/ide-utils/lib/path';

function parse(path: string): { dirname: string; basename: string } {
  const parts = path.split(Path.separator);
  const basename = parts.pop() || '';
  return { dirname: parts.join(Path.separator), basename };
}

function relative(parent: string, child: string): string | undefined {
  if (parent === child) {
    return '';
  }
  if (!parent || !child) {
    return undefined;
  }

  const raw = !parent.endsWith(Path.separator) ? parent + Path.separator : parent;
  if (!child.startsWith(raw)) {
    return undefined;
  }
  const relativePath = child.substring(raw.length);
  return relativePath;
}

export const treePath = {
  parse,
  relative,
};
