import type vscode from 'vscode';

import {
  Event,
  Uri,
  UriComponents,
  URI,
  Emitter,
  CancellationTokenSource,
  CancellationToken,
} from '@opensumi/ide-core-common';
import { ExtHostDecorations } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.decoration';

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

  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    service = new ExtHostDecorations(mockRpcProtocol as any);

    process.env.KTLOG_SHOW_DEBUG = '1';
  });

  afterEach(() => {
    mock$onDidChange.mockRestore();
    $decoProviders.clear();
    service['_provider'].clear();
    ExtHostDecorations['_handlePool'] = 0; // reset _handlePool

    errorSpy.mockRestore();
    warnSpy.mockRestore();

    process.env.KTLOG_SHOW_DEBUG = undefined;
  });

  it('empty result', async () => {
    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(URI.file('/workspace/test/a.ts')),
    };

    expect(await service.$provideFileDecorations([request], new CancellationTokenSource().token)).toEqual({});
  });

  it('ok for async provider', async () => {
    let callCounter = 0;

    const extDecoProvider = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        callCounter += 1;
        return new Promise<vscode.FileDecoration>((resolve) => {
          setTimeout(() =>
            resolve({
              badge: 'A',
              tooltip: 'Modified changes',
              color: { id: 'green' },
              propagate: false,
            }),
          );
        });
      }
    })();

    const disposable = service.registerFileDecorationProvider(extDecoProvider, 'mock-ext-async-id');

    extDecoProvider.onDidChangeDecorationsEmitter.fire(undefined as any);
    expect(mock$onDidChange).toBeCalledTimes(1);
    expect(mock$onDidChange).toBeCalledWith(0, null);

    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(URI.file('/workspace/test/a.ts')),
    };

    const decoReply = service.$provideFileDecorations([request], new CancellationTokenSource().token);
    jest.runAllTimers();
    jest.runAllTicks();

    const result = await decoReply;

    // trigger -> async
    expect(result).toEqual({
      121: [false, 'Modified changes', 'A', { id: 'green' }],
    });
    expect(callCounter).toBe(1);

    disposable.dispose();

    expect(await service.$provideFileDecorations([request], new CancellationTokenSource().token)).toEqual({});
    expect(service['_provider'].size).toBe(0);
  });

  it('ok for sync provider', async () => {
    let callCounter = 0;

    const extDecoProvider = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;

      provideFileDecoration(uri: Uri, token: CancellationToken) {
        callCounter += 1;
        return {
          badge: 'S',
          tooltip: 'Modified changes',
          color: { id: 'green' },
        };
      }
    })();

    const disposable = service.registerFileDecorationProvider(extDecoProvider, 'mock-ext-sync-id');

    const uri = Uri.file('file://workspace/test/a.ts');

    extDecoProvider.onDidChangeDecorationsEmitter.fire([uri]);
    expect(mock$onDidChange).toBeCalledTimes(1);
    expect(mock$onDidChange).toBeCalledWith(0, [uri]);

    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(new URI(uri)),
    };

    const result = await service.$provideFileDecorations([request], new CancellationTokenSource().token);
    // trigger -> sync
    expect(result).toEqual({
      121: [false, 'Modified changes', 'S', { id: 'green' }],
    });
    expect(callCounter).toBe(1);

    disposable.dispose();

    expect(await service.$provideFileDecorations([request], new CancellationTokenSource().token)).toEqual({});
    expect(service['_provider'].size).toBe(0);
  });

  it('multi decorations', async () => {
    const extDecoProvider1 = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;

      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return {
          badge: 'S',
          tooltip: 'Modified changes',
          color: { id: 'green' },
          propagate: true,
        };
      }
    })();

    const extDecoProvider2 = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return new Promise<vscode.FileDecoration>((resolve) => {
          setTimeout(() =>
            resolve({
              badge: 'A',
              tooltip: 'Modified changes',
              color: { id: 'green' },
              propagate: true,
            }),
          );
        });
      }
    })();

    const disposable1 = service.registerFileDecorationProvider(extDecoProvider1, 'mock-ext-id-1');

    const disposable2 = service.registerFileDecorationProvider(extDecoProvider2, 'mock-ext-id-2');

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

    const decoReply = service.$provideFileDecorations(
      [request1, request2, request3],
      new CancellationTokenSource().token,
    );
    jest.runAllTimers();
    jest.runAllTicks();

    const result = await decoReply;
    // trigger -> async
    expect(result).toEqual({
      121: [false, 'Modified changes', 'S', { id: 'green' }],
      122: [false, 'Modified changes', 'A', { id: 'green' }],
    });

    disposable1.dispose();
    disposable2.dispose();

    expect(
      await service.$provideFileDecorations([request1, request2, request3], new CancellationTokenSource().token),
    ).toEqual({});
    expect(service['_provider'].size).toBe(0);
  });

  it('decoration badge length !== 1', async () => {
    const extDecoProvider = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorations = Event.None;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return {
          badge: 'TWO',
          tooltip: 'Modified changes',
          color: { id: 'green' },
          propagate: true,
          source: 'sync',
        };
      }
    })();

    service.registerFileDecorationProvider(extDecoProvider, 'mock-ext-sync-id');

    const uri = Uri.file('file://workspace/test/a.ts');
    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(new URI(uri)),
    };

    const result = await service.$provideFileDecorations([request], new CancellationTokenSource().token);
    // trigger -> sync
    expect(result).toEqual({
      121: [false, 'Modified changes', 'TWO', { id: 'green' }],
    });
    expect(warnSpy.mock.calls[0][1]).toBe(
      "INVALID decoration from extension 'mock-ext-sync-id'. The 'badge' must be set and be one character, not 'TWO'.",
    );
  });

  it('provideFileDecoration rejection', async () => {
    const extDecoProvider = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorations = Event.None;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return Promise.reject('provideFileDecoration throws');
      }
    })();

    service.registerFileDecorationProvider(extDecoProvider, 'mock-ext-sync-id');

    const uri = Uri.file('file://workspace/test/a.ts');
    const request = {
      id: 121,
      handle: 0,
      uri: URI2UriComponents(new URI(uri)),
    };

    const result = await service.$provideFileDecorations([request], new CancellationTokenSource().token);
    // trigger -> sync
    expect(result).toEqual({});
    expect(errorSpy.mock.calls[0][1]).toBe('provideFileDecoration throws');
  });

  it('compatible onChange', async () => {
    const extDecoProvider = new (class implements vscode.FileDecorationProvider {
      onDidChangeEmitter = new Emitter<Uri[]>();
      onDidChange = this.onDidChangeEmitter.event;

      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return {
          badge: 'S',
          tooltip: 'Modified changes',
          color: { id: 'green' },
          propagate: true,
          source: 'sync',
        };
      }
    })();

    service.registerFileDecorationProvider(extDecoProvider, 'mock-ext-onChange-id');

    const uri = Uri.file('file://workspace/test/a.ts');

    extDecoProvider.onDidChangeEmitter.fire([uri]);
    expect(mock$onDidChange).toBeCalledTimes(1);
    expect(mock$onDidChange).toBeCalledWith(0, [uri]);
  });
});
