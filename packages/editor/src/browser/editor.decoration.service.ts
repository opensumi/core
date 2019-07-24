import { Autowired, Injectable } from '@ali/common-di';
import { ICSSStyleService } from '@ali/ide-theme/lib/common/style';
import { ITextEditorDecorationType, IThemeDecorationRenderOptions, IDecorationRenderOptions, IContentDecorationRenderOptions, IMarkdownString, IHoverMessage, IDecorationApplyOptions } from '../common';
import { makeRandomHexString, URI , IDisposable, Disposable, IRange} from '@ali/ide-core-common';
import { WorkbenchThemeService } from '@ali/ide-theme/lib/browser/workbench.theme.service';
import { IThemeColor } from '@ali/ide-theme/lib/common/color';
import { IEditorDecorationCollectionService, IBrowserTextEditorDecorationType, IDynamicModelDecorationProperty, IThemedCssStyle} from './types';
import { IMonacoImplEditor } from './editor-collection.service';

@Injectable()
export class EditorDecorationCollectionService implements IEditorDecorationCollectionService {

  decorations: Map<string, IBrowserTextEditorDecorationType> = new Map();

  @Autowired(ICSSStyleService)
  cssManager: ICSSStyleService;

  @Autowired(WorkbenchThemeService)
  themeService: WorkbenchThemeService;

  private tempId = 0;

  getNextTempId() {
    this.tempId++;
    return 'temp-decoration-' + this.tempId;
  }

  createTextEditorDecorationType(options: IDecorationRenderOptions, key?: string): IBrowserTextEditorDecorationType {
    if (!key) {
      key = this.getNextTempId();
    }
    const property = this.resolveDecoration(key, options);
    const type = {
      key,
      property,
      dispose: () => {
        if ( this.decorations.has(key!) ) {
          this.decorations.delete(key!);
        }
      },
    };
    this.decorations.set(key, type);
    return type;
  }

  getTextEditorDecorationType(key) {
    return this.decorations.get(key);
  }

  private resolveDecoration(key: string, options: IDecorationRenderOptions): IDynamicModelDecorationProperty {

    const dec = {
      default: this.addedThemeDecorationToCSSStyleSheet(key, options),
      light: options.light ? this.addedThemeDecorationToCSSStyleSheet(key + '-light', options.light) : null,
      dark: options.dark ? this.addedThemeDecorationToCSSStyleSheet(key + '-dark', options.dark) : null,
      isWholeLine: options.isWholeLine || false,
      overviewRulerLane: options.overviewRulerLane,
      dispose: () => {
        dec.default.dispose();
        if (dec.light) {
          dec.light.dispose();
        }
        if (dec.dark) {
          dec.dark.dispose();
        }
      },
    };

    return dec;

  }

  private addedThemeDecorationToCSSStyleSheet(key, options: IThemeDecorationRenderOptions): IThemedCssStyle {

    const className = key;
    const disposer = new Disposable();
    let afterContentClassName;
    let beforeContentClassName;
    const styles = this.resolveCSSStyle(options);
    disposer.addDispose(this.cssManager.addClass(key, styles));
    if (options.after) {
      const styles = this.resolveContentCSSStyle(options.after);
      disposer.addDispose(this.cssManager.addClass(key + '-after:after', styles));
      afterContentClassName = key + '-after';
    }
    if (options.before) {
      const styles = this.resolveContentCSSStyle(options.before);
      disposer.addDispose(this.cssManager.addClass(key + '-before:before', styles));
      beforeContentClassName = key + '-before';
    }

    return {
      className,
      afterContentClassName,
      beforeContentClassName,
      overviewRulerColor: options.overviewRulerColor,
      dispose() {
        return disposer.dispose();
      },
    };
  }

  private resolveCSSStyle(styles: IThemeDecorationRenderOptions ): CSSStyleDeclaration {

    return {
      backgroundColor: this.themeService.getColor(styles.backgroundColor),
      background: styles.gutterIconPath ? `background:url('${styles.gutterIconPath}') center center no-repeat` : undefined,
      backgroundSize: styles.gutterIconSize ? `background-size:${styles.gutterIconSize}` : undefined,

      outline: styles.outline,
      outlineColor: styles.outlineColor,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,

      border: styles.border,
      borderColor: this.themeService.getColor(styles.borderColor),
      borderRadius: styles.borderRadius,
      borderSpacing: styles.borderSpacing,
      borderStyle: styles.borderStyle,
      borderWidth: styles.borderWidth,

      fontStyle: styles.fontStyle,
      fontWeight: styles.fontWeight,
      textDecoration: styles.textDecoration,
      cursor: styles.cursor,
      color: this.themeService.getColor(styles.color),
      opacity: styles.opacity,
      letterSpacing: styles.letterSpacing,
    } as CSSStyleDeclaration;
  }

  private resolveContentCSSStyle(styles: IContentDecorationRenderOptions): CSSStyleDeclaration {
    let content: string | undefined;
    if ( styles.contentText ) {
      content = `"${styles.contentText}"`;
    } else if (styles.contentIconPath) {
      content = `url(${URI.from(styles.contentIconPath).toString()})`;
    }
    return {
      content,
      border: styles.border,
      borderColor: this.themeService.getColor(styles.borderColor),
      fontStyle: styles.fontStyle,
      fontWeight: styles.fontWeight,
      textDecoration: styles.textDecoration,
      color: this.themeService.getColor(styles.color),
      backgroundColor: this.themeService.getColor(styles.backgroundColor),

      margin: styles.margin,
      width: styles.width,
      height: styles.height,
    } as CSSStyleDeclaration;
  }

}
