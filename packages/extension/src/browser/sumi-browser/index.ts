import { Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { URI, localize, getIcon, IReporterService, format } from '@opensumi/ide-core-browser';
import { ResizeHandleHorizontal, ResizeHandleVertical } from '@opensumi/ide-core-browser/lib/components';
import { EditorComponentRenderMode } from '@opensumi/ide-editor/lib/browser';
import { Scroll } from '@opensumi/ide-editor/lib/browser/component/scroll/scroll';
import { IThemeService, getColorRegistry } from '@opensumi/ide-theme';
import { ToolBarPosition } from '@opensumi/ide-toolbar';
import { PlainWebview } from '@opensumi/ide-webview';

import { IExtension } from '../../common';

import { createBrowserCommandsApiFactory } from './commands';
import { createBrowserComponents } from './components';

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
    localize: (key: string, message?: string) => localize(key, message, extension.id),
    formatLocalize: (key: string, ...args: string[]) => format(localize(key, undefined, extension.id), ...args),
    getIcon,

    // theme
    getThemeColors: () => {
      const themeService: IThemeService = injector.get(IThemeService);
      const currentTheme = themeService.getCurrentThemeSync();

      const exportedColors = getColorRegistry()
        .getColors()
        .reduce((colors, entry) => {
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
