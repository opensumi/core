// tslint:disable:new-parens
import { Uri, URI, Emitter, CancellationTokenSource, CancellationToken } from '@ali/ide-core-common';
import * as vscode from 'vscode';
import { UriComponents } from 'vscode-uri';

import { ExtHostDecorations } from '../../src/hosted/api/vscode/ext.host.decoration';

function URI2UriComponents(uri: URI): UriComponents {
  return {
    scheme: uri.scheme,
    authority: uri.authority,
    path: uri.codeUri.path,
    query: uri.query,
    fragment: uri.fragment,
  };
}

jest.useFakeTimers();

describe('ExtHostFileSystem', () => {
  const $decoProviders = new Set<number>();
  const mock$onDidChange = jest.fn();
  const mockRpcProtocol = {
    getProxy() {
      return {
        $registerDecorationProvider(handle: number, extId: string) {
          $decoProviders.add(handle);
        },
        $unregisterDecorationProvider(handle: number) {
          $decoProviders.delete(handle);
        },
        $onDidChange: mock$onDidChange,
      };
    },
  };

  let service: ExtHostDecorations;

  beforeEach(() => {
    service = new ExtHostDecorations(mockRpcProtocol as any);
  });

  afterEach(() => {
    mock$onDidChange.mockRestore();
    $decoProviders.clear();
    service['_provider'].clear();
    ExtHostDecorations['_handlePool'] = 0; // reset _handlePool
  });

  it('empty result', async () => {
    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(URI.file('/workspace/test/a.ts')),
    };

    expect(
      await service.$provideDecorations([request], new CancellationTokenSource().token),
    ).toEqual({});
  });

  it('ok for async provider', async () => {
    let callCounter = 0;

    const extDecoProvider = new class implements vscode.DecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
      provideDecoration(uri: Uri, token: CancellationToken) {
        callCounter += 1;
        return new Promise<vscode.DecorationData>((resolve) => {
          setTimeout(() => {
            return resolve({
              letter: 'A',
              title: 'Modified changes',
              color: { id: 'green' },
              priority: 1,
              bubble: false,
              source: 'async',
            });
          });
        });
      }
    };

    const disposable = service.registerDecorationProvider(
      extDecoProvider,
      'mock-ext-async-id',
    );

    extDecoProvider.onDidChangeDecorationsEmitter.fire(undefined as any);
    expect(mock$onDidChange).toBeCalledTimes(1);
    expect(mock$onDidChange).toBeCalledWith(0, null);

    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(URI.file('/workspace/test/a.ts')),
    };

    const decoReply = service.$provideDecorations([request], new CancellationTokenSource().token);
    jest.runAllTimers();
    jest.runAllTicks();

    const result = await decoReply;

    // trigger -> async
    expect(result).toEqual({
      121: [
        1,
        false,
        'Modified changes',
        'A',
        { id: 'green' },
        'async',
      ],
    });
    expect(callCounter).toBe(1);

    disposable.dispose();

    expect(
      await service.$provideDecorations([request], new CancellationTokenSource().token),
    ).toEqual({});
    expect(service['_provider'].size).toBe(0);
  });

  it('ok for sync provider', async () => {
    let callCounter = 0;

    const extDecoProvider = new class implements vscode.DecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;

      provideDecoration(uri: Uri, token: CancellationToken) {
        callCounter += 1;
        return {
          letter: 'S',
          title: 'Modified changes',
          color: { id: 'green' },
          priority: 1,
          bubble: false,
          source: 'sync',
        };
      }
    };

    const disposable = service.registerDecorationProvider(
      extDecoProvider,
      'mock-ext-sync-id',
    );

    const uri = Uri.file('file://workspace/test/a.ts');

    extDecoProvider.onDidChangeDecorationsEmitter.fire([ uri ]);
    expect(mock$onDidChange).toBeCalledTimes(1);
    expect(mock$onDidChange).toBeCalledWith(0, [uri]);

    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(new URI(uri)),
    };

    const result = await service.$provideDecorations([request], new CancellationTokenSource().token);
    // trigger -> sync
    expect(result).toEqual({
      121: [
        1,
        false,
        'Modified changes',
        'S',
        { id: 'green' },
        'sync',
      ],
    });
    expect(callCounter).toBe(1);

    disposable.dispose();

    expect(
      await service.$provideDecorations([request], new CancellationTokenSource().token),
    ).toEqual({});
    expect(service['_provider'].size).toBe(0);
  });

  it('multi decorations', async () => {
    const extDecoProvider1 = new class implements vscode.DecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;

      provideDecoration(uri: Uri, token: CancellationToken) {
        return {
          letter: 'S',
          title: 'Modified changes',
          color: { id: 'green' },
          priority: 1,
          bubble: false,
          source: 'sync',
        };
      }
    };

    const extDecoProvider2 = new class implements vscode.DecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
      provideDecoration(uri: Uri, token: CancellationToken) {
        return new Promise<vscode.DecorationData>((resolve) => {
          setTimeout(() => {
            return resolve({
              letter: 'A',
              title: 'Modified changes',
              color: { id: 'green' },
              priority: 1,
              bubble: false,
              source: 'async',
            });
          });
        });
      }
    };

    const disposable1 = service.registerDecorationProvider(
      extDecoProvider1,
      'mock-ext-id-1',
    );

    const disposable2 = service.registerDecorationProvider(
      extDecoProvider2,
      'mock-ext-id-2',
    );

    const uri = URI.file('workspace/test/a.ts');
    const request1 = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(uri),
    };

    const request2 = {
      id: 122,
      handle: 1,
      uri: URI2UriComponents(uri),
    };

    const request3 = {
      id: 123,
      handle: 2,
      uri: URI2UriComponents(uri),
    };

    const decoReply = service.$provideDecorations([request1, request2, request3], new CancellationTokenSource().token);
    jest.runAllTimers();
    jest.runAllTicks();

    const result = await decoReply;
    // trigger -> async
    expect(result).toEqual({
      121: [
        1,
        false,
        'Modified changes',
        'S',
        { id: 'green' },
        'sync',
      ],
      122: [
        1,
        false,
        'Modified changes',
        'A',
        { id: 'green' },
        'async',
      ],
    });

    disposable1.dispose();
    disposable2.dispose();

    expect(
      await service.$provideDecorations([request1, request2, request3], new CancellationTokenSource().token),
    ).toEqual({});
    expect(service['_provider'].size).toBe(0);
  });
});
