import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { KaitianExtensionClientAppContribution } from '../../src/browser';
import { CommandService, CommandRegistry, IClientApp, URI, Uri, IClipboardService } from '@ali/ide-core-browser';
import { mockService, MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { FileTreeContribution } from '@ali/ide-file-tree-next/lib/browser/file-tree-contribution';
import { IFileTreeService } from '@ali/ide-file-tree-next';
import { IWorkspaceService } from '@ali/ide-workspace';
import { ExtensionNodeServiceServerPath, IExtensionNodeClientService } from '../../src';
import { WSChannelHandler } from '@ali/ide-connection';
import { uuid } from '@ali/ide-core-common';

describe(__filename, () => {
  let injector: MockInjector;
  let commandService: CommandService;
  let kaitianExtensionClientAppContribution: KaitianExtensionClientAppContribution;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.overrideProviders(
      KaitianExtensionClientAppContribution,
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
          isMutiWorkspace: false,
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
    const fileTreeContribution = injector.get(FileTreeContribution);
    kaitianExtensionClientAppContribution.registerCommands(commandRegistry);
    fileTreeContribution.registerCommands(commandRegistry);
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
});
