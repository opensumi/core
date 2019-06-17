import { MonacoModule } from '../../src/browser';
import { MonacoService } from '../../src/common';
import { MonacoMock } from '../../__mocks__/monaco.mock';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { EditorModule } from '@ali/ide-editor/lib/browser';
import { DocModelModule } from '@ali/ide-doc-model/lib/browser';

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
});

describe('Monaco loading test', () => {
  const injector = createBrowserInjector([EditorModule, MonacoModule, DocModelModule]);
  it('MonacoService should load monaco when creating editor', async (done) => {
    const service = injector.get(MonacoService) as MonacoService;
    const div = document.createElement('div');

    // monaco should be loaded
    await service.loadMonaco();
    expect((window as any).monaco).not.toBeNull();

    // use mock
    (window as any).monaco = (global as any).monaco = MonacoMock;
    // const editor = await service.createCodeEditor(div);

    // expect(editor).not.toBeUndefined();

    done();
  });
});
