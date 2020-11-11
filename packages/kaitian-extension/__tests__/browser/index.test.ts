import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { KaitianExtensionClientAppContribution } from '../../src/browser';
import { CommandService, CommandRegistry, IClientApp } from '@ali/ide-core-browser';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';

describe(__filename, () => {

  const injector = createBrowserInjector([]);
  injector.addProviders(
    KaitianExtensionClientAppContribution,
  );

  injector.overrideProviders({
    token: IClientApp,
    useValue: mockService({
      fireOnReload: jest.fn(),
    }),
  });
  const commandService = injector.get<CommandService>(CommandService);

  beforeAll(() => {
    const commandRegistry = injector.get<CommandRegistry>(CommandRegistry);
    const kaitianExtensionClientAppContribution = injector.get(KaitianExtensionClientAppContribution);
    kaitianExtensionClientAppContribution.registerCommands(commandRegistry);
  });

  it('execute workbench.action.reloadWindow command ', async () => {
    const clientApp = injector.get<IClientApp>(IClientApp);
    await commandService.executeCommand('workbench.action.reloadWindow');
    expect(clientApp.fireOnReload).toBeCalled();
  });
});
