import { Injector } from '@opensumi/di';
import { MockLogger } from '@opensumi/ide-core-browser/__mocks__/logger';
import { LayoutState } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { CommandService, CommandServiceImpl } from '@opensumi/ide-core-common/lib/command';
import { mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { ILogger } from '@opensumi/ide-logs/lib/common';
import { IDialogService } from '@opensumi/ide-overlay/lib/common';
import { IStatusBarService } from '@opensumi/ide-status-bar';
import { StatusBarService } from '@opensumi/ide-status-bar/lib/browser/status-bar.service';
import { ITerminalProcessPath } from '@opensumi/ide-terminal-next';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { MergedEnvironmentVariableCollection } from '@opensumi/ide-terminal-next/lib/common/environmentVariableCollection';
import { IWorkspaceStorageService } from '@opensumi/ide-workspace/lib/common';

import { TerminalEnvironmentService } from '../../src/browser/terminal.environment.service';

const mockData = [
  {
    extensionIdentifier: 'vscode-samples.vscode-terminal-api-example',
    collection: [['FOO', { value: 'BAR', type: 1 }]],
  },
];

describe('terminal.environment.service', () => {
  const injector = new Injector();
  let terminalEnvService: TerminalEnvironmentService;
  let storageService: IWorkspaceStorageService;

  beforeAll(() => {
    injector.addProviders(
      {
        token: IStatusBarService,
        useClass: StatusBarService,
      },
      {
        token: IDialogService,
        useValue: {},
      },
      {
        token: CommandService,
        useClass: CommandServiceImpl,
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
      {
        token: EnvironmentVariableServiceToken,
        useClass: TerminalEnvironmentService,
      },
      {
        token: ITerminalProcessPath,
        useValue: {
          getEnv: () => ({}),
        },
      },
      {
        token: IWorkspaceStorageService,
        useValue: {
          getData: () => JSON.stringify(mockData),
          setData: () => {},
        },
      },
      {
        token: LayoutState,
        useValue: mockService({
          getState: () => ({}),
        }),
      },
    );

    terminalEnvService = injector.get(TerminalEnvironmentService);
    storageService = injector.get(IWorkspaceStorageService);
  });

  it('TerminalEnvironmentService#initEnvironmentVariableCollections', async (done) => {
    const mockGetDataFn = jest.spyOn(storageService, 'getData');
    await terminalEnvService.initEnvironmentVariableCollections();
    expect(mockGetDataFn).toBeCalled();

    const existingCollection = terminalEnvService.collections.get(mockData[0].extensionIdentifier);

    expect(terminalEnvService.collections.size).toBe(1);
    expect(existingCollection).toBeDefined();
    expect(existingCollection?.persistent).toBeTruthy();
    expect(existingCollection?.map.get('FOO')).toEqual({ value: 'BAR', type: 1 });
    done();
    terminalEnvService.delete(mockData[0].extensionIdentifier);
  });

  it('TerminalEnvironmentService#set', () => {
    const mockMap = new Map();
    mockMap.set('VARIABLE1', {
      value: 'VALUE1',
      type: 1,
    });

    mockMap.set('VARIABLE2', {
      value: 'VALUE2',
      type: 2,
    });

    mockMap.set('VARIABLE3', {
      value: 'VALUE3',
      type: 3,
    });

    terminalEnvService.set('mock-extension', {
      persistent: false,
      map: mockMap,
    });

    expect(terminalEnvService.collections.size).toBe(1);

    const existingCollection = terminalEnvService.collections.get('mock-extension');
    expect(existingCollection?.map.size).toBe(3);
    expect(existingCollection?.persistent).toBeFalsy();
    expect(existingCollection?.map.get('VARIABLE1')).toEqual({
      value: 'VALUE1',
      type: 1,
    });
    expect(existingCollection?.map.get('VARIABLE2')).toEqual({
      value: 'VALUE2',
      type: 2,
    });
    expect(existingCollection?.map.get('VARIABLE3')).toEqual({
      value: 'VALUE3',
      type: 3,
    });
  });

  it('TerminalEnvironmentService#delete', () => {
    terminalEnvService.delete('mock-extension');
    expect(terminalEnvService.collections.size).toBe(0);
    expect(terminalEnvService.collections.get('mock-extension')).toBeUndefined();
  });

  it('TerminalEnvironmentService#onDidChangeCollections', async (done) => {
    const mockMap = new Map();
    mockMap.set('VARIABLE1', {
      value: 'VALUE1',
      type: 1,
    });
    terminalEnvService.set('mock-extension-1', {
      persistent: true,
      map: mockMap,
    });

    const disposable = terminalEnvService.onDidChangeCollections((e) => {
      expect(e instanceof MergedEnvironmentVariableCollection).toBeTruthy();
      expect(e.map.size).toBe(1);
      done();
      disposable.dispose();
    });
  });
});
