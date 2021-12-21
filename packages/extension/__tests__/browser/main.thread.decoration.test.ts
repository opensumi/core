import { Injector } from '@opensumi/di';
import { RPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { createWindowApiFactory } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.window.api.impl';
import { MainThreadDecorations } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.decoration';
import {
  IMainThreadEnv,
  MainThreadAPIIdentifier,
  ExtHostAPIIdentifier,
} from '@opensumi/ide-extension/lib/common/vscode';
import { FileDecorationsService } from '@opensumi/ide-decoration/lib/browser/decorationsService';
import { IDecorationsService } from '@opensumi/ide-decoration';
import type vscode from 'vscode';
import { Event, Uri, Emitter, DisposableCollection } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';

import ExtensionHostextWindowAPIImpl from '../../src/hosted/ext.host';
import { ExtHostDecorations } from '../../src/hosted/api/vscode/ext.host.decoration';
import { mockExtensions } from '../../__mocks__/extensions';

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};

const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);
const rpcProtocolMain = new RPCProtocol(mockClientB);

describe('MainThreadDecorationAPI Test Suites ', () => {
  const injector = createBrowserInjector([], new Injector([]));
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
      );
      done();
    }, 0);

    decorationsService = injector.get(IDecorationsService);
  });

  afterEach(() => {
    toTearDown.dispose();
  });

  it('ok for API', (done) => {
    expect(typeof extWindowAPI.registerDecorationProvider).toBe('function');
    done();
  });

  it('ok for registerDecorationProvider', async () => {
    const extDecoProvider = new (class implements vscode.DecorationProvider {
      onDidChangeDecorationsEmitter = new Emitter<Uri[]>();
      onDidChangeDecorations = this.onDidChangeDecorationsEmitter.event;
      provideDecoration() {
        return {
          letter: 'S',
          title: 'ZZ',
          color: { id: 'green' },
          priority: 1,
          bubble: true,
          source: 'sync',
        };
      }
    })();

    const disposable = extWindowAPI.registerDecorationProvider(extDecoProvider);
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
    const extDecoProvider1 = new (class implements vscode.DecorationProvider {
      onDidChangeDecorations = Event.None;
      provideDecoration() {
        return {
          letter: 'S',
          title: 'ZZ',
          color: { id: 'green' },
          priority: 1,
          bubble: false,
          source: 'sync',
        };
      }
    })();

    const extDecoProvider2 = new (class implements vscode.DecorationProvider {
      onDidChangeDecorations = Event.None;
      provideDecoration() {
        return new Promise<vscode.Decoration>((resolve) => {
          setTimeout(() =>
            resolve({
              letter: 'A',
              title: 'Modified changes',
              color: { id: 'green' },
              priority: 1,
              bubble: false,
              source: 'async',
            }),
          );
        });
      }
    })();

    const disposable1 = extWindowAPI.registerDecorationProvider(extDecoProvider1);
    const disposable2 = extWindowAPI.registerDecorationProvider(extDecoProvider2);

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
