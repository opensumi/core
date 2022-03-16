import { Injector } from '@opensumi/di';
import { Deferred, IReporter } from '@opensumi/ide-core-common';
import { REPORT_NAME } from '@opensumi/ide-core-common';
import { AppConfig, DefaultReporter } from '@opensumi/ide-core-node';

import { MainThreadExtensionLog } from '../../../../__mocks__/api/mainthread.extension.log';
import { MainThreadExtensionService } from '../../../../__mocks__/api/mainthread.extension.service';
import { MainThreadStorage } from '../../../../__mocks__/api/mathread.storage';
import { mockExtensionProps, mockExtensionProps2 } from '../../../../__mocks__/extensions';
import { initMockRPCProtocol } from '../../../../__mocks__/initRPCProtocol';
import { MockLoggerManagerClient } from '../../../../__mocks__/loggermanager';
import ExtensionHostServiceImpl from '../../../../src/hosted/ext.host';


const enum MessageType {
  Request = 1,
  Reply = 2,
  ReplyErr = 3,
  Cancel = 4,
}
const mockLoggger = new MockLoggerManagerClient().getLogger();

describe('Extension process test', () => {
  describe('RPCProtocol', () => {
    const proxyMaps = new Map();
    let extHostImpl: ExtensionHostServiceImpl;
    let injector: Injector;

    beforeEach(async () => {
      injector = new Injector();
      injector.addProviders(
        {
          token: AppConfig,
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

      proxyMaps.set('MainThreadExtensionService', new MainThreadExtensionService());
      proxyMaps.set('MainThreadStorage', new MainThreadStorage());
      proxyMaps.set('MainThreadExtensionLog', new MainThreadExtensionLog());

      const handler = new Deferred<(msg) => any>();
      const fn = handler.promise;
      const mockClient = {
        send: async (msg) => {
          const message = JSON.parse(msg);
          const proxy = proxyMaps.get(message.proxyId);
          if (proxy) {
            const result = await proxy[message.method](...message.args);
            if (await fn) {
              const raw = `{"type": ${MessageType.Reply}, "id": "${message.id}", "res": ${JSON.stringify(
                result || '',
              )}}`;
              (await fn)(raw);
            }
          } else {
            // eslint-disable-next-line no-console
            console.log(`lost proxy ${message.proxyId} - ${message.method}`);
          }
        },
        onMessage: (fn) => handler.resolve(fn),
      };
      const rpcProtocol = await initMockRPCProtocol(mockClient);
      extHostImpl = new ExtensionHostServiceImpl(rpcProtocol, mockLoggger, injector);
      await extHostImpl.init();
      await extHostImpl.$updateExtHostData();
    });

    afterEach(() => {
      injector.disposeAll();
      proxyMaps.clear();
    });

    it('should init extensions', async (done) => {
      await extHostImpl.$updateExtHostData();
      const extensions = extHostImpl.$getExtensions();
      const ext = extHostImpl.getExtension(mockExtensionProps.id);
      expect(extensions[0].id).toBe(mockExtensionProps.id);
      expect(extensions[1].id).toBe(mockExtensionProps2.id);
      expect(ext?.id).toBe(mockExtensionProps.id);

      done();
    });

    it('should activate extension', async (done) => {
      const id = mockExtensionProps.id;
      try {
        await extHostImpl.$activateExtension(id);
      } catch (err) {
        // expected error
      }
      expect(extHostImpl.isActivated(id)).toBe(true);
      expect(extHostImpl.getExtendExports(id)).toEqual({});
      expect(extHostImpl.getExtensionExports(id)).toEqual({});
      done();
    });

    it('should caught runtime error', async (done) => {
      const id = mockExtensionProps2.id;
      const reporter = injector.get(IReporter);
      jest.spyOn(reporter, 'point').mockImplementation((msg: string, data: any) => {
        if (msg === REPORT_NAME.RUNTIME_ERROR_EXTENSION) {
          expect(typeof data.extra.error).toBeTruthy();
          expect(data.extra.stackTraceMessage).toMatch(/Test caught exception/);
          done();
        }
      });

      await expect(async () => {
        await extHostImpl.$activateExtension(id);
      }).rejects.toThrow('Test caught exception');
    });

    it('should caught runtime unexpected error', async (done) => {
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
