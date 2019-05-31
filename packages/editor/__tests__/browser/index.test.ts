import { EditorModule } from '../../src/browser';
import { MonacoMock } from '@ali/ide-monaco/__mocks__/monaco.mock';
import { Injector } from '@ali/common-di';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { DocModelModule } from '@ali/ide-doc-model/lib/browser';
import { INodeDocumentService } from '@ali/ide-doc-model';
import { IDocumentModelMirror } from '@ali/ide-doc-model/lib/common/doc';
import { URI } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { EditorGroup } from '@ali/ide-editor/lib/browser/workbench-editor.service';
// tslint:disable-next-line
const {JSDOM} = require('jsdom');

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
    OnigString: () => null,
  };
}),

describe('editor model basic test', () => {
  it('EditorModule', async (done) => {
    const injector = createBrowserInjector([EditorModule, MonacoModule, DocModelModule]);
    injector.overrideProviders({
      token: 'NodeDocumentService',
      useClass: NodeDocumentServiceMock,
    });
    const workbenchServices = injector.get(WorkbenchEditorService) as WorkbenchEditorService;
    expect(workbenchServices.editorGroups.length).toBe(1);

    // use mock
    (window as any).monaco = (global as any).monaco = MonacoMock;

    const container = document.createElement('div');
    await (workbenchServices.editorGroups[0] as EditorGroup).createEditor(container);
    expect(workbenchServices.editorGroups[0].codeEditor).not.toBeUndefined();

    done();
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

@Injectable()
export class NodeDocumentServiceMock implements INodeDocumentService {

  async saveContent(mirror: IDocumentModelMirror): Promise<boolean> {
    return true;
  }

  async resolveContent(uri: URI): Promise<IDocumentModelMirror | null> {
    return {
      uri: uri.toString(),
      language: 'plaintext',
      lines: [''],
      eol: '\n',
      encoding: 'utf8',
    };
  }

}
