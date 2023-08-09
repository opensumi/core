import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Deferred, Emitter } from '@opensumi/ide-core-common';
import { ExtHostCommon } from '@opensumi/ide-extension/lib/hosted/api/sumi/ext.host.common';
import {
  createToolbarAPIFactory,
  ExtHostToolbarActionService,
} from '@opensumi/ide-extension/lib/hosted/api/sumi/ext.host.toolbar';

import { createBrowserInjector } from '../../../../../../tools/dev-tool/src/injector-helper';
import { mockExtensions } from '../../../../__mocks__/extensions';
import { ExtHostSumiAPIIdentifier, MainThreadSumiAPIIdentifier } from '../../../../src/common/sumi';
import {
  BUTTON_SET_STATE_ID,
  BUTTON_STATE_CHANGE_ID,
  SELECT_SET_STATE_ID,
  SELECT_STATE_CHANGE_ID,
} from '../../../../src/common/sumi/toolbar';
import { MainThreadAPIIdentifier } from '../../../../src/common/vscode';
import { ExtHostCommands } from '../../../../src/hosted/api/vscode/ext.host.command';
import { ExtensionLogger } from '../../__mocks__/extensionLogger';

const actionMaps: Map<string, any> = new Map();

const mockMainThreadToolbarProxy = {
  $registerToolbarButtonAction: jest.fn((extensionId: string, extensionPath: string, contribution: any) => {
    actionMaps.set(contribution.id, contribution);
  }),

  $registerDropdownButtonAction: jest.fn((extensionId: string, extensionPath: string, contribution: any) => {
    actionMaps.set(contribution.id, contribution);
  }),

  $registerToolbarSelectAction: jest.fn((extensionId: string, extensionPath: string, contribution: any) => {
    actionMaps.set(contribution.id, contribution);
  }),
};

const mockMainthreadCommon = {
  $subscribeEvent(eventName: string) {},
  $unSubscribeEvent(eventName: string) {},
};

const emitter = new Emitter();

const mockMainthreadCommand = {
  $executeCommand(id, ...args) {
    switch (id) {
      case BUTTON_SET_STATE_ID:
      case SELECT_SET_STATE_ID: {
        const [actionId, state] = args;
        emitter.fire({
          id,
          actionId,
          state,
        });
        break;
      }
      default:
        return Promise.resolve(id);
    }
    return Promise.resolve(id);
  },
};

const map = new Map();

const rpcProtocol: IRPCProtocol = {
  getProxy: (key) => map.get(key),
  set: (key, value) => {
    map.set(key, value);
    return value;
  },
  get: (r) => map.get(r),
};

const extension = mockExtensions[0];

describe('packages/extension/__tests__/hosted/api/sumi/ext.host.toolbar.test.ts', () => {
  let extHostToolbar: ExtHostToolbarActionService;
  let extHostCommon: ExtHostCommon;
  let extHostCommands: ExtHostCommands;
  let toolbarAPI: ReturnType<typeof createToolbarAPIFactory>;

  emitter.event((e) => {
    let eventName;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (e.id === SELECT_SET_STATE_ID) {
      eventName = SELECT_STATE_CHANGE_ID;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
    } else if (e.id === BUTTON_SET_STATE_ID) {
      eventName = BUTTON_STATE_CHANGE_ID;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    extHostCommon.$acceptEvent(eventName, [e.actionId, e.state]);
  });

  const injector = createBrowserInjector([]);
  beforeAll(() => {
    rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadCommon, mockMainthreadCommon as any);
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mockMainthreadCommand as any);
    extHostCommon = injector.get(ExtHostCommon, [rpcProtocol]);
    extHostCommands = injector.get(ExtHostCommands, [rpcProtocol]);
    rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadToolbar, mockMainThreadToolbarProxy as any);
    rpcProtocol.set(ExtHostSumiAPIIdentifier.ExtHostCommon, extHostCommon);
    extHostToolbar = injector.get(ExtHostToolbarActionService, [
      extHostCommands,
      extHostCommon,
      rpcProtocol,
      new ExtensionLogger(),
    ]);
    toolbarAPI = createToolbarAPIFactory(extension, extHostToolbar);
  });

  it('toolbarAPI#registerToolbarAction button should be work', async () => {
    const id = `${extension.id}-toolbar`;
    await toolbarAPI.registerToolbarAction({
      id,
      type: 'button',
      title: 'test toolbar',
      iconPath: '/path/to/toolbar.svg',
      description: 'test for toolbar button action',
      states: {
        default: {
          background: '#ff004f',
        },
        hover: {
          background: '#ffffff',
        },
      },
    });

    const hostAction = await toolbarAPI.getToolbarActionButtonHandle(id);
    expect(hostAction).toBeDefined();
  });

  it('toolbarAPI#registerToolbarAction dropdownButton should be work', async () => {
    const id = `${extension.id}-toolbar`;
    await toolbarAPI.registerToolbarAction({
      id,
      type: 'dropdownButton',
      description: 'test',
      command: 'common-start.select',
      options: [
        {
          label: '运行',
          value: 'run',
        },
        {
          label: '调试',
          value: 'debug',
        },
      ],
    });

    const hostAction = await toolbarAPI.getToolbarActionDropdownButtonHandle(id);
    expect(hostAction).toBeDefined();
  });

  it('toolbarAPI#registerToolbarAction button setState should be work', async () => {
    const defered = new Deferred();

    const id = `${extension.id}-toolbar`;
    const hostAction = await toolbarAPI.getToolbarActionButtonHandle(id);
    hostAction.onStateChanged((e) => {
      expect(e.from).toBe('hover');
      defered.resolve();
    });

    hostAction.setState('hover');
    await defered.promise;
  });

  it('toolbarAPI#registerToolbarAction select should be work', async () => {
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
        default: {
          backgroundColor: '#ff004f',
        },
        selected: {
          backgroundColor: '#000000',
        },
      },
      defaultValue: 'test-label-1',
      description: 'test for toolbar select action',
    });

    const hostAction = await toolbarAPI.getToolbarActionSelectHandle(id);
    expect(hostAction).toBeDefined();
  });

  it('toolbarAPI#registerToolbarAction select setState should be work', async () => {
    const id = `${extension.id}-toolbar-select`;
    const defered = new Deferred();

    const hostAction = await toolbarAPI.getToolbarActionSelectHandle(id);
    hostAction.onStateChanged((e) => {
      expect(e.from).toBe('selected');
      defered.resolve();
    });

    await hostAction.setState('selected');
    await defered.promise;
  });
});
