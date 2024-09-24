import { ProxyIdentifier } from '@opensumi/ide-connection';
import { Deferred, ILoggerManagerClient, IReporter } from '@opensumi/ide-core-common';
import { REPORT_NAME } from '@opensumi/ide-core-common';
import { AppConfig, DefaultReporter } from '@opensumi/ide-core-node';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MainThreadExtensionLog } from '../../../../__mocks__/api/mainthread.extension.log';
import { MainThreadExtensionService } from '../../../../__mocks__/api/mainthread.extension.service';
import { MainThreadStorage } from '../../../../__mocks__/api/mathread.storage';
import { mockExtensionProps, mockExtensionProps2 } from '../../../../__mocks__/extensions';
import { createMockPairRPCProtocol } from '../../../../__mocks__/initRPCProtocol';
import { ExtHostAppConfig } from '../../../../src/common/ext.process';
import { ExtHostAPIIdentifier, IExtHostLocalization } from '../../../../src/common/vscode';
import ExtensionHostServiceImpl from '../../../../src/hosted/ext.host';

describe('Extension process test', () => {
  describe('RPCProtocol', () => {
    const proxyMaps = new Map();
    let extHostImpl: ExtensionHostServiceImpl;
    let injector: MockInjector;

    beforeEach(async () => {
      injector = createBrowserInjector([]);
      injector.addProviders(
        {
          token: ExtHostAppConfig,
          useValue: {
            builtinCommands: [
              {
                id: 'test:builtinCommand:test',
                handler: () => 'fake token',
              },
            ],
          },
        },
        {
          token: IReporter,
          useClass: DefaultReporter,
        },
      );

      const { rpcProtocolExt, rpcProtocolMain } = createMockPairRPCProtocol();
      rpcProtocolExt.set(ProxyIdentifier.for('MainThreadExtensionService'), new MainThreadExtensionService());
      rpcProtocolExt.set(ProxyIdentifier.for('MainThreadStorage'), new MainThreadStorage());
      rpcProtocolExt.set(ProxyIdentifier.for('MainThreadExtensionLog'), new MainThreadExtensionLog());

      extHostImpl = new ExtensionHostServiceImpl(
        rpcProtocolMain,
        injector.get(ILoggerManagerClient).getLogger(),
        injector,
      );

      const localization = rpcProtocolMain.get<IExtHostLocalization>(ExtHostAPIIdentifier.ExtHostLocalization);
      localization.$setCurrentLanguage('en');
      await extHostImpl.init();
      await extHostImpl.$updateExtHostData();
    });

    afterEach(async () => {
      await injector.disposeAll();
      proxyMaps.clear();
    });

    it('should init extensions', async () => {
      await extHostImpl.$updateExtHostData();
      const extensions = extHostImpl.$getExtensions();
      const ext = extHostImpl.getExtension(mockExtensionProps.id);
      expect(extensions[0].id).toBe(mockExtensionProps.id);
      expect(extensions[1].id).toBe(mockExtensionProps2.id);
      expect(ext?.id).toBe(mockExtensionProps.id);
    });

    it('should activate extension', async () => {
      const id = mockExtensionProps.id;
      try {
        await extHostImpl.$activateExtension(id);
      } catch (err) {
        // expected error
      }
      expect(extHostImpl.isActivated(id)).toBe(true);
      expect(extHostImpl.getExtendExports(id)).toEqual({});
      expect(extHostImpl.getExtensionExports(id)).toEqual({});
    });

    it('should caught runtime error', async () => {
      expect.assertions(3);
      const defered = new Deferred();

      const id = mockExtensionProps2.id;
      const reporter = injector.get(IReporter);
      jest.spyOn(reporter, 'point').mockImplementation((msg: string, data: any) => {
        if (msg === REPORT_NAME.RUNTIME_ERROR_EXTENSION) {
          expect(typeof data.extra.error).toBeTruthy();
          expect(data.extra.stackTraceMessage).toMatch(/Test caught exception/);
          defered.resolve();
        }
      });

      await expect(async () => {
        await extHostImpl.$activateExtension(id);
      }).rejects.toThrow('Test caught exception');
      await defered.promise;
    });

    it('should caught runtime unexpected error', (done) => {
      const reporter = injector.get(IReporter);

      jest.spyOn(extHostImpl as any, 'findExtension').mockImplementation(() => mockExtensionProps2);
      jest.spyOn(reporter, 'point').mockImplementation((msg: string, data: any) => {
        if (msg === REPORT_NAME.RUNTIME_ERROR_EXTENSION) {
          expect(typeof data.extra.error).toBeTruthy();
          expect(data.extra.stackTraceMessage).toMatch(/This is unexpected error/);
          done();
        }
      });
      extHostImpl.reportUnexpectedError(new Error('This is unexpected error'));
    });
  });
});
