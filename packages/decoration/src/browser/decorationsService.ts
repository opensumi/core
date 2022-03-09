import { Injectable } from '@opensumi/di';
import {
  Uri,
  Disposable,
  Event,
  Emitter,
  CancellationTokenSource,
  localize,
  isThenable,
  IDisposable,
  toDisposable,
  dispose,
} from '@opensumi/ide-core-common';
import { getDebugLogger, isFalsyOrWhitespace, asArray } from '@opensumi/ide-core-common';
import { isPromiseCanceledError } from '@opensumi/ide-core-common/lib/errors';
import { LinkedList } from '@opensumi/ide-core-common/lib/linked-list';
import { TernarySearchTree } from '@opensumi/ide-core-common/lib/map';

import {
  IDecorationsService,
  IDecoration,
  IResourceDecorationChangeEvent,
  IDecorationsProvider,
  IDecorationData,
} from '../common/decorations';

class FileDecorationChangeEvent implements IResourceDecorationChangeEvent {
  private readonly _data = TernarySearchTree.forPaths<boolean>();

  affectsResource(uri: Uri): boolean {
    return this._data.get(uri.toString()) || this._data.findSuperstr(uri.toString()) !== undefined;
  }

  static debouncer(last: FileDecorationChangeEvent, current: Uri | Uri[]) {
    if (!last) {
      last = new FileDecorationChangeEvent();
    }
    if (Array.isArray(current)) {
      // many
      for (const uri of current) {
        last._data.set(uri.toString(), true);
      }
    } else {
      // one
      last._data.set(current.toString(), true);
    }

    return last;
  }
}

class DecorationDataRequest {
  constructor(readonly source: CancellationTokenSource, readonly thenable: Promise<void>) {}
}

class DecorationProviderWrapper {
  readonly data = TernarySearchTree.forPaths<DecorationDataRequest | IDecorationData | null>();
  private readonly _dispoable: IDisposable;

  constructor(
    private readonly _provider: IDecorationsProvider,
    private readonly _uriEmitter: Emitter<Uri | Uri[]>,
    private readonly _flushEmitter: Emitter<IResourceDecorationChangeEvent>,
  ) {
    this._dispoable = this._provider.onDidChange((uris) => {
      if (!uris) {
        // flush event -> drop all data, can affect everything
        this.data.clear();
        this._flushEmitter.fire({
          affectsResource() {
            return true;
          },
        });
      } else {
        // selective changes -> drop for resource, fetch again, send event
        // perf: the map stores thenables, decorations, or `null`-markers.
        // we make us of that and ignore all uris in which we have never
        // been interested.
        for (const uri of uris) {
          this._fetchData(uri);
        }
      }
    });
  }

  dispose(): void {
    this._dispoable.dispose();
    this.data.clear();
  }

  knowsAbout(uri: Uri): boolean {
    return Boolean(this.data.get(uri.toString())) || Boolean(this.data.findSuperstr(uri.toString()));
  }

  getOrRetrieve(uri: Uri, includeChildren: boolean, callback: (data: IDecorationData, isChild: boolean) => void): void {
    const key = uri.toString();
    let item = this.data.get(key);

    if (item === undefined) {
      // unknown -> trigger request
      item = this._fetchData(uri);
    }

    if (item && !(item instanceof DecorationDataRequest)) {
      // found something (which isn't pending anymore)
      callback(item, false);
    }

    if (includeChildren) {
      // (resolved) children
      const iter = this.data.findSuperstr(key);
      if (iter) {
        for (let item = iter.next(); !item.done; item = iter.next()) {
          if (item.value && !(item.value instanceof DecorationDataRequest)) {
            callback(item.value, true);
          }
        }
      }
    }
  }

  private _fetchData(uri: Uri): IDecorationData | null {
    // check for pending request and cancel it
    const pendingRequest = this.data.get(uri.toString());
    if (pendingRequest instanceof DecorationDataRequest) {
      pendingRequest.source.cancel();
      this.data.delete(uri.toString());
    }

    const source = new CancellationTokenSource();
    const dataOrThenable = this._provider.provideDecorations(uri, source.token);
    if (!isThenable<IDecorationData | Promise<IDecorationData | undefined> | undefined>(dataOrThenable)) {
      // sync -> we have a result now
      return this._keepItem(uri, dataOrThenable);
    } else {
      // async -> we have a result soon
      const request = new DecorationDataRequest(
        source,
        Promise.resolve(dataOrThenable)
          .then((data) => {
            if (this.data.get(uri.toString()) === request) {
              this._keepItem(uri, data);
            }
          })
          .catch((err) => {
            if (!isPromiseCanceledError(err) && this.data.get(uri.toString()) === request) {
              this.data.delete(uri.toString());
            }
          }),
      );

      this.data.set(uri.toString(), request);
      return null;
    }
  }

