import { MonacoModule } from '../../src/browser';
import { MonacoService } from '../../src/common';
import { Injector } from '@ali/common-di';
import { resolve } from 'path';
import URI from 'vscode-uri';
import { MonacoMock } from './monaco.mock';
import { any } from 'prop-types';
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

describe('Monaco loading test', () => {

  it('MonacoModule should provide monaco service', () => {
    const cls = new MonacoModule();
    expect(cls.providers.findIndex(provider => {
      return (provider as any).token === MonacoService
    })).not.toBe(-1);
  });
  it('MonacoService should load monaco when creating editor', async () => {
    jest.setTimeout(10000);
    const cls = new MonacoModule();
    const injector = new Injector(cls.providers);
    const service = injector.get(MonacoService) as MonacoService;
    const div = document.createElement('div');

    // monaco should be loaded
    await service.loadMonaco();
    expect((window as any).monaco).not.toBeNull();
    
    // use mock
    (window as any).monaco = (global as any).monaco = MonacoMock;
    const editor = await service.createCodeEditor(div);

  });
});
