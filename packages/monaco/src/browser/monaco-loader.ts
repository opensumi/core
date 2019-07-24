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
      vsLoader.src = 'https://g.alicdn.com/code/lib/monaco-editor/0.17.1/min/vs/loader.js';
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
    vsRequire.config({ paths: { vs: URI.file((window as any).monacoPath).path.join('vs').toString() } });
  } else {
    vsRequire.config({
      paths: { vs: 'https://g.alicdn.com/code/lib/monaco-editor/0.17.1/min/vs' },
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
              baseUrl: 'https://g.alicdn.com/code/lib/monaco-editor/0.17.1/min/'
            };
            importScripts('https://g.alicdn.com/code/lib/monaco-editor/0.17.1/min/vs/base/worker/workerMain.js');`,
      )}`;
    },
  };
  // NOTE 直接加载 editor.main 时不会 load 其他service
  return new Promise<void>((resolve) => {
    const _registry: { id: any, ctor: any, supportsDelayedInstantiation: any }[] = [];
    vsRequire.define('vs/platform/instantiation/common/extensions', ['require', 'exports'], (require, exports) => {
      Object.defineProperty(exports, '__esModule', { value: true });

      function registerSingleton(id, ctor, supportsDelayedInstantiation) {
        _registry.push({ id, ctor, supportsDelayedInstantiation });
      }
      exports.registerSingleton = registerSingleton;
    });
    vsRequire(['vs/editor/editor.main'], () => {
      vsRequire([
        'vs/editor/standalone/browser/standaloneServices',
        'vs/editor/browser/services/codeEditorService',
        'vs/editor/browser/services/codeEditorServiceImpl',
        'vs/platform/contextview/browser/contextViewService',
        'vs/editor/standalone/browser/quickOpen/editorQuickOpen',
        'vs/base/parts/quickopen/browser/quickOpenWidget',
        'vs/base/parts/quickopen/browser/quickOpenModel',
        'vs/platform/theme/common/styler',
        'vs/base/common/filters',
        'vs/editor/standalone/browser/simpleServices',
        'vs/platform/commands/common/commands',
        'vs/editor/browser/editorExtensions',
        'vs/platform/instantiation/common/descriptors',
      ], (standaloneServices: any, codeEditorService: any, codeEditorServiceImpl: any, contextViewService: any,
          quickOpen: any, quickOpenWidget: any, quickOpenModel: any, styler: any, filters: any,
          simpleServices: any, commands: any, editorExtensions: any, descriptors) => {
          const global = window as any;
          const original = standaloneServices.StaticServices.init;
          standaloneServices.StaticServices.init = (...args) => {
            const [result, instantiationService] = original(...args);
            _registry.forEach((reg) => {
              result.set(reg.id, new descriptors.SyncDescriptor(reg.ctor, [], reg.supportsDelayedInstantiation));
            });
            return [result, instantiationService];
          };

          global.monaco.services = Object.assign({}, simpleServices, standaloneServices, codeEditorService, codeEditorServiceImpl, contextViewService);
          global.monaco.quickOpen = Object.assign({}, quickOpen, quickOpenWidget, quickOpenModel);
          global.monaco.filters = filters;
          global.monaco.theme = styler;
          global.monaco.commands = commands;
          global.monaco.editorExtensions = editorExtensions;
          resolve();
        });
    });
  });
}
