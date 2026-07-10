import {
  CommandRegistry,
  CommandService,
  Disposable,
  Emitter,
  OPEN_EDITORS_COMMANDS,
  URI,
} from '@opensumi/ide-core-browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

import { OpenedEditorModule } from '../../src/browser';
import { OpenedEditorContribution } from '../../src/browser/opened-editor.contribution';
import { OpenedEditorDecorationService } from '../../src/browser/services/opened-editor-decoration.service';
import { OpenedEditorEventService } from '../../src/browser/services/opened-editor-event.service';
import { OpenedEditorModelService } from '../../src/browser/services/opened-editor-model.service';
import { OpenedEditorService } from '../../src/browser/services/opened-editor-tree.service';

const createResource = (uri: URI) => ({
  uri,
  name: uri.displayName,
  icon: '',
  metadata: {},
});

const createWorkbenchEvents = () => ({
  onActiveResourceChange: new Emitter().event,
  onDidCurrentEditorGroupChanged: new Emitter().event,
  onDidEditorGroupsChanged: new Emitter().event,
});

describe('OpenedEditorContribution', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([OpenedEditorModule]);
    injector.overrideProviders({
      token: OpenedEditorDecorationService,
      useValue: {
        onDidChange: () => Disposable.create(() => {}),
      },
    });
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('should retain pinned survivors after closing all opened editors', async () => {
    const pinned = createResource(new URI('test://opened-editor/pinned'));
    const ordinary = createResource(new URI('test://opened-editor/ordinary'));
    const group = { resources: [pinned, ordinary] };
    const openedEditorEventService = injector.get(OpenedEditorEventService);
    const closeAll = jest.fn(async () => {
      group.resources = [pinned];
      openedEditorEventService.onEditorGroupCloseEvent();
    });
    injector.mockService(WorkbenchEditorService, {
      ...createWorkbenchEvents(),
      closeAll,
      sortedEditorGroups: [group],
    });
    const modelService = injector.get(OpenedEditorModelService);
    await modelService.whenReady;
    await modelService.treeModel?.ensureReady;
    const refresh = jest.spyOn(modelService, 'refresh');
    const clear = jest.spyOn(modelService, 'clear');
    const openedEditorService = injector.get(OpenedEditorService);
    const contribution = injector.get(OpenedEditorContribution);
    const registry = injector.get<CommandRegistry>(CommandRegistry);
    contribution.registerCommands(registry);

    await injector.get<CommandService>(CommandService).executeCommand(OPEN_EDITORS_COMMANDS.CLOSE_ALL.id);
    await modelService.flushEventQueuePromise;

    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(group.resources).toEqual([pinned]);
    expect(openedEditorService.getEditorNodeByUri(pinned)).toBeDefined();
    expect(openedEditorService.getEditorNodeByUri(ordinary)).toBeUndefined();
    expect(clear).not.toHaveBeenCalled();
  });

  it('should leave the opened editors model unchanged when close all is cancelled', async () => {
    const pinned = createResource(new URI('test://opened-editor/cancelled-pinned'));
    const ordinary = createResource(new URI('test://opened-editor/cancelled-ordinary'));
    const group = { resources: [pinned, ordinary] };
    const closeAll = jest.fn(async () => {});
    injector.mockService(WorkbenchEditorService, {
      ...createWorkbenchEvents(),
      closeAll,
      sortedEditorGroups: [group],
    });
    const modelService = injector.get(OpenedEditorModelService);
    await modelService.whenReady;
    await modelService.treeModel?.ensureReady;
    const refresh = jest.spyOn(modelService, 'refresh');
    const clear = jest.spyOn(modelService, 'clear');
    const openedEditorService = injector.get(OpenedEditorService);
    const contribution = injector.get(OpenedEditorContribution);
    const registry = injector.get<CommandRegistry>(CommandRegistry);
    contribution.registerCommands(registry);

    await injector.get<CommandService>(CommandService).executeCommand(OPEN_EDITORS_COMMANDS.CLOSE_ALL.id);

    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(openedEditorService.getEditorNodeByUri(pinned)).toBeDefined();
    expect(openedEditorService.getEditorNodeByUri(ordinary)).toBeDefined();
    expect(clear).not.toHaveBeenCalled();
  });
});
