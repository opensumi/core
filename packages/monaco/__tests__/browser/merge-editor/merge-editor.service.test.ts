import { MonacoOverrideServiceRegistry, MonacoService } from '@opensumi/ide-core-browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { MergeEditorService } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/merge-editor.service';
import MonacoServiceImpl from '@opensumi/ide-monaco/lib/browser/monaco.service';
import { MonacoOverrideServiceRegistryImpl } from '@opensumi/ide-monaco/lib/browser/override.service.registry';

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
    ],
  );

  it('should be defined', async () => {
    const service: MergeEditorService = injector.get(MergeEditorService);
    expect(service.accept).toBeDefined();
    expect(service.compare).toBeDefined();
    expect(service.getCurrentEditor).toBeDefined();
    expect(service.getIncomingEditor).toBeDefined();
    expect(service.getResultEditor).toBeDefined();
    expect(service.getTurnLeftRangeMapping).toBeDefined();
    expect(service.getTurnRightRangeMapping).toBeDefined();
    expect(service.instantiationCodeEditor).toBeDefined();
    expect(service.setNutritionAndLaunch).toBeDefined();
    expect(service.updateOptions).toBeDefined();
  });

  it('should be able to create', async () => {
    const monacoService: MonacoService = injector.get(MonacoService);
    const mergeEditor = monacoService.createMergeEditor(document.createElement('div'));
    expect(mergeEditor).toBeDefined();
  });

  afterAll(async () => {
    await injector.disposeAll();
  });
});
