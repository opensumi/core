import { isNodeIntegrated, isElectronEnv, URI } from '@ali/ide-core-common';
import { dirname, join } from 'path';

declare const __non_webpack_require__;

export function getNodeRequire() {
    return __non_webpack_require__ as any;
}
import { getLanguageAlias } from '@ali/ide-core-common';

export function loadVsRequire(): Promise<any> {

  return new Promise<any>((resolve, reject) => {
    const onDomReady = () => {
      const vsLoader = document.createElement('script');
      vsLoader.type = 'text/javascript';
      // NOTE 直接使用社区的版本会加载worker？会和ts有两重提示，需要设计优先级
      vsLoader.src = 'https://g-assets.daily.taobao.net/tb-theia-app/theia-assets/0.9.9/vs/loader.js';
      vsLoader.charset = 'utf-8';
      vsLoader.addEventListener('load', () => {
        // Save Monaco's amd require and restore the original require
        resolve();
      });
      vsLoader.addEventListener('error', (e) => {
        // tslint:disable-next-line
        console.error(e);
        reject(e);
      });
      document.body.appendChild(vsLoader);
    };

    if (document.readyState === 'complete') {
      onDomReady();
    } else {
      window.addEventListener('load', onDomReady, { once: true });
    }
  });
}

export function loadMonaco(vsRequire: any): Promise<void> {
    if (isElectronEnv()) {
        vsRequire.config({ paths: { vs: join(new URI(window.location.href).path.dir.toString() , 'vs') } });
    } else {
        vsRequire.config({
          paths: { vs: 'https://g-assets.daily.taobao.net/tb-theia-app/theia-assets/0.9.9/vs' },
          'vs/nls': {
        // 设置 monaco 内部的 i18n
            availableLanguages: {
              // en-US -> en-us
              '*': getLanguageAlias().toLowerCase(),
            },
          },
        });
    }
    const global = window as any;
  // https://github.com/Microsoft/monaco-editor/blob/master/docs/integrate-amd-cross.md
    global.MonacoEnvironment = {
    getWorkerUrl() {
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
              baseUrl: 'https://g-assets.daily.taobao.net/tb-theia-app/theia-assets/0.9.9/'
            };
            importScripts('https://g-assets.daily.taobao.net/tb-theia-app/theia-assets/0.9.9/vs/base/worker/workerMain.js');`,
      )}`;
    },
  };
  // NOTE 直接加载 editor.main 时不会 load 其他service
    return new Promise<void>((resolve) => {
    vsRequire(['vs/editor/editor.main'], () => {
      vsRequire([
        'vs/editor/standalone/browser/standaloneServices',
        'vs/editor/browser/services/codeEditorService',
        'vs/editor/browser/services/codeEditorServiceImpl',
        'vs/platform/contextview/browser/contextViewService',
        'vs/base/parts/quickopen/common/quickOpen',
        'vs/base/parts/quickopen/browser/quickOpenWidget',
        'vs/base/parts/quickopen/browser/quickOpenModel',
        'vs/platform/theme/common/styler',
        'vs/base/common/filters',
        'vs/editor/standalone/browser/simpleServices',
        'vs/platform/commands/common/commands',
        'vs/editor/browser/editorExtensions',
        'vs/editor/common/modes',
      ], (standaloneServices: any, codeEditorService: any, codeEditorServiceImpl: any, contextViewService: any,
          quickOpen: any, quickOpenWidget: any, quickOpenModel: any, styler: any, filters: any,
          simpleServices: any, commands: any, editorExtensions: any, modes: any) => {
          const global = window as any;

          global.monaco.services = Object.assign({}, simpleServices, standaloneServices, codeEditorService, codeEditorServiceImpl, contextViewService);
          global.monaco.quickOpen = Object.assign({}, quickOpen, quickOpenWidget, quickOpenModel);
          global.monaco.filters = filters;
          global.monaco.theme = styler;
          global.monaco.commands = commands;
          global.monaco.editorExtensions = editorExtensions;
          global.monaco.modes = modes;
          resolve();
        });
    });
  });
}
