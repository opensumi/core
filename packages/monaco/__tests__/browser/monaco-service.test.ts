import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MonacoService, ServiceNames } from '../../src/common';
import MonacoServiceImpl from '../../src/browser/monaco.service';
import { MockedStandaloneCodeEditor } from '../../src/__mocks__/monaco/editor/code-editor';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { MonacoCommandService } from '../../src/browser/monaco.command.service';

let injector: MockInjector;

describe(' monaco service test', () => {

  injector = createBrowserInjector([]);
  (global as any).amdLoader = {require: null};

  injector.addProviders({
    token: MonacoService,
    useClass: MonacoServiceImpl,
  });

  (global as any).amdLoader = {require: null};

  it('should be able to create', async (done) => {
    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    const editor = await service.createCodeEditor(document.createElement('div'));
    expect(editor).toBeDefined();
    const diffEditor = await service.createDiffEditor(document.createElement('div'));
    expect(diffEditor).toBeDefined();
    done();
  });

  it('should be able to override services', async (done) => {

    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    const overriddenService = {};
    service.registerOverride(ServiceNames.BULK_EDIT_SERVICE, overriddenService);
    const editor = await service.createCodeEditor(document.createElement('div'));
    expect((editor as MockedStandaloneCodeEditor).override[ServiceNames.BULK_EDIT_SERVICE]).toBe(overriddenService);
    done();
  });

});
