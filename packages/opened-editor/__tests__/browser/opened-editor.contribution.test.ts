import { CommandRegistry, CommandService, OPEN_EDITORS_COMMANDS, URI } from '@opensumi/ide-core-browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { OpenedEditorModule } from '../../src/browser';
import { OpenedEditorContribution } from '../../src/browser/opened-editor.contribution';
import { OpenedEditorEventService } from '../../src/browser/services/opened-editor-event.service';
import { OpenedEditorModelService } from '../../src/browser/services/opened-editor-model.service';

describe('OpenedEditorContribution', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([OpenedEditorModule]);
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('should retain pinned survivors after closing all opened editors', async () => {
    const pinned = { uri: new URI('test://opened-editor/pinned') };
    const ordinary = { uri: new URI('test://opened-editor/ordinary') };
    const group = { resources: [pinned, ordinary] };
    let modelResources = [...group.resources];
    const openedEditorEventService = injector.get(OpenedEditorEventService);
    const eventDisposer = openedEditorEventService.onDidChange(() => {
      modelResources = [...group.resources];
    });
    const closeAll = jest.fn(async () => {
      group.resources = [pinned];
      openedEditorEventService.onEditorGroupCloseEvent();
    });
    const clear = jest.fn(() => modelResources.splice(0));
    injector.mockService(WorkbenchEditorService, { closeAll, sortedEditorGroups: [group] });
    injector.mockService(OpenedEditorModelService, { clear });
    const contribution = injector.get(OpenedEditorContribution);
    const registry = injector.get<CommandRegistry>(CommandRegistry);
    contribution.registerCommands(registry);

    try {
      await injector.get<CommandService>(CommandService).executeCommand(OPEN_EDITORS_COMMANDS.CLOSE_ALL.id);

      expect(closeAll).toHaveBeenCalledTimes(1);
      expect(group.resources).toEqual([pinned]);
      expect(modelResources).toEqual([pinned]);
      expect(clear).not.toHaveBeenCalled();
    } finally {
      eventDisposer.dispose();
    }
  });

  it('should leave the opened editors model unchanged when close all is cancelled', async () => {
    const pinned = { uri: new URI('test://opened-editor/cancelled-pinned') };
    const ordinary = { uri: new URI('test://opened-editor/cancelled-ordinary') };
    const modelResources = [pinned, ordinary];
    const openedEditorEventService = injector.get(OpenedEditorEventService);
    const onDidChange = jest.fn();
    const eventDisposer = openedEditorEventService.onDidChange(onDidChange);
    const closeAll = jest.fn(async () => {});
    const clear = jest.fn(() => modelResources.splice(0));
    injector.mockService(WorkbenchEditorService, { closeAll });
    injector.mockService(OpenedEditorModelService, { clear });
    const contribution = injector.get(OpenedEditorContribution);
    const registry = injector.get<CommandRegistry>(CommandRegistry);
    contribution.registerCommands(registry);

    try {
      await injector.get<CommandService>(CommandService).executeCommand(OPEN_EDITORS_COMMANDS.CLOSE_ALL.id);

      expect(closeAll).toHaveBeenCalledTimes(1);
      expect(onDidChange).not.toHaveBeenCalled();
      expect(modelResources).toEqual([pinned, ordinary]);
      expect(clear).not.toHaveBeenCalled();
    } finally {
      eventDisposer.dispose();
    }
  });
});
