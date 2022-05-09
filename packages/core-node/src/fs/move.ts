import fse from 'fs-extra';

interface MoveOptions {
  overwrite?: boolean;
}

/**
 * Moves the file to a new path identified by the resource.
 *
 * The optional parameter overwrite can be set to replace an existing file at the location.
 *
 * |           | missing |    file   | empty dir |    dir    |
 * |-----------|---------|-----------|-----------|-----------|
 * | missing   |    x    |     x     |     x     |     x     |
 * | file      |    ✓    | overwrite |     x     |     x     |
 * | empty dir |    ✓    |     x     | overwrite | overwrite |
 * | dir       |    ✓    |     x     | overwrite | overwrite |
 */
export default async function move(src: string, dest: string, options: MoveOptions = { overwrite: false }) {
  return fse.move(src, dest, options);
}
