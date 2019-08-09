import { IWebviewService, IPlainWebviewConstructionOptions, IPlainWebview, IWebview, IWebviewContentOptions, IWebviewThemeData } from './types';
import { isElectronRenderer, getLogger, localize } from '@ali/ide-core-browser';
import { ElectronPlainWebview, IframePlainWebview } from './plain-weview';
import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { IFrameWebviewPanel } from './iframe-webview';
import { ITheme, IThemeService } from '@ali/ide-theme';
import { CorePreferences } from '@ali/ide-core-browser/lib/core-preferences';
import { getColorRegistry } from '@ali/ide-theme/lib/common/color-registry';

@Injectable()
export class WebviewServiceImpl implements IWebviewService {

  private webviewIdCount = 0;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(CorePreferences)
  protected readonly corePreferences: CorePreferences;

  @Autowired(IThemeService)
  private themeService: IThemeService;

  createPlainWebview(options: IPlainWebviewConstructionOptions = {}): IPlainWebview {

    if (isElectronRenderer()) {
      if (options.preferredImpl && options.preferredImpl === 'iframe') {
        return new IframePlainWebview();
      }
      return new ElectronPlainWebview();
    } else {
      if (options.preferredImpl && options.preferredImpl === 'webview') {
        getLogger().warn(localize('webview.webviewTagUnavailable', '无法在非Electron环境使用Webview标签。回退至使用iframe。'));
      }
      return new IframePlainWebview();
    }

  }

  createWebview(options?: IWebviewContentOptions): IWebview {
    if (isElectronRenderer()) {
      return this.injector.get(IFrameWebviewPanel, [(this.webviewIdCount ++).toString(), options]);
    } else {
      return this.injector.get(IFrameWebviewPanel, [(this.webviewIdCount ++).toString(), options]);
    }
  }

  getWebviewThemeData(theme: ITheme): IWebviewThemeData {
    const editorFontFamily = this.corePreferences['editor.fontFamily'];
    const editorFontWeight = this.corePreferences['editor.fontFamily'];
    const editorFontSize = this.corePreferences['editor.fontSize'];

    const exportedColors = getColorRegistry().getColors().reduce((colors, entry) => {
      const color = theme.getColor(entry.id);
      if (color) {
        colors['vscode-' + entry.id.replace('.', '-')] = color.toString();
      }
      return colors;
    }, {} as { [key: string]: string });

    const styles = {
      'vscode-font-family': '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", ans-serif',
      'vscode-font-weight': 'normal',
      'vscode-font-size': '13px',
      'vscode-editor-font-family': editorFontFamily,
      'vscode-editor-font-weight': editorFontWeight,
      'vscode-editor-font-size': editorFontSize,
      ...exportedColors,
    };

    const activeTheme = ApiThemeClassName.fromTheme(theme);
    return { styles, activeTheme };
  }

}

enum ApiThemeClassName {
  light = 'vscode-light',
  dark = 'vscode-dark',
  highContrast = 'vscode-high-contrast',
}

namespace ApiThemeClassName {
  export function fromTheme(theme: ITheme): ApiThemeClassName {
    if (theme.type === 'light') {
      return ApiThemeClassName.light;
    } else if (theme.type === 'dark') {
      return ApiThemeClassName.dark;
    } else {
      return ApiThemeClassName.highContrast;
    }
  }
}
