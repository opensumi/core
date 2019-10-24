/* istanbul ignore file */
import { isNodeIntegrated, isElectronEnv, URI } from '@ali/ide-core-common';

declare const __non_webpack_require__;

export function getNodeRequire() {
  return __non_webpack_require__ as any;
}
import { getLanguageId } from '@ali/ide-core-common';
import { join } from '@ali/ide-core-common/lib/path';

export function loadMonaco(vsRequire: any): Promise<void> {
  if (isElectronEnv()) {
    let lang = getLanguageId().toLowerCase();
    if (lang === 'en-us') {
      lang = '';
    }
    vsRequire.config({
      paths: { vs: URI.file(join((window as any).monacoPath, 'vs')).codeUri.fsPath,
      'vs/nls': {
        // 设置 monaco 内部的 i18n
        availableLanguages: {
          // en-US -> en-us
          '*': lang,
        },
      },
    } });
  } else {
    let lang = getLanguageId().toLowerCase();
    if (lang === 'en-us') {
      lang = '';
    }
    vsRequire.config({
      paths: { vs: 'https://dev.g.alicdn.com/tb-ide/monaco-editor-core/0.17.99/vs' },
      'vs/nls': {
        // 设置 monaco 内部的 i18n
        availableLanguages: {
          // en-US -> en-us
          '*': lang,
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
              baseUrl: 'https://dev.g.alicdn.com/tb-ide/monaco-editor-core/0.17.99/'
            };
            importScripts('https://dev.g.alicdn.com/tb-ide/monaco-editor-core/0.17.99/vs/base/worker/workerMain.js');`,
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
        'vs/platform/keybinding/common/keybindingsRegistry',
        'vs/platform/keybinding/common/keybindingResolver',
        'vs/base/common/keyCodes',
        'vs/base/common/keybindingLabels',
        'vs/base/common/platform',
        'vs/platform/contextkey/common/contextkey',
        'vs/platform/contextkey/browser/contextKeyService',
        'vs/editor/common/modes',
        'vs/editor/common/model/textModel',
      ], (standaloneServices: any, codeEditorService: any, codeEditorServiceImpl: any, contextViewService: any,
          quickOpen: any, quickOpenWidget: any, quickOpenModel: any, styler: any, filters: any,
          simpleServices: any, commands: any, editorExtensions: any, descriptors: any,
          keybindingsRegistry: any, keybindingResolver: any, keyCodes: any, keybindingLabels: any,
          platform: any,
          contextKey: any, contextKeyService: any, modes: any,
          textModel: any,
        ) => {
          const global = window as any;
          const original = standaloneServices.StaticServices.init;
          standaloneServices.StaticServices.init = (...args) => {
            const [result, instantiationService] = original(...args);
            _registry.forEach((reg) => {
              result.set(reg.id, new descriptors.SyncDescriptor(reg.ctor, [], reg.supportsDelayedInstantiation));
            });
            return [result, instantiationService];
          };

          global.monaco.services = Object.assign(
            {},
            simpleServices, standaloneServices,
            codeEditorService, codeEditorServiceImpl,
            contextViewService,
          );
          global.monaco.quickOpen = Object.assign({}, quickOpen, quickOpenWidget, quickOpenModel);
          global.monaco.filters = filters;
          global.monaco.theme = styler;
          global.monaco.commands = commands;
          global.monaco.editorExtensions = editorExtensions;
          global.monaco.keybindings = Object.assign({}, keybindingsRegistry, keybindingResolver, keyCodes, keybindingLabels);
          global.monaco.platform = platform;
          global.monaco.contextkey = contextKey;
          global.monaco.contextKeyService = contextKeyService;
          global.monaco.modes = modes;
          global.monaco.textModel = textModel;
          // codeActionsProvider需要支持额外属性
          global.monaco.languages.registerCodeActionProvider = (languageId, provider) => {
            return modes.CodeActionProviderRegistry.register(languageId, {
                provideCodeActions: (model, range, context, token) => {
                    const markers = standaloneServices.StaticServices.markerService.get().read({ resource: model.uri }).filter( (m) => {
                        return monaco.Range.areIntersectingOrTouching(m, range);
                    });
                    return provider.provideCodeActions(model, range, { markers, only: context.only }, token);
                },
                providedCodeActionKinds: provider.providedCodeActionKinds,
            });
          };
          resolve();
        });
    });
  });
}
