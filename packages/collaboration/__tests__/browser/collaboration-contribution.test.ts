import { KeybindingRegistry, KeybindingWeight, PreferenceService } from '@opensumi/ide-core-browser';
import { CommandRegistry, CommandRegistryImpl, IDisposable, ILogger } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { AUTO_SAVE_MODE } from '@opensumi/ide-editor';
import { IFileService, IFileServiceClient } from '@opensumi/ide-file-service';

import {
  CollaborationServiceForClientPath,
  ICollaborationService,
  IYWebsocketServer,
  CollaborationModuleContribution,
} from '../../src';
import { CollaborationContribution } from '../../src/browser/collaboration.contribution';
import { CollaborationService } from '../../src/browser/collaboration.service';
import { REDO, UNDO } from '../../src/common/commands';
import { CollaborationServiceForClient } from '../../src/node/collaboration.service';
import { YWebsocketServerImpl } from '../../src/node/y-websocket-server';

describe('CollaborationContribution test', () => {
  let injector: MockInjector;
  let contribution: CollaborationContribution;
  let collaborationService: ICollaborationService;
  let preferenceService: PreferenceService;

  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.mockService(ILogger);
    injector.mockService(PreferenceService);
    injector.mockService(IFileServiceClient);
    injector.mockService(IFileService);
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

    injector.addProviders({
      token: CollaborationModuleContribution,
      useValue: { getContributions: () => [] },
    });

    contribution = injector.get(CollaborationContribution);
    collaborationService = injector.get(ICollaborationService);
    preferenceService = injector.get(PreferenceService);
  });

  it('should register key bindings with correct id, priority and when clause', () => {
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

  it('should register commands', () => {
    const registry: CommandRegistryImpl = injector.get(CommandRegistry);

    contribution.registerCommands(registry);

    expect(registry.getCommands()).toEqual([UNDO, REDO]);
  });
});
