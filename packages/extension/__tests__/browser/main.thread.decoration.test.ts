import { CancellationToken, DisposableCollection, Emitter, Event, Uri } from '@opensumi/ide-core-common';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { FileDecorationsService } from '@opensumi/ide-decoration/lib/browser/decorationsService';
import { MainThreadDecorations } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.decoration';
import {
  ExtHostAPIIdentifier,
  IMainThreadEnv,
  MainThreadAPIIdentifier,
} from '@opensumi/ide-extension/lib/common/vscode';
import { createWindowApiFactory } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.window.api.impl';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { mockExtensions } from '../../__mocks__/extensions';
import { createMockPairRPCProtocol } from '../../__mocks__/initRPCProtocol';
import { ExtHostDecorations } from '../../src/hosted/api/vscode/ext.host.decoration';
import ExtensionHostextWindowAPIImpl from '../../src/hosted/ext.host';

import type vscode from 'vscode';

const { rpcProtocolExt, rpcProtocolMain } = createMockPairRPCProtocol();

describe('MainThreadDecorationAPI Test Suites', () => {
  const injector = createBrowserInjector([]);
  let extWindowAPI: ReturnType<typeof createWindowApiFactory>;
  let extHostDecorations: ExtHostDecorations;
  let decorationsService: IDecorationsService;
  let mainThreadDecorations: MainThreadDecorations;

  const toTearDown = new DisposableCollection();

  beforeAll((done) => {
    injector.addProviders(
      {
        token: ExtensionHostextWindowAPIImpl,
        useValue: {
          enableProposedApi: true,
        },
      },
      {
        token: IDecorationsService,
        useClass: FileDecorationsService,
      },
    );

    extHostDecorations = rpcProtocolExt.set(
      ExtHostAPIIdentifier.ExtHostDecorations,
      new ExtHostDecorations(rpcProtocolExt),
    );
    mainThreadDecorations = injector.get(MainThreadDecorations, [rpcProtocolMain]);
    rpcProtocolMain.set<IMainThreadEnv>(MainThreadAPIIdentifier.MainThreadDecorations, mainThreadDecorations);
    setTimeout(() => {
      extWindowAPI = createWindowApiFactory(
        mockExtensions[0],
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        extHostDecorations,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      done();
    }, 0);

    decorationsService = injector.get(IDecorationsService);
  });

  afterEach(() => {
    toTearDown.dispose();
  });

  it('ok for API', (done) => {
    expect(typeof extWindowAPI.registerFileDecorationProvider).toBe('function');
    done();
  });

  it('ok for registerDecorationProvider', async () => {
    const extDecoProvider = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return {
          badage: 'S',
          tooltip: 'ZZ',
          color: { id: 'green' },
        };
      }
    })();

    const disposable = extWindowAPI.registerFileDecorationProvider(extDecoProvider);
    toTearDown.push(disposable);

    const uri = Uri.file('workspace/test/a.ts');

    return Event.toPromise(decorationsService.onDidChangeDecorations).then((e) => {
      expect(e.affectsResource(uri)).toBeTruthy();
      expect(decorationsService['_data'].size).toBe(1);

      mainThreadDecorations.dispose();
      expect(mainThreadDecorations['_provider'].size).toBe(0);
    });
  });

  it('multi decorations', async () => {
    const extDecoProvider1 = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorations = Event.None;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return {
          badge: 'M',
          tooltip: 'Modified changes',
          color: { id: 'green' },
          propagate: true,
        };
      }
    })();

    const extDecoProvider2 = new (class implements vscode.FileDecorationProvider {
      onDidChangeDecorations = Event.None;
      provideFileDecoration(uri: Uri, token: CancellationToken) {
        return new Promise<vscode.FileDecoration>((resolve) => {
          setTimeout(() =>
            resolve({
              badge: 'M',
              tooltip: 'Modified changes',
              color: { id: 'green' },
              propagate: true,
            }),
          );
        });
      }
    })();

    const disposable1 = extWindowAPI.registerFileDecorationProvider(extDecoProvider1);
    const disposable2 = extWindowAPI.registerFileDecorationProvider(extDecoProvider2);

    toTearDown.push(disposable1);
    toTearDown.push(disposable2);

    const uri = Uri.file('workspace/test/a.ts');

    return Event.toPromise(decorationsService.onDidChangeDecorations).then((e) => {
      expect(e.affectsResource(uri)).toBeTruthy();

      expect(decorationsService['_data'].size).toBe(2);

      disposable1.dispose();
      return Event.toPromise(decorationsService.onDidChangeDecorations).then(() => {
        expect(decorationsService['_data'].size).toBe(1);
      });
    });
  });
});
