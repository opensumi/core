import { act } from 'react-dom/test-utils';

import { MonacoOverrideServiceRegistry, MonacoService, URI } from '@opensumi/ide-core-browser';
import { IOpenMergeEditorArgs, MergeEditorInputData } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MappingManagerService } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/mapping-manager.service';
import { MergeEditorService } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/merge-editor.service';
import { monaco } from '@opensumi/ide-monaco/lib/browser/monaco-api/index';
import MonacoServiceImpl from '@opensumi/ide-monaco/lib/browser/monaco.service';
import { MonacoOverrideServiceRegistryImpl } from '@opensumi/ide-monaco/lib/browser/override.service.registry';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceService } from '@opensumi/ide-workspace/lib/browser/workspace-service';

let injector: MockInjector;

describe('merge editor service test', () => {
  injector = createBrowserInjector([]);
  injector.overrideProviders(
    ...[
      {
        token: MonacoService,
        useClass: MonacoServiceImpl,
      },
      {
        token: MergeEditorService,
        useClass: MergeEditorService,
      },
      {
        token: MonacoOverrideServiceRegistry,
        useClass: MonacoOverrideServiceRegistryImpl,
      },
      {
        token: MappingManagerService,
        useClass: MappingManagerService,
      },
      {
        token: IWorkspaceService,
        useClass: WorkspaceService,
      },
    ],
  );
  let mergeEditorService: MergeEditorService;
  let openMergeEditorArgs: IOpenMergeEditorArgs;

  beforeAll(async () => {
    mergeEditorService = injector.get(MergeEditorService);
    mergeEditorService.instantiationCodeEditor(
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div'),
    );

    openMergeEditorArgs = {
      ancestor: {
        uri: URI.parse('a'),
        textModel: monaco.editor.createModel(`let a = 123456789;
a += 1;
a += 1;
a += 1;
a += 1;
a += 1;`),
        baseContent: `let a = 123456789;
a += 1;
a += 1;
a += 1;
a += 1;
a += 1;`,
      },
      input1: new MergeEditorInputData(URI.parse('b')).setTextModel(
        monaco.editor.createModel(`let a = 123456789;
a += 2;
a += 2;
a += 2;
a += 1;
a += 1;`),
      ),
      input2: new MergeEditorInputData(URI.parse('c')).setTextModel(
        monaco.editor.createModel(`let a = 123456789;
a += 1;
a += 1;

a += 1;
a += 2;`),
      ),
      output: {
        uri: URI.parse('d'),
        textModel: monaco.editor.createModel('output'),
      },
    };
  });

  it('should be defined', async () => {
    expect(mergeEditorService.accept).toBeDefined();
    expect(mergeEditorService.compare).toBeDefined();
    expect(mergeEditorService.getCurrentEditor).toBeDefined();
    expect(mergeEditorService.getIncomingEditor).toBeDefined();
    expect(mergeEditorService.getResultEditor).toBeDefined();
    expect(mergeEditorService.getTurnLeftRangeMapping).toBeDefined();
    expect(mergeEditorService.getTurnRightRangeMapping).toBeDefined();
    expect(mergeEditorService.instantiationCodeEditor).toBeDefined();
    expect(mergeEditorService.setNutritionAndLaunch).toBeDefined();
    expect(mergeEditorService.updateOptions).toBeDefined();
  });

  it('should be able to create', async () => {
    const monacoService: MonacoService = injector.get(MonacoService);
    let mergeEditor;
    act(() => {
      mergeEditor = monacoService.createMergeEditor(document.createElement('div'));
    });
    expect(mergeEditor).toBeDefined();
    await mergeEditor.open(openMergeEditorArgs);

    expect(mergeEditor.getOursEditor()).toBeDefined();
    expect(mergeEditor.getTheirsEditor()).toBeDefined();
    expect(mergeEditor.getResultEditor()).toBeDefined();
  });

  it('should be document mapping', async () => {
    const turnLeftMapping = mergeEditorService.getTurnLeftRangeMapping();
    const turnRightMapping = mergeEditorService.getTurnRightRangeMapping();

    expect(turnLeftMapping.length).toBe(2);
    expect(turnRightMapping.length).toBe(1);

    expect(turnLeftMapping[0].toString()).toBe('{[2,5)->[2,2)}');
    expect(turnRightMapping[0].toString()).toBe('{[4,7)->[4,8)}');
  });

  afterAll(async () => {
    await injector.disposeAll();
  });
});
