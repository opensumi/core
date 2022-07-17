import { KeybindingRegistry, KeybindingWeight, PreferenceService } from '@opensumi/ide-core-browser';
import { CommandRegistry, CommandRegistryImpl, IDisposable, ILogger } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { CollaborationServiceForClientPath, ICollaborationService, IYWebsocketServer } from '../../src';
import { CollaborationContribution } from '../../src/browser/collaboration.contribution';
import { CollaborationService } from '../../src/browser/collaboration.service';
import { REDO, UNDO } from '../../src/common/commands';
import { CollaborationServiceForClient } from '../../src/node/collaboration.service';
import { YWebsocketServerImpl } from '../../src/node/y-websocket-server';

describe('collaboration contribution', () => {
  let injector: MockInjector;
  let contribution: CollaborationContribution;
  let collaborationService: ICollaborationService;
  let preferenceService: PreferenceService;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.mockService(ILogger);
    injector.mockService(PreferenceService);
    injector.mockService(IFileServiceClient);
    injector.mockService(KeybindingRegistry);
    injector.addProviders(
      CollaborationContribution,
      {
        token: ICollaborationService,
        useClass: CollaborationService,
      },
      {
        token: CollaborationServiceForClientPath,
        useClass: CollaborationServiceForClient,
      },
      {
        token: IYWebsocketServer,
        useClass: YWebsocketServerImpl,
      },
      {
        token: CommandRegistry,
        useClass: CommandRegistryImpl,
      },
    );

    contribution = injector.get(CollaborationContribution);
    collaborationService = injector.get(ICollaborationService);
    preferenceService = injector.get(PreferenceService);
  });

  it('correctly calls life cycle method', () => {
    // modify preference
    jest.spyOn(preferenceService, 'get').mockReturnValueOnce(true).mockReturnValueOnce(false);
    const preferenceGetSpy = jest.spyOn(preferenceService, 'get');
    const preferenceSetSpy = jest.spyOn(preferenceService, 'set');

    const onDidStartSpy = jest.spyOn(contribution, 'onDidStart');
    const collaborationServiceInitSpy = jest.spyOn(collaborationService, 'initialize');
    contribution.onDidStart();
    expect(onDidStartSpy).toBeCalled();
    expect(collaborationServiceInitSpy).toBeCalled();

    const onStopSpy = jest.spyOn(contribution, 'onStop');
    const collaborationServiceDestroySpy = jest.spyOn(collaborationService, 'destroy');
    contribution.onStop();
    expect(onStopSpy).toBeCalled();
    expect(collaborationServiceDestroySpy).toBeCalled();

    expect(preferenceGetSpy).toBeCalledTimes(2);
    expect(preferenceSetSpy).toBeCalledTimes(2);
    expect(preferenceSetSpy.mock.calls[0][1]).toBe(false);
    expect(preferenceSetSpy.mock.calls[1][1]).toBe(true);
  });

  it('registers key bindings with correct id, priority and when clause', () => {
    const registry: KeybindingRegistry = injector.get(KeybindingRegistry);
    const commandIds = [UNDO.id, REDO.id];

    jest.spyOn(registry, 'registerKeybinding').mockImplementation((binding) => {
      const { command, when, priority } = binding;
      expect(commandIds.includes(command)).toBe(true);
      expect(when).toBe('editorFocus');
      expect(priority).toBe(KeybindingWeight.EditorContrib);
      return undefined as any as IDisposable; // just ignore type error
    });

    contribution.registerKeybindings(registry);
  });

  it('registers commands', () => {
    const registry: CommandRegistryImpl = injector.get(CommandRegistry);

    contribution.registerCommands(registry);

    expect(registry.getCommands()).toEqual([UNDO, REDO]);
  });
});
