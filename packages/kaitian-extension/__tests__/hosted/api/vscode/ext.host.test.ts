import { Deferred  } from '@ali/ide-core-common/lib';
import { Injector } from '@ali/common-di';
import ExtensionHostServiceImpl from '@ali/ide-kaitian-extension/lib/hosted/ext.host';

import { mockExtensionProps } from '../../../__mock__/extensions';
import { initMockRPCProtocol } from '../../../__mock__/initRPCProtocol';
import { MainThreadExtensionService } from '../../../__mock__/api/mainthread.extension.service';
import { MainThreadStorage } from '../../../__mock__/api/mathread.storage';
import { MainThreadExtensionLog } from '../../../__mock__/api/mainthread.extension.log';
import { MockLoggerManagerClient } from '../../../__mock__/loggermanager';
import { AppConfig } from '@ali/ide-core-node';

const enum MessageType {
  Request = 1,
  Reply = 2,
  ReplyErr = 3,
  Cancel = 4,
}
const mockLoggger = (new MockLoggerManagerClient()).getLogger();

describe('Extension process test', () => {
  describe('RPCProtocol', () => {
    let extHostImpl: ExtensionHostServiceImpl;
    const injector: Injector = new Injector();

    beforeAll((done) => {
      injector.addProviders({
        token: AppConfig, useValue: {
          builtinCommands: [
            {
              id: 'test:builtinCommand:test',
              handler: () => {
                return 'fake token';
              },
            },
          ],
        },
      });
      initMockRPCProtocol(mockClient)
        .then((value) => {
          extHostImpl = new ExtensionHostServiceImpl(value, mockLoggger, injector);
          return extHostImpl.init();
        })
        .then((res) => {
          done();
        });
    });
    const proxyMaps = new Map();
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
            const raw = `{"type": ${MessageType.Reply}, "id": "${message.id}", "res": ${JSON.stringify(result || '')}}`;
            (await fn)(raw);
          }
        } else {
          // tslint:disable-next-line
          console.log(`lost proxy ${message.proxyId} - ${message.method}`);
        }
      },
      onMessage: (fn) => handler.resolve(fn),
    };

    it('should init extensions', async (done) => {
      await extHostImpl.$initExtensions();
      const extensions = extHostImpl.$getExtensions();
      const ext = extHostImpl.getExtension(mockExtensionProps.id);
      expect(extensions).toEqual([mockExtensionProps]);
      expect(ext?.id).toBe(mockExtensionProps.id);

      done();
    });

    it('should activate extension', async (done) => {
      const id = mockExtensionProps.id;
      await extHostImpl.$activateExtension(id);
      expect(extHostImpl.isActivated(id)).toBe(true);
      expect(extHostImpl.getExtendExports(id)).toEqual({});
      expect(extHostImpl.getExtensionExports(id)).toEqual({});
      done();
    }, 5000);
  });
});
