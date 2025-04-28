import { Injectable } from '@opensumi/di';
import { IDisposable, URI, toDisposable } from '@opensumi/ide-utils';

import {
  IMultiDiffSourceResolver,
  IMultiDiffSourceResolverService,
  IResolvedMultiDiffSource,
} from '../../common/multi-diff';

@Injectable()
export class MultiDiffSourceResolverService implements IMultiDiffSourceResolverService {
  private readonly _resolvers = new Set<IMultiDiffSourceResolver>();

  registerResolver(resolver: IMultiDiffSourceResolver): IDisposable {
    // throw on duplicate
    if (this._resolvers.has(resolver)) {
      throw new Error('Duplicate resolver');
    }
    this._resolvers.add(resolver);
    return toDisposable(() => this._resolvers.delete(resolver));
  }

  resolve(uri: URI): Promise<IResolvedMultiDiffSource | undefined> {
    for (const resolver of this._resolvers) {
      if (resolver.canHandleUri(uri)) {
        return resolver.resolveDiffSource(uri);
      }
    }
    return Promise.resolve(undefined);
  }
}