  private _keepItem(uri: Uri, data: IDecorationData | undefined): IDecorationData | null {
    const deco = data ? data : null;
    const old = this.data.set(uri.toString(), deco);
    if (deco || old) {
      // only fire event when something changed
      this._uriEmitter.fire(uri);
    }
    return deco;
  }
}

// 将 IDecorationData 转成 `${color}/${letter}` 形式
function keyOfDecorationRule(data: IDecorationData | IDecorationData[]): string {
  const list = asArray(data);
  return list.map(({ color, letter }) => `${color}/${letter}`).join(',');
}

function getDecorationRule(data: IDecorationData | IDecorationData[]): IDecoration | undefined {
  const list = asArray(data);
  if (!list.length) {
    // 前置拦截(目前代码逻辑是不会进来的)
    /* istanbul ignore next */
    return;
  }

  return {
    // 获取 color/letter 生成的 唯一键 key
    key: keyOfDecorationRule(data),
    // label
    color: list[0].color,
    // badge
    badge: list
      .filter((d) => !isFalsyOrWhitespace(d.letter))
      .map((d) => d.letter)
      .join(','),
    tooltip: list
      .filter((d) => !isFalsyOrWhitespace(d.tooltip))
      .map((d) => d.tooltip)
      .join(' • '),
  };
}

@Injectable()
export class FileDecorationsService extends Disposable implements IDecorationsService {
  private readonly logger = getDebugLogger();

  private readonly _data = new LinkedList<DecorationProviderWrapper>();
  private readonly _onDidChangeDecorationsDelayed = new Emitter<Uri | Uri[]>();
  private readonly _onDidChangeDecorations = new Emitter<IResourceDecorationChangeEvent>();

  readonly onDidChangeDecorations: Event<IResourceDecorationChangeEvent> = Event.any(
    this._onDidChangeDecorations.event,
    Event.debounce<Uri | Uri[], FileDecorationChangeEvent>(
      this._onDidChangeDecorationsDelayed.event,
      FileDecorationChangeEvent.debouncer, // todo: remove it
      undefined,
      undefined,
      500,
    ),
  );

  dispose(): void {
    dispose(this._onDidChangeDecorations);
    dispose(this._onDidChangeDecorationsDelayed);
  }

  registerDecorationsProvider(provider: IDecorationsProvider): IDisposable {
    this.logger.log('DecorationService#registerDecorationsProvider', provider);

    const wrapper = new DecorationProviderWrapper(
      provider,
      this._onDidChangeDecorationsDelayed,
      this._onDidChangeDecorations,
    );
    const remove = this._data.push(wrapper);

    this._onDidChangeDecorations.fire({
      // everything might have changed
      affectsResource() {
        return true;
      },
    });

    return toDisposable(() => {
      // fire event that says 'yes' for any resource
      // known to this provider. then dispose and remove it.
      remove();
      this._onDidChangeDecorations.fire({ affectsResource: (uri) => wrapper.knowsAbout(uri) });
      wrapper.dispose();
    });
  }

  getDecoration(uri: Uri, includeChildren: boolean): IDecoration | undefined {
    const data: IDecorationData[] = [];
    let containsChildren = false;
    for (let iter = this._data.iterator(), next = iter.next(); !next.done; next = iter.next()) {
      next.value.getOrRetrieve(uri, includeChildren, (deco, isChild) => {
        if (!isChild || deco.bubble) {
          data.push(deco);
          containsChildren = isChild || containsChildren;
        }
      });
    }

    if (data.length === 0) {
      return undefined;
    } else {
      const result = this.asDecoration(data, containsChildren);
      return result;
    }
  }

  asDecoration(data: IDecorationData[], containsChildren: boolean): IDecoration | undefined {
    // sort by weight
    data.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const rule = getDecorationRule(data);

    if (rule && containsChildren) {
      // 目录下文件修改过则仅显示一个圆点并统一 tooltip
      // show items from its children only
      rule.badge = '•';
      rule.tooltip = localize('bubbleTitle', 'Contains emphasized items');
    }

    return rule;
  }
}
