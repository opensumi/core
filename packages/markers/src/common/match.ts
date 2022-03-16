import { equalsIgnoreCase, URI, isWindows, isLinux } from '@opensumi/ide-core-common';
import { TernarySearchTree } from '@opensumi/ide-core-common/lib/map';
import { Schemas } from '@opensumi/ide-core-common/lib/network';
import * as paths from '@opensumi/ide-core-common/lib/path';
import { parse, IExpression, ParsedExpression } from '@opensumi/ide-core-common/lib/utils/glob';
import * as extpath from '@opensumi/ide-core-common/lib/utils/paths';

export class ResourceGlobMatcher {
  private readonly globalExpression: ParsedExpression;
  private readonly expressionsByRoot: TernarySearchTree<{ root: URI; expression: ParsedExpression }> =
    TernarySearchTree.forPaths<{ root: URI; expression: ParsedExpression }>();

  constructor(globalExpression: IExpression, rootExpressions: { root: URI; expression: IExpression }[]) {
    this.globalExpression = parse(globalExpression);
    for (const expression of rootExpressions) {
      this.expressionsByRoot.set(expression.root.toString(), {
        root: expression.root,
        expression: parse(expression.expression),
      });
    }
  }

  matches(resource: URI): boolean {
    const rootExpression = this.expressionsByRoot.findSubstr(resource.toString());
    if (rootExpression) {
      const path = relativePath(rootExpression.root, resource);
      if (path && !!rootExpression.expression(path)) {
        return true;
      }
    }
    return !!this.globalExpression(resource.codeUri.path);
  }
}

/**
 * Returns a relative path between two URIs. If the URIs don't have the same schema or authority, `undefined` is returned.
 * The returned relative path always uses forward slashes.
 */
export function relativePath(from: URI, to: URI, ignoreCase = hasToIgnoreCase(from)): string | undefined {
  if (from.scheme !== to.scheme || !isEqualAuthority(from.authority, to.authority)) {
    return undefined;
  }
  if (from.scheme === Schemas.file) {
    const relativePath = paths.relative(from.codeUri.path, to.codeUri.path);
    return isWindows ? extpath.toSlashes(relativePath) : relativePath;
  }
  let fromPath = from.codeUri.path || '/';
  const toPath = to.codeUri.path || '/';
  if (ignoreCase) {
    // make casing of fromPath match toPath
    let i = 0;
    for (const len = Math.min(fromPath.length, toPath.length); i < len; i++) {
      if (fromPath.charCodeAt(i) !== toPath.charCodeAt(i)) {
        if (fromPath.charAt(i).toLowerCase() !== toPath.charAt(i).toLowerCase()) {
          break;
        }
      }
    }
    fromPath = toPath.substr(0, i) + fromPath.substr(i);
  }
  return paths.posix.relative(fromPath, toPath);
}

/**
 * Tests wheter the two authorities are the same
 */
export function isEqualAuthority(a1: string, a2: string) {
  return a1 === a2 || equalsIgnoreCase(a1, a2);
}

export function hasToIgnoreCase(resource: URI | undefined): boolean {
  // A file scheme resource is in the same platform as code, so ignore case for non linux platforms
  // Resource can be from another platform. Lowering the case as an hack. Should come from File system provider
  return resource && resource.scheme === Schemas.file ? !isLinux : true;
}
