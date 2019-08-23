import URI from 'vscode-uri';
import { Event, Emitter, CancellationTokenSource, localize, isThenable } from '@ali/ide-core-common';
import { IDisposable, toDisposable, dispose } from '@ali/ide-core-common/lib/disposable';
import { isPromiseCanceledError } from '@ali/ide-core-common/lib/errors';
import { TernarySearchTree } from '@ali/ide-core-common/lib/map';
import { LinkedList } from '@ali/ide-core-common/lib/linked-list';
import { getLogger } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';

import {
  IDecorationsService, IDecoration, IResourceDecorationChangeEvent,
  IDecorationsProvider, IDecorationData,
} from '../common/decorations';

class FileDecorationChangeEvent implements IResourceDecorationChangeEvent {

  private readonly _data = TernarySearchTree.forPaths<boolean>();

  affectsResource(uri: URI): boolean {
    return this._data.get(uri.toString()) || this._data.findSuperstr(uri.toString()) !== undefined;
  }

  static debouncer(last: FileDecorationChangeEvent, current: URI | URI[]) {
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
  constructor(
    readonly source: CancellationTokenSource,
    readonly thenable: Promise<void>,
  ) { }
}

class DecorationProviderWrapper {

  readonly data = TernarySearchTree.forPaths<DecorationDataRequest | IDecorationData | null>();
  private readonly _dispoable: IDisposable;

  constructor(
    private readonly _provider: IDecorationsProvider,
    private readonly _uriEmitter: Emitter<URI | URI[]>,
    private readonly _flushEmitter: Emitter<IResourceDecorationChangeEvent>,
  ) {
    this._dispoable = this._provider.onDidChange((uris) => {
      if (!uris) {
        // flush event -> drop all data, can affect everything
        this.data.clear();
        this._flushEmitter.fire({ affectsResource() { return true; } });

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

  knowsAbout(uri: URI): boolean {
    return Boolean(this.data.get(uri.toString())) || Boolean(this.data.findSuperstr(uri.toString()));
  }

  getOrRetrieve(uri: URI, includeChildren: boolean, callback: (data: IDecorationData, isChild: boolean) => void): void {
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

  private _fetchData(uri: URI): IDecorationData | null {

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
      const request = new DecorationDataRequest(source, Promise.resolve(dataOrThenable).then((data) => {
        if (this.data.get(uri.toString()) === request) {
          this._keepItem(uri, data);
        }
      }).catch((err) => {
        if (!isPromiseCanceledError(err) && this.data.get(uri.toString()) === request) {
          this.data.delete(uri.toString());
        }
      }));

      this.data.set(uri.toString(), request);
      return null;
    }
  }

  private _keepItem(uri: URI, data: IDecorationData | undefined): IDecorationData | null {
    const deco = data ? data : null;
    const old = this.data.set(uri.toString(), deco);
    if (deco || old) {
      // only fire event when something changed
      this._uriEmitter.fire(uri);
    }
    return deco;
  }
}

@Injectable()
export class FileDecorationsService implements IDecorationsService {

  _serviceBrand: any;

  private readonly logger = getLogger();
  private readonly _data = new LinkedList<DecorationProviderWrapper>();
  private readonly _onDidChangeDecorationsDelayed = new Emitter<URI | URI[]>();
  private readonly _onDidChangeDecorations = new Emitter<IResourceDecorationChangeEvent>();
  // private readonly _decorationStyles: DecorationStyles;
  private readonly _disposables: IDisposable[];

  readonly onDidChangeDecorations: Event<IResourceDecorationChangeEvent> = Event.any(
    this._onDidChangeDecorations.event,
    Event.debounce<URI | URI[], FileDecorationChangeEvent>(
      this._onDidChangeDecorationsDelayed.event,
      FileDecorationChangeEvent.debouncer as any, // todo: remove it
      undefined, undefined, 500,
    ),
  );

  dispose(): void {
    dispose(this._disposables);
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
      affectsResource() { return true; },
    });

    return toDisposable(() => {
      // fire event that says 'yes' for any resource
      // known to this provider. then dispose and remove it.
      remove();
      this._onDidChangeDecorations.fire({ affectsResource: (uri) => wrapper.knowsAbout(uri) });
      wrapper.dispose();
    });
  }

  getDecoration(uri: URI, includeChildren: boolean, overwrite?: IDecorationData): IDecoration | undefined {
    const data: IDecorationData[] = [];
    let containsChildren: boolean = false;
    for (let iter = this._data.iterator(), next = iter.next(); !next.done; next = iter.next()) {
      next.value.getOrRetrieve(uri, includeChildren, (deco, isChild) => {
        if (!isChild || deco.bubble) {
          data.push(deco);
          containsChildren = isChild || containsChildren;
        }
      });
    }

    if (data.length === 0) {
      // nothing, maybe overwrite data
      if (overwrite) {
        console.log([overwrite], containsChildren);
      } else {
        return undefined;
      }
    } else {
      // result, maybe overwrite
      console.log(data, containsChildren);
      // if (overwrite) {
      //   return result.update(overwrite);
      // } else {
      //   return result;
      // }
    }
  }
}
