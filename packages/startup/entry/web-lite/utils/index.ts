import { URI } from '@opensumi/ide-core-common';
import { Path } from '@opensumi/ide-core-common/lib/path';

export function base64ToUnicode(str: string) {
  return decodeURIComponent(
    atob(str)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    );
}

/**
 * TODO file-scheme 内很多逻辑是通用的，和node fs关联的功能放在一个独立的模块内可移除比较合适
 * 找到source文件url和中从末尾开始和target不一样的path
 * @param source
 * @param targets
 */
export function getMinimalDiffPath(source: URI, targets: URI[]): string {
  const sourceDirPartsReverse = source.path.dir.toString().split(Path.separator).reverse();
  const targetDirPartsReverses = targets.map((target) => {
    return target.path.dir.toString().split(Path.separator).reverse();
  });
  for (let i = 0; i < sourceDirPartsReverse.length; i ++ ) {
    let foundSame = false;
    for (const targetDirPartsReverse of targetDirPartsReverses) {
      if (targetDirPartsReverse[i] === sourceDirPartsReverse[i]) {
        foundSame = true;
        break;
      }
    }
    if (!foundSame) {
      return sourceDirPartsReverse.slice(0, i + 1).reverse().join(Path.separator);
    }
  }
  return sourceDirPartsReverse.reverse().join(Path.separator);
}
