import { WSChannelHandler } from '@ali/ide-connection';
import { CommandRegistry, CommandService, IClientApp, IClipboardService, URI, Uri } from '@ali/ide-core-browser';
import { uuid } from '@ali/ide-core-common';
import { IFileTreeService } from '@ali/ide-file-tree-next';
import { FileTreeContribution } from '@ali/ide-file-tree-next/lib/browser/file-tree-contribution';
import { PreferenceContribution } from '@ali/ide-preferences/lib/browser/preference-contribution';
import { IWorkspaceService } from '@ali/ide-workspace';

import { MockInjector, mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { ExtensionNodeServiceServerPath, IExtensionNodeClientService } from '../../src';
import { KaitianExtensionClientAppContribution, KaitianExtensionCommandContribution } from '../../src/browser/extension.contribution';
import { setupExtensionServiceInjector } from './extension-service/extension-service-mock-helper';

describe(__filename, () => {
  let injector: MockInjector;
  let commandService: CommandService;
  let kaitianExtensionClientAppContribution: KaitianExtensionClientAppContribution;
  let kaitianExtensionCommandContribution: KaitianExtensionCommandContribution;

  beforeEach(() => {
    injector = setupExtensionServiceInjector();
    injector.overrideProviders(
      KaitianExtensionClientAppContribution,
      KaitianExtensionCommandContribution,
      PreferenceContribution,
      FileTreeContribution,
      {
        token: IClipboardService,
        useValue: mockService({
          writeText: jest.fn(),
          readText: jest.fn(),
        }),
      },
      {
        token: IClientApp,
        useValue: mockService({
          fireOnReload: jest.fn(),
        }),
      },
      {
        token: IFileTreeService,
        useValue: mockService({
          isMultipleWorkspace: false,
        }),
      },
      {
        token: IWorkspaceService,
        useValue: mockService({
          workspace: {
            uri: URI.file('/home/admin/workspace'),
          },
        }),
      },
      {
        token: ExtensionNodeServiceServerPath,
        useValue: mockService({
          disposeClientExtProcess: jest.fn(),
        }),
      },
      {
        token: WSChannelHandler,
        useValue: mockService({
          clientId: uuid(),
        }),
      },
    );
    const commandRegistry = injector.get<CommandRegistry>(CommandRegistry);
    kaitianExtensionClientAppContribution = injector.get(KaitianExtensionClientAppContribution);
    kaitianExtensionCommandContribution = injector.get(KaitianExtensionCommandContribution);
    const fileTreeContribution = injector.get(FileTreeContribution);
    const preferenceContribution = injector.get(PreferenceContribution);
    kaitianExtensionCommandContribution.registerCommands(commandRegistry);
    fileTreeContribution.registerCommands(commandRegistry);

    preferenceContribution.registerCommands(commandRegistry);
    commandService = injector.get<CommandService>(CommandService);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('execute workbench.action.reloadWindow command ', async () => {
    const clientApp = injector.get<IClientApp>(IClientApp);
    await commandService.executeCommand('workbench.action.reloadWindow');
    expect(clientApp.fireOnReload).toBeCalled();
  });

  it('execute copyFilePath command ', async () => {
    const clipboardService = injector.get<IClipboardService>(IClipboardService);
    await commandService.executeCommand('copyFilePath', Uri.file('/home/admin/workspace/a.ts'));
    expect(clipboardService.writeText).toBeCalled();
    expect(clipboardService.writeText).toBeCalledWith('/home/admin/workspace/a.ts');
  });

  it('execute copyRelativeFilePath command ', async () => {
    const clipboardService = injector.get<IClipboardService>(IClipboardService);
    await commandService.executeCommand('copyRelativeFilePath', Uri.file('/home/admin/workspace/a.ts'));
    expect(clipboardService.writeText).toBeCalled();
    expect(clipboardService.writeText).toBeCalledWith('a.ts');
  });

  it('close page expects disposeClientExtProcess to be called', () => {
    const extensionNodeClientService = injector.get<IExtensionNodeClientService>(ExtensionNodeServiceServerPath);
    // trigger close
    kaitianExtensionClientAppContribution.onStop();
    expect(extensionNodeClientService.disposeClientExtProcess).toBeCalled();
  });

  it('workbench.action.openSettings', async (done) => {
    const commandRegistry = injector.get<CommandRegistry>(CommandRegistry);
    commandRegistry.beforeExecuteCommand((command, args) => {
      expect(command).toBe('core.openpreference');
      done();
      return args;
    });
    commandService.executeCommand('workbench.action.openSettings');
  });
});
