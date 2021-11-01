import { IRPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { Emitter } from '@ali/ide-core-common';
import { ExtHostKaitianAPIIdentifier, MainThreadKaitianAPIIdentifier } from '../../../../src/common/kaitian';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostCommands } from '../../../../src/hosted/api/vscode/ext.host.command';
import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';

import { createToolbarAPIFactory, ExtHostToolbarActionService } from '@ali/ide-kaitian-extension/lib/hosted/api/kaitian/ext.host.toolbar';
import { ExtHostCommon } from '@ali/ide-kaitian-extension/lib/hosted/api/kaitian/ext.host.common';
import { mockExtensions } from '../../../../__mocks__/extensions';

const actionMaps: Map<string, any> = new Map();

const mockMainThreadToolbarProxy = {
  $registerToolbarButtonAction: jest.fn((extensionId: string, extensionPath: string, contribution: any) => {
    actionMaps.set(contribution.id, contribution);
  }),

  $registerToolbarSelectAction: jest.fn((extensionId: string, extensionPath: string, contribution: any) => {
    actionMaps.set(contribution.id, contribution);
  }),
};

const mockMainthreadCommon = {
  $subscribeEvent(eventName: string) {

  },
  $unSubscribeEvent(eventName: string) {

  },
};

const emitter = new Emitter();

const mockMainthreadCommand = {
  $executeCommand(id, ...args) {
    switch (id) {
      case 'kaitian-extension.toolbar.btn.setState':
      case 'kaitian-extension.toolbar.select.setState':
        const [actionId, state] = args;
        emitter.fire({
          id,
          actionId,
          state,
        });
        break;
      default:
        return Promise.resolve(id);
    }
    return Promise.resolve(id);
  },
};

const map = new Map();

const rpcProtocol: IRPCProtocol = {
  getProxy: (key) => {
    return map.get(key);
  },
  set: (key, value) => {
    map.set(key, value);
    return value;
  },
  get: (r) => map.get(r),
};

const extension = mockExtensions[0];

describe('packages/kaitian-extension/__tests__/hosted/api/kaitian/ext.host.toolbar.test.ts', () => {
  let extHostToolbar: ExtHostToolbarActionService;
  let extHostCommon: ExtHostCommon;
  let extHostCommands: ExtHostCommands;
  let toolbarAPI: ReturnType<typeof createToolbarAPIFactory>;

  emitter.event((e) => {
    /** tslint:disabled */
    let eventName;
     // @ts-ignore
    if (e.id === 'kaitian-extension.toolbar.select.setState') {
      eventName = 'kaitian-extension.toolbar.select.stateChange';
     // @ts-ignore
    } else if (e.id === 'kaitian-extension.toolbar.btn.setState') {
      eventName = 'kaitian-extension.toolbar.btn.stateChange';
    }
    // @ts-ignore
    extHostCommon.$acceptEvent(eventName, [e.actionId, e.state]);
  });

  const injector = createBrowserInjector([]);
  beforeAll(() => {
    rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadCommon, mockMainthreadCommon as any);
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mockMainthreadCommand as any);
    extHostCommon = injector.get(ExtHostCommon, [rpcProtocol]);
    extHostCommands = injector.get(ExtHostCommands, [rpcProtocol]);
    rpcProtocol.set(MainThreadKaitianAPIIdentifier.MainThreadToolbar, mockMainThreadToolbarProxy as any);
    rpcProtocol.set(ExtHostKaitianAPIIdentifier.ExtHostCommon, extHostCommon);
    extHostToolbar = injector.get(ExtHostToolbarActionService, [extHostCommands, extHostCommon, rpcProtocol]);
    toolbarAPI = createToolbarAPIFactory(extension, extHostToolbar);
  });

  it('toolbarAPI#registerToolbarAction button should be work', async (done) => {
    const id = `${extension.id}-toolbar`;
    await toolbarAPI.registerToolbarAction({
      id,
      type: 'button',
      title: 'test toolbar',
      iconPath: '/path/to/toolbar.svg',
      description: 'test for toolbar button action',
      states: {
        'default': {
          'background': '#ff004f',
        },
        'hover': {
          'background': '#ffffff',
        },
      },
    });

    const hostAction = await toolbarAPI.getToolbarActionButtonHandle(id);
    expect(hostAction).toBeDefined();
    done();
  });

  it('toolbarAPI#registerToolbarAction button setState should be work', async (done) => {
    const id = `${extension.id}-toolbar`;
    const hostAction = await toolbarAPI.getToolbarActionButtonHandle(id);
    hostAction.onStateChanged((e) => {
      expect(e.from).toBe('hover');
      done();
    });

    await hostAction.setState('hover');
  });

  it('toolbarAPI#registerToolbarAction select should be work', async (done) => {
    const id = `${extension.id}-toolbar-select`;
    await toolbarAPI.registerToolbarAction({
      id,
      type: 'select',
      options: [
        {
          label: 'Test Label 1',
          value: 'test-label-1',
        },
      ],
      states: {
        'default': {
          'backgroundColor': '#ff004f',
        },
        'selected': {
          'backgroundColor': '#000000',
        },
      },
      defaultValue: 'test-label-1',
      description: 'test for toolbar select action',
    });

    const hostAction = await toolbarAPI.getToolbarActionSelectHandle(id);
    expect(hostAction).toBeDefined();
    done();
  });

  it('toolbarAPI#registerToolbarAction select setState should be work', async (done) => {
    const id = `${extension.id}-toolbar-select`;
    const hostAction = await toolbarAPI.getToolbarActionSelectHandle(id);
    hostAction.onStateChanged((e) => {
      expect(e.from).toBe('selected');
      done();
    });

    await hostAction.setState('selected');
  });

});
