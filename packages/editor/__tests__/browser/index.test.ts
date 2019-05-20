import { EditorModule } from '../../src/browser';
import { MonacoMock } from '@ali/ide-monaco/__tests__/browser/monaco.mock'
import { Injector } from '@ali/common-di';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';

const {JSDOM} = require('jsdom')

const jsdom = new JSDOM(``, {
  resources: 'usable',
  runScripts: 'dangerously',
});
(global as any).document = jsdom.window.document;
(global as any).window = jsdom.window;
document.queryCommandSupported = () => true;
document.execCommand = () => true;
jest.mock('onigasm', () => {
  return {
    loadWASM: () => null,
    OnigScanner: () => null,
    OnigString:() => null
  }
})

describe('template test', () => {
  it('EditorModule', async () => {
    const cls = new EditorModule();
    const monacoCls = new MonacoModule();
    const injector = new Injector([...monacoCls.providers, ...cls.providers]);
    const workbenchServices = injector.get(WorkbenchEditorService) as WorkbenchEditorService;
    expect(workbenchServices.editorGroups.length).toBe(1);

    // use mock
    (window as any).monaco = (global as any).monaco = MonacoMock;

    const container = document.createElement('div');
    await workbenchServices.editorGroups[0].createEditor(container);
    expect(workbenchServices.editorGroups[0].codeEditor).not.toBeUndefined();
  });
  // it('MonacoService should load monaco when creating editor', async () => {
  //   jest.setTimeout(10000);
  //   const cls = new MonacoModule();
  //   const injector = new Injector(cls.providers);
  //   const service = injector.get(MonacoService) as MonacoService;
  //   const div = document.createElement('div');

  //   // monaco should be loaded
  //   await service.loadMonaco();
  //   expect((window as any).monaco).not.toBeNull();
    
  //   // use mock
  //   (window as any).monaco = (global as any).monaco = MonacoMock;
  //   const editor = await service.createCodeEditor(div);

  // });
});
