
import { URI, localize, getIcon, IReporterService, format } from '@ide-framework/ide-core-browser';
import { Scroll } from '@ide-framework/ide-editor/lib/browser/component/scroll/scroll';
import { ResizeHandleHorizontal, ResizeHandleVertical } from '@ide-framework/ide-core-browser/lib/components';
import { PlainWebview } from '@ide-framework/ide-webview';
import { ToolBarPosition } from '@ide-framework/ide-toolbar';
import { EditorComponentRenderMode } from '@ide-framework/ide-editor/lib/browser';
import { Injector } from '@ide-framework/common-di';
import { IThemeService, getColorRegistry } from '@ide-framework/ide-theme';
import { IRPCProtocol } from '@ide-framework/ide-connection';

import { createBrowserCommandsApiFactory } from './commands';
import { createBrowserComponents } from './components';
import { IExtension } from '../../common';

/**
 * Browser 尽量只export视图相关的少量API
 * 设计API时遵循以下原则:
 * 1. browser只暴露getter，任何注册、调用等会产生副作用的行为全部放入逻辑层
 * @param injector
 */
export function createBrowserApi(injector: Injector, extension: IExtension, rpcProtocol?: IRPCProtocol) {

  const commands = createBrowserCommandsApiFactory(injector, extension, rpcProtocol);
  const components = createBrowserComponents(injector, extension);
  const reporter = injector.get(IReporterService);

  return {
    ...components,
    commands,
    Scroll,
    ResizeHandleHorizontal,
    ResizeHandleVertical,
    PlainWebview,

    // common classes
    URI,
    localize: (key: string, message?: string) => {
      return localize(key, message, extension.id);
    },
    formatLocalize: (key: string, ...args: string[]) => {
      return format(localize(key, undefined, extension.id), ...args);
    },
    getIcon,

    // theme
    getThemeColors: () => {
      const themeService: IThemeService = injector.get(IThemeService);
      const currentTheme = themeService.getCurrentThemeSync();

      const exportedColors = getColorRegistry().getColors().reduce((colors, entry) => {
        const color = currentTheme.getColor(entry.id);
        if (color) {
          colors[entry.id.replace('.', '-')] = color.toString();
        }
        return colors;
      }, {} as { [key: string]: string });
      return exportedColors;
    },

    ToolBarPosition,
    EditorComponentRenderMode,
    reporter,
  };
}
